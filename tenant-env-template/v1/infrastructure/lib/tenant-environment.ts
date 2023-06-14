import { Stack, StackProps, CfnOutput, Tags, RemovalPolicy } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as autoscaling from "aws-cdk-lib/aws-autoscaling";
import * as iam from "aws-cdk-lib/aws-iam";
import * as s3 from "aws-cdk-lib/aws-s3";

import input from "../proton-inputs.json";

export class TenantEnvironmentStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);

    const environmentInputs = input.environment.inputs;
    const stackName = props.stackName ?? input.environment.name;
    const tenantId = environmentInputs.tenantId;

    const vpc = new ec2.Vpc(this, tenantId + "-VPC", {
      vpcName: stackName,
      ipAddresses: ec2.IpAddresses.cidr(environmentInputs.vpc_cidr_block),      
      maxAzs: 2,
    });

    let clusterInputs: any = {
      vpc: vpc,
      enableFargateCapacityProviders: true,
      containerInsights: environmentInputs.enhanced_cluster_monitoring,
      clusterName: stackName,
      defaultCloudMapNamespace: {
        name: environmentInputs.service_discovery_namespace,
      },
    };

    if (environmentInputs.allow_ecs_exec) {
      const ecsExecConfig: ecs.ExecuteCommandConfiguration = {
        logging: ecs.ExecuteCommandLogging.DEFAULT,
      };
      clusterInputs = { ...clusterInputs, ecsExecConfig };
    }

    const ecsCluster = new ecs.Cluster(this, tenantId + "-ECSCluster", clusterInputs);

    Tags.of(ecsCluster).add("TenantId", tenantId);

    if (environmentInputs.ec2_capacity) {
      const launchTemplate = new ec2.LaunchTemplate(
        this,
        "ASG-LaunchTemplate",
        {
          instanceType: new ec2.InstanceType(
            environmentInputs.ec2_instance_type
          ),
          machineImage: ecs.EcsOptimizedImage.amazonLinux2(),
          userData: ec2.UserData.forLinux(),
          role: new iam.Role(this, "LaunchTemplateEC2Role", {
            assumedBy: new iam.ServicePrincipal("ec2.amazonaws.com"),
          }),
        }
      );
      const autoScalingGroup = new autoscaling.AutoScalingGroup(this, "ASG", {
        vpc,
        mixedInstancesPolicy: {
          instancesDistribution: {
            onDemandPercentageAboveBaseCapacity: 50,
          },
          launchTemplate: launchTemplate,
        },
      });

      const clusterCP = new ecs.AsgCapacityProvider(
        this,
        "ECSCapacityProvider",
        {
          autoScalingGroup: autoScalingGroup,
          capacityProviderName: `${stackName}-cp`,
          enableManagedScaling: true,
          enableManagedTerminationProtection: true,
          machineImageType: ecs.MachineImageType.AMAZON_LINUX_2,
        }
      );

      ecsCluster.addAsgCapacityProvider(clusterCP);

      new CfnOutput(this, "EC2CapacityProvider", {
        value: clusterCP.capacityProviderName,
        exportName: `EC2CapacityProvider-${stackName}`,
      });
    }

    let clusterSecGrps: any = ecsCluster.connections.securityGroups.filter(
      function getId(x) {
        x.securityGroupId;
      }
    );

    if (clusterSecGrps.length === 0) {
      clusterSecGrps = "[]";
    }

    const accessLogsBucket = new s3.Bucket(this, 'AccessLogsBucket', {
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,      
    });

    const bucket = new s3.Bucket(this, tenantId + "-data", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: false,
      removalPolicy: RemovalPolicy.DESTROY,
      serverAccessLogsBucket: accessLogsBucket,
      serverAccessLogsPrefix: 'logs',
    });

    // CFN outputs for proton to expose
    new CfnOutput(this, "TenantId", {
      value: tenantId,
      exportName: `TenantId-${stackName}`,
    });
    new CfnOutput(this, "ECSClusterName", {
      value: ecsCluster.clusterName,
      exportName: `ECSClusterName-${stackName}`,
    });
    new CfnOutput(this, "ECSClusterArn", {
      value: ecsCluster.clusterArn,
      exportName: `ECSClusterArn-${stackName}`,
    });
    new CfnOutput(this, "ECSClusterSecGrps", {
      value: `${clusterSecGrps}`,
      exportName: `ECSClusterSecGrps-${stackName}`,
    });
    new CfnOutput(this, "ECSClusterSDNamespace", {
      value: ecsCluster.defaultCloudMapNamespace?.namespaceName ?? "None",
      exportName: `ServiceDiscoveryNS-${stackName}`,
    });
    new CfnOutput(this, "VPCId", {
      value: vpc.vpcId,
      exportName: `VPCID-${stackName}`,
    });
    new CfnOutput(this, "BucketName", {
      value: bucket.bucketName,
      exportName: `BucketName-${stackName}`,
    });
    new CfnOutput(this, "BucketArn", {
      value: bucket.bucketArn,
      exportName: `BucketArn-${stackName}`,
    });
  }
}
