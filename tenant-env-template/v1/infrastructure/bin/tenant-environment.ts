import { App } from "aws-cdk-lib";
import { TenantEnvironmentStack } from "../lib/tenant-environment";
import input from "../proton-inputs.json";

const tenantEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

const stackName = input.environment.name;

const app = new App();

new TenantEnvironmentStack(app, "TenantEnv", {
  env: tenantEnv,
  stackName: stackName,
});

app.synth();
