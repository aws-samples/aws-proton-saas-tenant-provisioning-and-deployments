import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { StackProps, Tags } from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as logs from 'aws-cdk-lib/aws-logs';

export interface ServerlessSaaSAppProps extends StackProps {
  tenantId: string;
  lambdaArtifactFolder: string;
  lambdaArtifactBucket: string;
  lambdaArtifactKey: string;
  lambdaReservedConcurrency: number;
}

export class ServerlessSaaSApp extends Construct {
  constructor(scope: Construct, id: string, props: ServerlessSaaSAppProps) {
    super(scope, id);

    const tenantId = props.tenantId;
    const lambdaArtifactFolder = props.lambdaArtifactFolder;
    const lambdaArtifactBucket = props.lambdaArtifactBucket;
    const lambdaArtifactKey = props.lambdaArtifactKey;

    let handler;
    console.log(lambdaArtifactBucket);
    console.log(lambdaArtifactKey);
    
    if (lambdaArtifactBucket != "" && lambdaArtifactKey != "") {
      handler = new lambda.Function(this, tenantId + "Lambda", {
        runtime: lambda.Runtime.NODEJS_16_X,
        code: lambda.Code.fromBucket(
          s3.Bucket.fromBucketName(
            this,
            "ArtifactBucket",
            lambdaArtifactBucket
          ),
          lambdaArtifactKey
        ),
        handler: "hello_world.handler",
        reservedConcurrentExecutions: props.lambdaReservedConcurrency,
        environment: {
          TENANT_ID: tenantId,
        },
      });
    } else {
      handler = new lambda.Function(this, tenantId + "Lambda", {
        runtime: lambda.Runtime.NODEJS_16_X,
        code: lambda.Code.fromAsset(lambdaArtifactFolder),
        handler: "hello_world.handler",
        reservedConcurrentExecutions: props.lambdaReservedConcurrency,
        environment: {
          TENANT_ID: tenantId,
        },
      });
    }

    const prdLogGroup = new logs.LogGroup(this, "PrdLogs");

    const api = new apigateway.RestApi(this, tenantId + "-api", {
      restApiName: tenantId + "- service",
      description: "Sample REST Service for " + tenantId,
      deployOptions: {
        accessLogDestination: new apigateway.LogGroupLogDestination(prdLogGroup),
        accessLogFormat: apigateway.AccessLogFormat.jsonWithStandardFields(),
      },
    });

    const requestValidator = new apigateway.RequestValidator(this, 'SaaSApiRequestValidator', {
      restApi: api,
      requestValidatorName: 'requestValidatorName',
      validateRequestBody: false,
      validateRequestParameters: false,
    });

    Tags.of(api).add("TenantId", tenantId);

    const getIntegration = new apigateway.LambdaIntegration(handler, {
      requestTemplates: { "application/json": '{ "statusCode": "200" }' },
    });

    api.root.addMethod("GET", getIntegration);
  }
}
