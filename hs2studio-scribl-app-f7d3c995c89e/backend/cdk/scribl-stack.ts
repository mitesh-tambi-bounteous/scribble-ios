/**
 * Scribl POC stack: one DynamoDB table, one HTTP API, three Lambda routes.
 *
 * NOTE on ADR 0004: production's system of record is Aurora Serverless v2
 * (Postgres). This POC slice intentionally uses DynamoDB (per the brief and
 * project CLAUDE.md) to demonstrate AC1/AC2/AC4 cheaply via CDK; see
 * lambda/data/schema.ts for the access-pattern rationale and the swap seam.
 */
import * as path from "node:path";
import { Duration, Stack, StackProps } from "aws-cdk-lib";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import * as integrations from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import type { Construct } from "constructs";

export class ScriblStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // Single-table design (PK/SK). See lambda/data/schema.ts for the full
    // access-pattern catalog (prompt, submission, channel response,
    // membership) this key shape supports.
    const table = new dynamodb.Table(this, "ScriblTable", {
      tableName: "scribl-poc-table",
      partitionKey: { name: "pk", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "sk", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    });

    const lambdaDir = path.join(__dirname, "..", "lambda", "handlers");
    const commonEnv = {
      SCRIBL_TABLE_NAME: table.tableName,
      // Postgres (Neon) is the live store for the slice; DATABASE_URL is
      // read from the environment / CDK context at synth time — never
      // hardcoded. "mock" remains available for local/test use.
      SCRIBL_DATA_MODE: "postgres",
      DATABASE_URL: process.env.DATABASE_URL ?? this.node.tryGetContext("databaseUrl") ?? "",
      // BF-11: thread the fire-and-forget enhancement pipeline's env vars
      // into every Lambda so a deployed function actually has them (read at
      // trigger.ts / enhance/service.ts / enhance/image/factory.ts). NOTE:
      // fire-and-forget (void async IIFE in trigger.ts) does not survive a
      // Lambda execution environment freeze/recycle after the handler
      // returns — there is no guarantee the enhancement work finishes before
      // the environment is frozen or reclaimed. Making this reliable needs a
      // real async boundary (e.g. SQS + a dedicated enhance Lambda); out of
      // scope for this diagnostics-only fix.
      ENHANCE_ENABLED: process.env.ENHANCE_ENABLED ?? this.node.tryGetContext("enhanceEnabled") ?? "",
      IMAGE_PROVIDER: process.env.IMAGE_PROVIDER ?? this.node.tryGetContext("imageProvider") ?? "stub",
      OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? this.node.tryGetContext("openaiApiKey") ?? "",
      IMAGE_API_KEY: process.env.IMAGE_API_KEY ?? this.node.tryGetContext("imageApiKey") ?? "",
      IMAGE_MODEL: process.env.IMAGE_MODEL ?? this.node.tryGetContext("imageModel") ?? "",
      // Claude provider (packages/claude-provider-adapter/factory.ts
      // providerConfigFromEnv), used by enhance/service.ts's describeImage
      // step.
      CLAUDE_PROVIDER: process.env.CLAUDE_PROVIDER ?? this.node.tryGetContext("claudeProvider") ?? "stub",
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? this.node.tryGetContext("anthropicApiKey") ?? "",
    };

    const todayPromptFn = new NodejsFunction(this, "TodayPromptFn", {
      entry: path.join(lambdaDir, "today-prompt.ts"),
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: Duration.seconds(10),
      environment: commonEnv,
    });

    const promptByDateFn = new NodejsFunction(this, "PromptByDateFn", {
      entry: path.join(lambdaDir, "prompt-by-date.ts"),
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: Duration.seconds(10),
      environment: commonEnv,
    });

    const submitFn = new NodejsFunction(this, "SubmitFn", {
      entry: path.join(lambdaDir, "submit.ts"),
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: Duration.seconds(10),
      environment: commonEnv,
    });

    const channelResponsesFn = new NodejsFunction(this, "ChannelResponsesFn", {
      entry: path.join(lambdaDir, "channel-responses.ts"),
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: Duration.seconds(10),
      environment: commonEnv,
    });

    const authSignupFn = new NodejsFunction(this, "AuthSignupFn", {
      entry: path.join(lambdaDir, "auth-signup.ts"),
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: Duration.seconds(10),
      environment: commonEnv,
    });

    const authLoginFn = new NodejsFunction(this, "AuthLoginFn", {
      entry: path.join(lambdaDir, "auth-login.ts"),
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: Duration.seconds(10),
      environment: commonEnv,
    });

    const usersListFn = new NodejsFunction(this, "UsersListFn", {
      entry: path.join(lambdaDir, "users-list.ts"),
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: Duration.seconds(10),
      environment: commonEnv,
    });

    const wallsListFn = new NodejsFunction(this, "WallsListFn", {
      entry: path.join(lambdaDir, "walls-list.ts"),
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: Duration.seconds(10),
      environment: commonEnv,
    });

    const wallsCreateFn = new NodejsFunction(this, "WallsCreateFn", {
      entry: path.join(lambdaDir, "walls-create.ts"),
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: Duration.seconds(10),
      environment: commonEnv,
    });

    const channelMembersFn = new NodejsFunction(this, "ChannelMembersFn", {
      entry: path.join(lambdaDir, "channel-members.ts"),
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: Duration.seconds(10),
      environment: commonEnv,
    });

    // BF-15: POST /channels/{id}/members (invite) was previously only wired
    // in local-server.ts, not CDK — added here alongside the new DELETE
    // (self-leave) route so both match local-server.ts.
    const channelRosterFn = new NodejsFunction(this, "ChannelRosterFn", {
      entry: path.join(lambdaDir, "channel-roster.ts"),
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: Duration.seconds(10),
      environment: commonEnv,
    });

    const channelDaysFn = new NodejsFunction(this, "ChannelDaysFn", {
      entry: path.join(lambdaDir, "channel-days.ts"),
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: Duration.seconds(10),
      environment: commonEnv,
    });

    const memberAddFn = new NodejsFunction(this, "MemberAddFn", {
      entry: path.join(lambdaDir, "member-add.ts"),
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: Duration.seconds(10),
      environment: commonEnv,
    });

    const memberRemoveFn = new NodejsFunction(this, "MemberRemoveFn", {
      entry: path.join(lambdaDir, "member-remove.ts"),
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: Duration.seconds(10),
      environment: commonEnv,
    });

    const userUpdateFn = new NodejsFunction(this, "UserUpdateFn", {
      entry: path.join(lambdaDir, "user-update.ts"),
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: Duration.seconds(10),
      environment: commonEnv,
    });

    const responseUpdateFn = new NodejsFunction(this, "ResponseUpdateFn", {
      entry: path.join(lambdaDir, "response-update.ts"),
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: Duration.seconds(10),
      environment: commonEnv,
    });

    // Foundation slice grants read access broadly for the live endpoint;
    // submit/channel-responses now route through Postgres (see commonEnv);
    // the DynamoDB table read grant remains for the mock-mode fallback path.
    table.grantReadData(todayPromptFn);

    const httpApi = new apigwv2.HttpApi(this, "ScriblHttpApi", {
      apiName: "scribl-poc-api",
    });

    httpApi.addRoutes({
      path: "/prompt/today",
      methods: [apigwv2.HttpMethod.GET],
      integration: new integrations.HttpLambdaIntegration(
        "TodayPromptIntegration",
        todayPromptFn,
      ),
    });

    httpApi.addRoutes({
      path: "/prompt/{date}",
      methods: [apigwv2.HttpMethod.GET],
      integration: new integrations.HttpLambdaIntegration(
        "PromptByDateIntegration",
        promptByDateFn,
      ),
    });

    httpApi.addRoutes({
      path: "/submit",
      methods: [apigwv2.HttpMethod.POST],
      integration: new integrations.HttpLambdaIntegration("SubmitIntegration", submitFn),
    });

    httpApi.addRoutes({
      path: "/channels/{id}/responses",
      methods: [apigwv2.HttpMethod.GET],
      integration: new integrations.HttpLambdaIntegration(
        "ChannelResponsesIntegration",
        channelResponsesFn,
      ),
    });

    httpApi.addRoutes({
      path: "/channels/{id}/members",
      methods: [apigwv2.HttpMethod.GET],
      integration: new integrations.HttpLambdaIntegration(
        "ChannelMembersIntegration",
        channelMembersFn,
      ),
    });

    httpApi.addRoutes({
      path: "/channels/{id}/days",
      methods: [apigwv2.HttpMethod.GET],
      integration: new integrations.HttpLambdaIntegration(
        "ChannelDaysIntegration",
        channelDaysFn,
      ),
    });

    httpApi.addRoutes({
      path: "/channels/{id}/roster",
      methods: [apigwv2.HttpMethod.GET],
      integration: new integrations.HttpLambdaIntegration(
        "ChannelRosterIntegration",
        channelRosterFn,
      ),
    });

    httpApi.addRoutes({
      path: "/channels/{id}/members",
      methods: [apigwv2.HttpMethod.POST],
      integration: new integrations.HttpLambdaIntegration(
        "MemberAddIntegration",
        memberAddFn,
      ),
    });

    httpApi.addRoutes({
      path: "/channels/{id}/members",
      methods: [apigwv2.HttpMethod.DELETE],
      integration: new integrations.HttpLambdaIntegration(
        "MemberRemoveIntegration",
        memberRemoveFn,
      ),
    });

    httpApi.addRoutes({
      path: "/auth/signup",
      methods: [apigwv2.HttpMethod.POST],
      integration: new integrations.HttpLambdaIntegration(
        "AuthSignupIntegration",
        authSignupFn,
      ),
    });

    httpApi.addRoutes({
      path: "/auth/login",
      methods: [apigwv2.HttpMethod.POST],
      integration: new integrations.HttpLambdaIntegration("AuthLoginIntegration", authLoginFn),
    });

    httpApi.addRoutes({
      path: "/users",
      methods: [apigwv2.HttpMethod.GET],
      integration: new integrations.HttpLambdaIntegration("UsersListIntegration", usersListFn),
    });

    httpApi.addRoutes({
      path: "/walls",
      methods: [apigwv2.HttpMethod.GET],
      integration: new integrations.HttpLambdaIntegration("WallsListIntegration", wallsListFn),
    });

    httpApi.addRoutes({
      path: "/walls",
      methods: [apigwv2.HttpMethod.POST],
      integration: new integrations.HttpLambdaIntegration(
        "WallsCreateIntegration",
        wallsCreateFn,
      ),
    });

    httpApi.addRoutes({
      path: "/users/{id}",
      methods: [apigwv2.HttpMethod.PATCH],
      integration: new integrations.HttpLambdaIntegration(
        "UserUpdateIntegration",
        userUpdateFn,
      ),
    });

    httpApi.addRoutes({
      path: "/channels/{id}/responses/{responseId}",
      methods: [apigwv2.HttpMethod.PATCH],
      integration: new integrations.HttpLambdaIntegration(
        "ResponseUpdateIntegration",
        responseUpdateFn,
      ),
    });
  }
}
