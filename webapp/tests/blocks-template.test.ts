import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  BLOCKS_SCOPE,
  NEWS_TABLE_ID,
  USER_QUESTS_TABLE_ID,
  USER_SETTINGS_TABLE_ID,
  WEB_STACK_NAME,
} from "../cdk-blocks/constants";
const directory = process.env.BLOCKS_SYNTH_DIR;

test(
  "Blocks: Web・対話・定期取得を分離し、SSRはストリーミングとAWS保存を使う",
  { skip: !directory },
  async () => {
    const load = async (stack: string) =>
      JSON.parse(
        await readFile(join(directory!, stack + ".template.json"), "utf8"),
      );
    const web = await load("QuestBoardWeb"),
      agent = await load("QuestBoardAgent"),
      batch = await load("QuestBoardBatch");
    const resources = Object.values(web.Resources) as {
      Type: string;
      Properties: Record<string, any>;
    }[];
    const pool = resources.find((r) => r.Type === "AWS::Cognito::UserPool");
    assert.ok(pool);
    assert.equal(
      pool.Properties.AdminCreateUserConfig?.AllowAdminCreateUserOnly,
      true,
    );
    assert.equal(pool.Properties.MfaConfiguration, "OFF");
    assert.ok(
      resources.filter((r) => r.Type === "AWS::DynamoDB::Table").length >= 3,
    );
    // テーブル名は、constants.tsの定数から決めて、エージェントのスタックへ渡している。
    // 実際のテンプレートのテーブル名と一致しないと、エージェントが、存在しないテーブルを読む。
    const tableNames = resources
      .filter((r) => r.Type === "AWS::DynamoDB::Table")
      .map((r) => r.Properties.TableName);
    for (const id of [
      NEWS_TABLE_ID,
      USER_QUESTS_TABLE_ID,
      USER_SETTINGS_TABLE_ID,
    ])
      assert.ok(
        tableNames.includes(`${WEB_STACK_NAME}-${BLOCKS_SCOPE}-${id}`),
        `テーブル名が定数と一致しません: ${id}`,
      );
    assert.ok(
      resources.some((r) => r.Type === "AWS::CloudFront::Distribution"),
    );
    assert.ok(JSON.stringify(web).includes('"ResponseTransferMode":"STREAM"'));
    assert.ok(
      !resources.some((r) => r.Type === "AWS::BedrockAgentCore::Runtime"),
    );
    for (const source of [agent, batch])
      assert.equal(
        Object.values(source.Resources).filter(
          (r: any) => r.Type === "AWS::BedrockAgentCore::Runtime",
        ).length,
        1,
      );
    const ssm = Object.values(agent.Resources).find(
      (r: any) => r.Type === "AWS::SSM::Parameter",
    ) as any;
    assert.equal(ssm.Properties.Name, "/quest-board/chat-runtime-arn");
    const lambda = resources.find(
      (r) =>
        r.Type === "AWS::Lambda::Function" &&
        r.Properties.Environment?.Variables?.COGNITO_USER_POOL_ID,
    );
    assert.ok(lambda?.Properties.Environment?.Variables?.BLOCKS_STACK_NAME);
    assert.equal(lambda.Properties.Timeout, 300);
    const streamingMethods = resources.filter(
      (r) =>
        r.Type === "AWS::ApiGateway::Method" &&
        r.Properties.Integration?.ResponseTransferMode === "STREAM",
    );
    assert.equal(streamingMethods.length, 2);
    for (const method of streamingMethods)
      assert.equal(method.Properties.Integration.TimeoutInMillis, 300000);
    // API Gatewayのアクセスログ: Blocksの API と、SSR用のAPIの、2つのステージで有効にする。
    // アカウントのCloudWatchロールは、1つだけ(2つ作ると、後のものが前のものを書き換える)。
    const stages = resources.filter((r) => r.Type === "AWS::ApiGateway::Stage");
    assert.equal(stages.length, 2);
    for (const stage of stages)
      assert.ok(stage.Properties.AccessLogSetting?.DestinationArn);
    assert.equal(
      resources.filter((r) => r.Type === "AWS::ApiGateway::Account").length,
      1,
    );
    // ログの保持期間は、すべて1か月(30日)。設定しないと、Blocksのログは365日残る。
    const logGroups = resources.filter((r) => r.Type === "AWS::Logs::LogGroup");
    assert.ok(logGroups.length > 0);
    for (const logGroup of logGroups)
      assert.equal(logGroup.Properties.RetentionInDays, 30);
    const indexQuery = resources
      .filter((r) => r.Type === "AWS::IAM::Policy")
      .flatMap((r) => r.Properties.PolicyDocument.Statement)
      .find((s: any) => s.Sid === "NewsFeedIndexQuery");
    assert.ok(indexQuery);
    assert.deepEqual(
      Array.isArray(indexQuery.Action)
        ? indexQuery.Action
        : [indexQuery.Action],
      ["dynamodb:Query"],
    );
    const indexResources = Array.isArray(indexQuery.Resource)
      ? indexQuery.Resource
      : [indexQuery.Resource];
    assert.equal(indexResources.length, 1);
    const indexResource = JSON.stringify(indexResources[0]);
    assert.ok(indexResource.includes("/index/ByFeedPublishedAt"));
    // テーブル名は文字列(定数から決める)なので、権限の対象は、出力のテーブル名を含む。
    assert.ok(indexResource.includes(web.Outputs.NewsTableName.Value));
    assert.ok(!indexResource.includes("*"));
    const batchIndexQuery = Object.values(batch.Resources)
      .filter((r: any) => r.Type === "AWS::IAM::Policy")
      .flatMap((r: any) => r.Properties.PolicyDocument.Statement)
      .find((s: any) => s.Sid === "BatchNewsFeedIndexQuery");
    assert.ok(batchIndexQuery);
    assert.deepEqual(
      Array.isArray(batchIndexQuery.Action)
        ? batchIndexQuery.Action
        : [batchIndexQuery.Action],
      ["dynamodb:Query"],
    );
    const batchIndexResources = Array.isArray(batchIndexQuery.Resource)
      ? batchIndexQuery.Resource
      : [batchIndexQuery.Resource];
    assert.equal(batchIndexResources.length, 1);
    assert.ok(
      JSON.stringify(batchIndexResources[0]).includes(
        "/index/ByFeedPublishedAt",
      ),
    );
    assert.ok(!JSON.stringify(batchIndexResources[0]).includes("*"));
    // 初回はWeb→Agentの順で作る。後続スタックのSSM値をWebデプロイ時に要求しない。
    assert.ok(
      !Object.values(web.Parameters ?? {}).some(
        (p: any) =>
          p.Type === "AWS::SSM::Parameter::Value<String>" &&
          p.Default === "/quest-board/chat-runtime-arn",
      ),
    );
  },
);
