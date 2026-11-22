import * as path from "node:path";
import { Duration } from "aws-cdk-lib";
import { CfnMethod, RestApi } from "aws-cdk-lib/aws-apigateway";
import * as subs from "aws-cdk-lib/aws-sns-subscriptions";
import { Hosting } from "aws-cdk-blocks/cdk";
import type { BlocksStack } from "aws-cdk-blocks/cdk";
import type { Construct } from "constructs";


function configureStreamingIntegrationTimeout(
  hosting: Construct,
  timeout: Duration,
) {
  const apis = hosting.node
    .findAll()
    .filter((child): child is RestApi => child instanceof RestApi);
  let count = 0;
  for (const api of apis) {
    const methods = api.node
      .findAll()
      .filter(
        (child): child is CfnMethod =>
          child instanceof CfnMethod &&
          (child.integration as CfnMethod.IntegrationProperty | undefined)
            ?.responseTransferMode === "STREAM",
      );
    if (!methods.length) continue;
    if (!api.latestDeployment)
      throw new Error("SSR API GatewayのDeploymentがありません");
    for (const method of methods) {
      method.addPropertyOverride(
        "Integration.TimeoutInMillis",
        timeout.toMilliseconds(),
      );
      count++;
    }
    // CfnMethodへの上書きだけでは既存Stageに反映されないため、Deploymentも更新する。
    api.latestDeployment.addToLogicalId({
      streamingTimeoutInMillis: timeout.toMilliseconds(),
    });
  }
  // Hostingの内部の構造が変わって、上書きが効かなくなったときは、デプロイの前に気づけるよう、止める。
  if (!count) throw new Error("Hostingのストリーミング統合が見つかりません");
}

// Hosting(Astro の SSR)を作る。
export function createHosting(
  web: BlocksStack,
  cognitoIds: { userPoolId: string; userPoolClientId: string },
) {
  const ssrTimeout = Duration.minutes(5);
  const hosting = new Hosting(web, "Hosting", {
    root: path.resolve("."),
    framework: "astro",
    api: web,
    buildCommand: "npm run build",
    // SSR 用 Lambda。API Gatewayの統合タイムアウトも下で同じ値に設定する。
    compute: { timeout: ssrTimeout },
    // SSR 用 API Gateway のアクセスログを有効にする(Hosting の既定は無効)。保持期間は既定の 1 か月。
    // Blocks の API 側(BlocksStack の defaults.accessLogging)と、アカウントの CloudWatch 用ロールを共有する
    frontDoor: { features: { serverOrigin: { accessLogging: true } } },
    // 5xx・Lambda エラーのアラーム。通知先は ALERT_EMAIL(未設定なら通知なし)
    // CloudFront のアラームは、us-east-1 の補助スタック(QuestBoardWeb-CfMonitoring-*)に作られる
    monitoring: {
      subscriptions: process.env.ALERT_EMAIL
        ? [new subs.EmailSubscription(process.env.ALERT_EMAIL)]
        : [],
    },
    // SSR 用 Lambda の環境変数。BLOCKS_STACK_NAME は AWS 上かどうかの判定に、
    // Cognito の ID は JWT の検証に使う(src/pages/api/_server/blocks/serverConfig.ts の serverConfig)
    environment: {
      BLOCKS_STACK_NAME: web.stackName,
      COGNITO_USER_POOL_ID: cognitoIds.userPoolId,
      COGNITO_CLIENT_ID: cognitoIds.userPoolClientId,
    },
  });

  configureStreamingIntegrationTimeout(hosting, ssrTimeout);
  return hosting;
}
