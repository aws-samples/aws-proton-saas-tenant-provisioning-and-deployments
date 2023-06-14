import * as fs from 'fs';
import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as codepipeline_actions from 'aws-cdk-lib/aws-codepipeline-actions';
import * as stepfunctions from 'aws-cdk-lib/aws-stepfunctions';
import { StateMachine } from 'aws-cdk-lib/aws-stepfunctions';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Function, Runtime } from 'aws-cdk-lib/aws-lambda';
import { Duration } from 'aws-cdk-lib';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as logs from 'aws-cdk-lib/aws-logs';
import input from "../proton-inputs.json";

export class PipelineInfrastructureStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: cdk.StackProps) {
    super(scope, id, props);
    
    const aws_account_id = props?.env?.account
    const service = input.service;
    const service_instances = input.service_instances;
    const pipeline_inputs = input.pipeline.inputs
    const aws_region = cdk.Stack.of(this).region;
    
    const accessLogsBucket = new s3.Bucket(this, 'AccessLogsBucket', {
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true      
    });

    const artifactsBucket = new s3.Bucket(this, "ArtifactsBucket", {
          encryption: s3.BucketEncryption.S3_MANAGED,
          enforceSSL: true,
          serverAccessLogsBucket: accessLogsBucket,
          serverAccessLogsPrefix: 'logs',
      });
      
    // Pipeline creation starts
    const pipeline = new codepipeline.Pipeline(this, 'Pipeline', {
      pipelineName: service.name + '-pipeline',
      artifactBucket: artifactsBucket
    });
     
    
    // Declare source code as an artifact
    const sourceOutput = new codepipeline.Artifact('SourceArtifact');

    // Add source stage to pipeline
    pipeline.addStage({
      stageName: 'Source',
      actions: [
        new codepipeline_actions.CodeStarConnectionsSourceAction({
          actionName: 'CodeStarSource',
          owner: service.repository_id.split("/")[0],
          repo: service.repository_id.split("/")[1],
          output: sourceOutput,
          connectionArn: service.repository_connection_arn,
          branch: service.branch_name
        }),
      ],
    });
    
    
    //Build stage
    const buildOutput = new codepipeline.Artifact('BuildArtifact');
    
    //Declare a new CodeBuild project
    const buildProject = new codebuild.PipelineProject(this, 'Build', {
      buildSpec : codebuild.BuildSpec.fromSourceFilename(pipeline_inputs.buildspecfile),
      environment: {
        buildImage: codebuild.LinuxBuildImage.AMAZON_LINUX_2_3,                
      },
      environmentVariables: {
        'PACKAGE_BUCKET': {
          value: artifactsBucket.bucketName
        },
        'aws_account_id': {
          value: aws_account_id
        },        
        'service_name': {
          value: service.name
        },
        
      }
    });
    
    buildProject.addToRolePolicy(new iam.PolicyStatement({
      resources: ['*'],
      actions: [
        'ecr:*',
        'proton:ListTagsForResource',
        'proton:GetService'
      ],
    }));

    
    // Add the build stage to our pipeline
    pipeline.addStage({
      stageName: 'Build',
      actions: [
        new codepipeline_actions.CodeBuildAction({
          actionName: 'Build-Service',
          project: buildProject,
          input: sourceOutput,
          outputs: [buildOutput],
        }),
      ],
    });
    
    const stepfunctionLogGroup = new logs.LogGroup(this,'stepFunctionLG');

    const lambdaFunction = new Function(this, "WaveIterator", {
      handler: "iterator.lambda_handler",
      runtime: Runtime.PYTHON_3_9,
      code: lambda.Code.fromAsset("resources", {exclude: ['*.json']}),
      memorySize: 512,
      timeout: Duration.seconds(10),
  })
  
  const approvalQueue = new sqs.Queue(this, 'ApprovalQueue',{
    enforceSSL:true
  });

  const stepfunction_deploymentpolicy = new iam.PolicyDocument({
    statements: [
      new iam.PolicyStatement({
        resources: [
          approvalQueue.queueArn,
          lambdaFunction.functionArn,
          `${lambdaFunction.functionArn}:*`,
          `arn:aws:proton:${aws_region}:${aws_account_id}:service/${service.name}/*`,            
        ],
        actions: [
                    "proton:UpdateServiceInstance",
                    "lambda:InvokeFunction",
                    "proton:GetServiceInstance",
                    "sqs:SendMessage",                      
                ],
        }),
        new iam.PolicyStatement({
          resources: ["*"],                        
          actions: [
                      "logs:CreateLogDelivery",
                      "logs:CreateLogStream",
                      "logs:GetLogDelivery",
                      "logs:UpdateLogDelivery",
                      "logs:DeleteLogDelivery",
                      "logs:ListLogDeliveries",
                      "logs:PutLogEvents",
                      "logs:PutResourcePolicy",
                      "logs:DescribeResourcePolicies",
                      "logs:DescribeLogGroups"                      
                  ],
          }),
      ],
    });
    
    
    const stepfunction_deploymentrole = new iam.Role(this, 'StepFunctionRole', {
      assumedBy: new iam.ServicePrincipal('states.amazonaws.com'),
      description: 'Role assumed by deployment state machine',
      inlinePolicies: {
        deployment_policy: stepfunction_deploymentpolicy,
      },
    });
    
    const file = fs.readFileSync("./resources/deployemntstatemachine.asl.json");
    
    

    const deploymentstateMachine = new stepfunctions.CfnStateMachine(this, 'DeploymentCfnStateMachine', {
      roleArn: stepfunction_deploymentrole.roleArn,
      // the properties below are optional
      definitionString: file.toString(),
      definitionSubstitutions: {
        ITERATOR_LAMBDA_ARN: lambdaFunction.functionArn,
        APPROVAL_QUEUE_URL: approvalQueue.queueUrl,
        TOTAL_WAVES: pipeline_inputs.totalwaves.toString()
      },
      stateMachineName: service.name + '-deployment-pipeline',
      stateMachineType: 'STANDARD',
      tracingConfiguration: {
        enabled: true
      }, 
      loggingConfiguration: {         
        level: 'ERROR',
        destinations: [
          {
            cloudWatchLogsLogGroup: {logGroupArn: stepfunctionLogGroup.logGroupArn}
          }
        ]
      }
    });

    const stateMachine = StateMachine.fromStateMachineName(this, 'DeploymentStateMachine', service.name + '-deployment-pipeline');
    
    const stepFunctionAction = new codepipeline_actions.StepFunctionInvokeAction({
      actionName: 'InvokeStepFunc',
      stateMachine: stateMachine,
      stateMachineInput: codepipeline_actions.StateMachineInput.filePath(buildOutput.atPath('build_output.json'))
        
    });
    
    
    pipeline.addStage({
      stageName: 'InvokeStepFunctions',
      actions: [stepFunctionAction],
    });

    new cdk.CfnOutput(this, "PipelineEndpoint", {
      value: `https://${aws_region}.console.aws.amazon.com/codesuite/codepipeline/pipelines/${pipeline.pipelineName}/view?region=${aws_region}`,
    });
    
  }
}
