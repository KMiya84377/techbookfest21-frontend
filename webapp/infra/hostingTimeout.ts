import { Duration } from "aws-cdk-lib";
import { CfnMethod, RestApi } from "aws-cdk-lib/aws-apigateway";
import type { Construct } from "constructs";

// Hosting 0.4.1はSTREAM統合のtimeoutを公開していないため、CDKのescape hatchで設定する。
// Hosting内のストリーミング統合だけが対象。Blocksの認証・データAPIは変更しない。
export function configureStreamingIntegrationTimeout(hosting: Construct, timeout: Duration) {
  const apis = hosting.node.findAll().filter((child): child is RestApi => child instanceof RestApi);
  let count = 0;
  for (const api of apis) {
    const methods = api.node.findAll().filter((child): child is CfnMethod =>
      child instanceof CfnMethod &&
      (child.integration as CfnMethod.IntegrationProperty | undefined)?.responseTransferMode === "STREAM");
    if (!methods.length) continue;
    if (!api.latestDeployment) throw new Error("SSR API GatewayのDeploymentがありません");
    for (const method of methods) {
      method.addPropertyOverride("Integration.TimeoutInMillis", timeout.toMilliseconds());
      count++;
    }
    // CfnMethodへの上書きだけでは既存Stageに反映されないため、Deploymentも更新する。
    api.latestDeployment.addToLogicalId({ streamingTimeoutInMillis: timeout.toMilliseconds() });
  }
  if (!count) throw new Error("Hostingのストリーミング統合が見つかりません");
}
