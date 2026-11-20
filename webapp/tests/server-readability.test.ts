import assert from "node:assert/strict";
import test, { afterEach, mock } from "node:test";
import type { APIContext } from "astro";
import {
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { settings, userQuests } from "../aws-blocks/storage";
import { getSdkIdentifiers } from "@aws-blocks/blocks";
import {
  getConsistentItem,
  listConsistentUserItems,
  isAwsBlock,
} from "../src/pages/api/_server/blocks/consistentReads";
import {
  getUserSettings,
  putUserSettings,
} from "../src/pages/api/_server/userSettings/repository";
import { DEFAULT_USER_SETTINGS } from "../src/lib/userSettings/model";
import { loadIsolatedModule } from "./helpers/loadIsolatedModule";

afterEach(() => mock.restoreAll());

test("DynamoDBの1件取得は強い整合性・テーブル名・キーを維持する", async () => {
  const key = { userId: "u", newsId: "n" };
  const send = mock.method(
    DynamoDBDocumentClient.prototype,
    "send",
    async (command: GetCommand) => {
      assert.ok(command instanceof GetCommand);
      assert.deepEqual(command.input, {
        TableName: getSdkIdentifiers(userQuests).tableName,
        Key: key,
        ConsistentRead: true,
      });
      return { Item: { ...key, version: 1 } };
    },
  );
  assert.deepEqual(await getConsistentItem(userQuests, key), { ...key, version: 1 });
  send.mock.mockImplementation(async () => ({}));
  assert.equal(await getConsistentItem(userQuests, key), null);
});

test("DynamoDBの一覧取得は接頭辞とページ送りを維持する", async () => {
  const nextKey = { userId: "u", newsId: "prefix#1" };
  const send = mock.method(
    DynamoDBDocumentClient.prototype,
    "send",
    async (command: QueryCommand) => {
      assert.ok(command instanceof QueryCommand);
      assert.equal(command.input.ConsistentRead, true);
      assert.equal(command.input.TableName, getSdkIdentifiers(userQuests).tableName);
      assert.equal(command.input.KeyConditionExpression,
        "userId = :user AND begins_with(newsId, :prefix)");
      assert.deepEqual(command.input.ExpressionAttributeValues, {
        ":user": "u", ":prefix": "prefix#",
      });
      if (!command.input.ExclusiveStartKey) {
        return { Items: [{ id: 1 }], LastEvaluatedKey: nextKey };
      }
      assert.deepEqual(command.input.ExclusiveStartKey, nextKey);
      return { Items: [{ id: 2 }] };
    },
  );
  assert.deepEqual(await listConsistentUserItems(userQuests, "u", "prefix#"), [
    { id: 1 }, { id: 2 },
  ]);
  send.mock.mockImplementation(async (command: QueryCommand) => {
    assert.equal(command.input.KeyConditionExpression, "userId = :user");
    assert.deepEqual(command.input.ExpressionAttributeValues, { ":user": "u" });
    return {};
  });
  assert.deepEqual(await listConsistentUserItems(userQuests, "u", ""), []);
});

test("ユーザー設定は保存値を検証し、未保存・不正な値なら既定値を返す", async () => {
  assert.equal(isAwsBlock(settings), false, "AWSランタイムでは実行しない");
  const get = mock.method(settings, "get", async () => null);
  assert.deepEqual(await getUserSettings("u"), DEFAULT_USER_SETTINGS);
  get.mock.mockImplementation(async () => ({
    userId: "u", ...DEFAULT_USER_SETTINGS, learningReviewEvery: -1,
  }));
  assert.deepEqual(await getUserSettings("u"), DEFAULT_USER_SETTINGS);
  const changed = { ...DEFAULT_USER_SETTINGS, learningReviewEvery: 10 };
  get.mock.mockImplementation(async () => ({ userId: "u", ...changed }));
  assert.deepEqual(await getUserSettings("u"), changed);
  const put = mock.method(settings, "put", async () => {});
  await putUserSettings("u", changed);
  const record = put.mock.calls[0].arguments[0];
  assert.ok(record);
  assert.equal(record.userId, "u");
  assert.equal(record.learningReviewEvery, 10);
  assert.ok(!Number.isNaN(Date.parse(record.updatedAt!)));
});

async function apiHelpers(local: boolean, userId: string | null) {
  const calls = { auth: 0, metrics: [] as string[], logs: [] as string[] };
  const logger = { info() {} };
  const helpers = await loadIsolatedModule<typeof import("../src/pages/api/_helpers")>(
    "src/pages/api/_helpers.ts",
    {
      "../../lib/appMode": { BLOCKS_LOCAL: local },
      "./_server/auth/authenticate": {
        authenticate: async () => { calls.auth++; return userId; },
      },
      "./_logger": {
        requestLogger: (route: string, id: string) => {
          calls.logs.push(`${route}:${id}`);
          return logger;
        },
      },
      "./_metrics": {
        measureApi: async (route: string, run: () => Promise<Response>) => {
          calls.metrics.push(route);
          return run();
        },
      },
    },
  );
  return { helpers, calls, logger };
}

const context = {
  request: new Request("https://example.test/api"),
} as APIContext;

test("APIの共通処理は認証済みユーザーを渡し、未認証なら処理を呼ばない", async () => {
  const { helpers, calls, logger } = await apiHelpers(false, "verified");
  const route = helpers.withUser("test", async (received) => {
    assert.equal(received.userId, "verified");
    assert.equal(received.request, context.request);
    assert.equal(received.log, logger);
    return helpers.json({ ok: true });
  });
  const response = await route(context);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), { ok: true });
  assert.deepEqual(calls.metrics, ["test"]);
  assert.deepEqual(calls.logs, ["test:verified"]);

  const denied = await apiHelpers(false, null);
  const deniedRoute = denied.helpers.withUser("denied", async () => {
    assert.fail("未認証では呼ばない");
  });
  assert.equal((await deniedRoute(context)).status, 401);
  const failure = new Error("handler failed");
  const errorRoute = helpers.withUser("error", async () => { throw failure; });
  await assert.rejects(
    async () => errorRoute(context), (error) => error === failure,
  );
});

test("ローカル専用APIは対象外なら認証前に404、ローカルなら認証する", async () => {
  for (const local of [false, true]) {
    const { helpers, calls } = await apiHelpers(local, "u");
    const route = helpers.localOnly("local", async () => helpers.json({ ok: true }));
    assert.equal((await route(context)).status, local ? 200 : 404);
    assert.equal(calls.auth, local ? 1 : 0);
    assert.equal(calls.metrics.length, local ? 1 : 0);
  }
});

test("JSONの読み取りはnullと不正・空の本文を区別する", async () => {
  const { helpers } = await apiHelpers(false, "u");
  for (const [body, expected] of [["null", null], ["", undefined], ["invalid", undefined]] as const) {
    const request = new Request("https://example.test", { method: "POST", body });
    assert.equal(await helpers.readJson(request), expected);
  }
  assert.equal(helpers.badRequest().status, 400);
});

async function configuredAgent(
  env: Record<string, unknown>,
  processEnv: Record<string, string>,
  get: () => Promise<string>,
) {
  return loadIsolatedModule<typeof import("../src/pages/api/_server/agent/configuredAgent")>(
    "src/pages/api/_server/agent/configuredAgent.ts",
    {
      "./agentcore": {
        createAgentCoreAgent: (arn: string) => ({ arn }),
        createLocalAgent: (url: string) => ({ url }),
      },
      "../../../../../aws-blocks/storage": { agentRuntimeSetting: { get } },
    },
    {
      "import.meta.env": JSON.stringify(env),
      "process.env": JSON.stringify(processEnv),
    },
  );
}

test("エージェント接続先は環境変数、本番の保存値、ローカルURLの順で選ぶ", async () => {
  const unexpected = async () => { assert.fail("設定を取得しない"); };
  const explicit = await configuredAgent({ PROD: true }, { AGENT_RUNTIME_ARN: "explicit" }, unexpected);
  assert.deepEqual(await explicit.createConfiguredAgent(), { arn: "explicit" });
  const local = await configuredAgent({}, { AGENT_URL: "http://local.test" }, unexpected);
  assert.deepEqual(await local.createConfiguredAgent(), { url: "http://local.test" });
  const fallback = await configuredAgent({}, {}, unexpected);
  assert.deepEqual(await fallback.createConfiguredAgent(), { url: "http://localhost:4010/agui" });
});

test("接続設定の同時取得は1回にまとめ、失敗した場合だけ次回読み直す", async () => {
  let calls = 0;
  const pending = Promise.withResolvers<string>();
  const module = await configuredAgent({ PROD: true }, {}, () => {
    calls++;
    return pending.promise;
  });
  const first = module.createConfiguredAgent();
  const second = module.createConfiguredAgent();
  assert.equal(calls, 1);
  pending.resolve("cached");
  assert.deepEqual(await Promise.all([first, second]), [{ arn: "cached" }, { arn: "cached" }]);
  await module.createConfiguredAgent();
  assert.equal(calls, 1);

  let attempts = 0;
  const retry = await configuredAgent({ PROD: true }, {}, async () => {
    attempts++;
    if (attempts === 1) throw new Error("SSM failed");
    return "recovered";
  });
  await assert.rejects(retry.createConfiguredAgent(), /SSM failed/);
  assert.deepEqual(await retry.createConfiguredAgent(), { arn: "recovered" });
  assert.equal(attempts, 2);
});
