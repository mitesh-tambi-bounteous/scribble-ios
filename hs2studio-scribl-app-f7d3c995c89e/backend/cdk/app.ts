#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { ScriblStack } from "./scribl-stack";

const app = new cdk.App();
new ScriblStack(app, "ScriblPocStack", {
  description: "Scribl POC thin backend: API Gateway + Lambda + DynamoDB (foundation slice).",
});
