import { Stack, StackProps, CfnOutput } from "aws-cdk-lib";
import { Construct } from "constructs";
import { EcsAlbStack } from "./load-balancer";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from 'aws-cdk-lib/aws-iam';
import input from "../proton-inputs.json";

export class EcsFargateServiceStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);

    const environmentOutputs = input.environment;
    const instanceInputs = input.service_instance;
    const serviceName = input.service.name;
    const stackName = props.stackName ?? input.environment.name;
    const taskSize = setTaskSize();

    const importedVpc = ec2.Vpc.fromLookup(this, "VPCImport", {
      vpcId: environmentOutputs.outputs.VPCId,
    });

    const importedCluster = ecs.Cluster.fromClusterAttributes(
      this,
      "ClusterImport",
      {
        clusterName: environmentOutputs.outputs.ECSClusterName,
        vpc: importedVpc,
        securityGroups: JSON.parse(
          environmentOutputs.outputs.ECSClusterSecGrps
        ),
      }
    );

    function setTaskSize() {
      if (instanceInputs.inputs.task_size === "x-small") {
        return {
          cpu: 256,
          memory: 512,
        };
      } else if (instanceInputs.inputs.task_size === "small") {
        return {
          cpu: 512,
          memory: 1024,
        };
      } else if (instanceInputs.inputs.task_size === "medium") {
        return {
          cpu: 1024,
          memory: 2048,
        };
      } else if (instanceInputs.inputs.task_size === "large") {
        return {
          cpu: 2048,
          memory: 4096,
        };
      } else if (instanceInputs.inputs.task_size === "x-large") {
        return {
          cpu: 4096,
          memory: 8192,
        };
      } else {
        return {
          cpu: 256,
          memory: 512,
        };
      }
    }
    
    const task_executionpolicy = new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          resources: ["*"],
          actions: [
                      "ecr:BatchGetImage",
                      "ecr:GetDownloadUrlForLayer",
                      "ecr:GetAuthorizationToken"                  ],
          }),
      ],
    });

    const fargate_executionrole = new iam.Role(this, 'FargateTaskExecutionRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      description: 'FargaeTaskExecutionRole',
      inlinePolicies: {
        deployment_policy: task_executionpolicy,
      },
    });
    
    const taskDef = new ecs.FargateTaskDefinition(this, "TaskDef", {
      cpu: taskSize.cpu,
      memoryLimitMiB: taskSize.memory,
      executionRole: fargate_executionrole
    });
    
    
    
    const containerDef = taskDef.addContainer("main", {
      image: ecs.ContainerImage.fromRegistry(instanceInputs.inputs.image),
      portMappings: [{ containerPort: instanceInputs.inputs.port }],
      logging: ecs.LogDriver.awsLogs({
        streamPrefix: `ecs-${instanceInputs.name}`,
      }),
    });

    const ecsService = new ecs.FargateService(this, "EcsFargateSvc", {
      taskDefinition: taskDef,
      enableExecuteCommand: true,
      vpcSubnets: importedVpc.selectSubnets({
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      }),
      cluster: importedCluster,
      circuitBreaker: {
        rollback: false,
      },
      desiredCount: instanceInputs.inputs.desired_count,
    });

    if (instanceInputs.inputs.load_balanced) {
      const alb = new EcsAlbStack(this, "LB", {
        containerPort: instanceInputs.inputs.port,
        listenerPort: 80,
        public: instanceInputs.inputs.load_balanced_public,
        vpc: importedVpc,
        stackName: stackName,
      });
      ecsService.attachToApplicationTargetGroup(alb.targetGroup);
      ecsService.connections.allowFrom(
        alb.lbSecGrp,
        ec2.Port.tcp(instanceInputs.inputs.port)
      );
    }
  }
}
