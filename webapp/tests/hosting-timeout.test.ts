import assert from "node:assert/strict";
import test from "node:test";
import { App, Duration, Stack } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { LambdaIntegration, MockIntegration, ResponseTransferMode, RestApi } from "aws-cdk-lib/aws-apigateway";
import { Code, Function, Runtime } from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";
import { configureStreamingIntegrationTimeout } from "../infra/hostingTimeout";

function synth(seconds: number) {
  const stack = new Stack(new App(), "Test");
  const hosting = new Construct(stack, "Hosting");
  const fn = new Function(hosting, "Server", {
    runtime: Runtime.NODEJS_22_X, handler: "index.handler",
    code: Code.fromInline("exports.handler = async () => ({statusCode: 200});"),
    timeout: Duration.seconds(seconds),
  });
  const api = new RestApi(hosting, "SsrApi", { cloudWatchRole: false });
  const integration = new LambdaIntegration(fn, { responseTransferMode: ResponseTransferMode.STREAM });
  api.root.addMethod("ANY", integration);
  api.root.addResource("{proxy+}").addMethod("ANY", integration);
  const other = new RestApi(stack, "OtherApi", { cloudWatchRole: false });
  other.root.addMethod("GET", new MockIntegration());
  configureStreamingIntegrationTimeout(hosting, Duration.seconds(seconds));
  return Template.fromStack(stack).toJSON();
}

test("SSRのLambda・STREAM統合は5分で、他のAPIを変更しない", () => {
  const template = synth(300);
  const resources = Object.values(template.Resources) as any[];
  assert.equal(resources.find((r) => r.Type === "AWS::Lambda::Function").Properties.Timeout, 300);
  const methods = resources.filter((r) => r.Type === "AWS::ApiGateway::Method");
  const streaming = methods.filter((r) => r.Properties.Integration.ResponseTransferMode === "STREAM");
  assert.equal(streaming.length, 2);
  for (const method of streaming) assert.equal(method.Properties.Integration.TimeoutInMillis, 300000);
  assert.equal(methods.find((r) => r.Properties.Integration.Type === "MOCK").Properties.Integration.TimeoutInMillis, undefined);
});

test("STREAM統合のタイムアウト変更でSSR APIのDeploymentも更新する", () => {
  const deploymentId = (template: any) => Object.keys(template.Resources)
    .find((key) => key.startsWith("HostingSsrApiDeployment"));
  const before = deploymentId(synth(60));
  const after = deploymentId(synth(300));
  assert.ok(before);
  assert.ok(after);
  assert.notEqual(before, after);
});

test("対象のSTREAM統合がなければ、設定漏れをエラーにする", () => {
  const hosting = new Construct(new Stack(new App(), "Test"), "Hosting");
  assert.throws(() => configureStreamingIntegrationTimeout(hosting, Duration.minutes(5)), /ストリーミング統合が見つかりません/);
});
