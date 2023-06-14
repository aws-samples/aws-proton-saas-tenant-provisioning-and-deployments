import { Stack, StackProps, CfnOutput } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import input from "../proton-inputs.json";
import { ServerlessSaaSApp } from "./serverless-saas-app-construct";

export class ServerlessServiceStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);

    const environmentOutputs = input.environment;
    const instanceInputs = input.service_instance;

    // in case you want to associate lambda with VPC
    const importedVpc = ec2.Vpc.fromLookup(this, "VPCImport", {
      vpcId: environmentOutputs.outputs.VPCId,
    });
    
    const artifactbucket = instanceInputs.inputs.lambda_artifact_bucket != "" ? instanceInputs.inputs.lambda_artifact_bucket : environmentOutputs.outputs.BucketName;
    
    const serverlessSaaSApplication = new ServerlessSaaSApp(this, "SaaSApp", {
      tenantId: environmentOutputs.outputs.TenantId,
      lambdaArtifactFolder: "",
      lambdaArtifactBucket: artifactbucket, 
      lambdaArtifactKey: instanceInputs.inputs.lambda_artifact_key, 
      lambdaReservedConcurrency: instanceInputs.inputs.lambda_reserved_concurrency,
    });
  }
}
