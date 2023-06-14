import { App } from "aws-cdk-lib";
import { ServerlessServiceStack } from "../lib/serverless-service";
import input from "../proton-inputs.json";

const protonEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

const stackName = input.service_instance.name;

const app = new App();

new ServerlessServiceStack(app, "ServerlessService", {
  env: protonEnv,
  stackName: stackName,
});

app.synth();
