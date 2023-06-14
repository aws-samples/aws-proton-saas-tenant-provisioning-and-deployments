#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { ServerlessSaaSApplicationStack } from "../lib/serverless-saas-application-stack";

const app = new cdk.App();
new ServerlessSaaSApplicationStack(app, "ServerlessSaaSApplicationStack", {
  tenantId: "testTenant",
  lambdaReservedConcurrency: 100
});