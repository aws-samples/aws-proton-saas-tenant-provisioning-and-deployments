import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { StackProps, Tags } from "aws-cdk-lib";

import { ServerlessSaaSApp } from "../../service-templates/serverless-service/v1/instance_infrastructure/lib/serverless-saas-app-construct";

export interface ServerlessSaaSApplicationStackProps extends StackProps {
  tenantId: string;
  lambdaReservedConcurrency: number;
}

export class ServerlessSaaSApplicationStack extends cdk.Stack {
  constructor(
    scope: Construct,
    id: string,
    props: ServerlessSaaSApplicationStackProps
  ) {
    super(scope, id, props);
    const serverlessSaaSApp = new ServerlessSaaSApp(this, "ServerlessSaaSApp", {
      tenantId: props.tenantId,
      lambdaArtifactFolder: "./lambda_functions",
      lambdaArtifactBucket: "",
      lambdaArtifactKey: "",
      lambdaReservedConcurrency: props.lambdaReservedConcurrency,
    });
  }
}
