"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TenantEnvironmentStack = void 0;
const aws_cdk_lib_1 = require("aws-cdk-lib");
const ecs = __importStar(require("aws-cdk-lib/aws-ecs"));
const ec2 = __importStar(require("aws-cdk-lib/aws-ec2"));
const autoscaling = __importStar(require("aws-cdk-lib/aws-autoscaling"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const s3 = __importStar(require("aws-cdk-lib/aws-s3"));
const proton_inputs_json_1 = __importDefault(require("../proton-inputs.json"));
class TenantEnvironmentStack extends aws_cdk_lib_1.Stack {
    constructor(scope, id, props) {
        var _a, _b, _c;
        super(scope, id, props);
        const environmentInputs = proton_inputs_json_1.default.environment.inputs;
        const stackName = (_a = props.stackName) !== null && _a !== void 0 ? _a : proton_inputs_json_1.default.environment.name;
        const tenantId = environmentInputs.tenantId;
        const vpc = new ec2.Vpc(this, tenantId + "-VPC", {
            vpcName: stackName,
            ipAddresses: ec2.IpAddresses.cidr(environmentInputs.vpc_cidr_block),
            maxAzs: 2,
        });
        let clusterInputs = {
            vpc: vpc,
            enableFargateCapacityProviders: true,
            containerInsights: environmentInputs.enhanced_cluster_monitoring,
            clusterName: stackName,
            defaultCloudMapNamespace: {
                name: environmentInputs.service_discovery_namespace,
            },
        };
        if (environmentInputs.allow_ecs_exec) {
            const ecsExecConfig = {
                logging: ecs.ExecuteCommandLogging.DEFAULT,
            };
            clusterInputs = { ...clusterInputs, ecsExecConfig };
        }
        const ecsCluster = new ecs.Cluster(this, tenantId + "-ECSCluster", clusterInputs);
        aws_cdk_lib_1.Tags.of(ecsCluster).add("TenantId", tenantId);
        if (environmentInputs.ec2_capacity) {
            const launchTemplate = new ec2.LaunchTemplate(this, "ASG-LaunchTemplate", {
                instanceType: new ec2.InstanceType(environmentInputs.ec2_instance_type),
                machineImage: ecs.EcsOptimizedImage.amazonLinux2(),
                userData: ec2.UserData.forLinux(),
                role: new iam.Role(this, "LaunchTemplateEC2Role", {
                    assumedBy: new iam.ServicePrincipal("ec2.amazonaws.com"),
                }),
            });
            const autoScalingGroup = new autoscaling.AutoScalingGroup(this, "ASG", {
                vpc,
                mixedInstancesPolicy: {
                    instancesDistribution: {
                        onDemandPercentageAboveBaseCapacity: 50,
                    },
                    launchTemplate: launchTemplate,
                },
            });
            const clusterCP = new ecs.AsgCapacityProvider(this, "ECSCapacityProvider", {
                autoScalingGroup: autoScalingGroup,
                capacityProviderName: `${stackName}-cp`,
                enableManagedScaling: true,
                enableManagedTerminationProtection: true,
                machineImageType: ecs.MachineImageType.AMAZON_LINUX_2,
            });
            ecsCluster.addAsgCapacityProvider(clusterCP);
            new aws_cdk_lib_1.CfnOutput(this, "EC2CapacityProvider", {
                value: clusterCP.capacityProviderName,
                exportName: `EC2CapacityProvider-${stackName}`,
            });
        }
        let clusterSecGrps = ecsCluster.connections.securityGroups.filter(function getId(x) {
            x.securityGroupId;
        });
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
            removalPolicy: aws_cdk_lib_1.RemovalPolicy.DESTROY,
            serverAccessLogsBucket: accessLogsBucket,
            serverAccessLogsPrefix: 'logs',
        });
        // CFN outputs for proton to expose
        new aws_cdk_lib_1.CfnOutput(this, "TenantId", {
            value: tenantId,
            exportName: `TenantId-${stackName}`,
        });
        new aws_cdk_lib_1.CfnOutput(this, "ECSClusterName", {
            value: ecsCluster.clusterName,
            exportName: `ECSClusterName-${stackName}`,
        });
        new aws_cdk_lib_1.CfnOutput(this, "ECSClusterArn", {
            value: ecsCluster.clusterArn,
            exportName: `ECSClusterArn-${stackName}`,
        });
        new aws_cdk_lib_1.CfnOutput(this, "ECSClusterSecGrps", {
            value: `${clusterSecGrps}`,
            exportName: `ECSClusterSecGrps-${stackName}`,
        });
        new aws_cdk_lib_1.CfnOutput(this, "ECSClusterSDNamespace", {
            value: (_c = (_b = ecsCluster.defaultCloudMapNamespace) === null || _b === void 0 ? void 0 : _b.namespaceName) !== null && _c !== void 0 ? _c : "None",
            exportName: `ServiceDiscoveryNS-${stackName}`,
        });
        new aws_cdk_lib_1.CfnOutput(this, "VPCId", {
            value: vpc.vpcId,
            exportName: `VPCID-${stackName}`,
        });
        new aws_cdk_lib_1.CfnOutput(this, "BucketName", {
            value: bucket.bucketName,
            exportName: `BucketName-${stackName}`,
        });
        new aws_cdk_lib_1.CfnOutput(this, "BucketArn", {
            value: bucket.bucketArn,
            exportName: `BucketArn-${stackName}`,
        });
    }
}
exports.TenantEnvironmentStack = TenantEnvironmentStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVuYW50LWVudmlyb25tZW50LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsidGVuYW50LWVudmlyb25tZW50LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsNkNBQWdGO0FBRWhGLHlEQUEyQztBQUMzQyx5REFBMkM7QUFDM0MseUVBQTJEO0FBQzNELHlEQUEyQztBQUMzQyx1REFBeUM7QUFFekMsK0VBQTBDO0FBRTFDLE1BQWEsc0JBQXVCLFNBQVEsbUJBQUs7SUFDL0MsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUFpQjs7UUFDekQsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsTUFBTSxpQkFBaUIsR0FBRyw0QkFBSyxDQUFDLFdBQVcsQ0FBQyxNQUFNLENBQUM7UUFDbkQsTUFBTSxTQUFTLEdBQUcsTUFBQSxLQUFLLENBQUMsU0FBUyxtQ0FBSSw0QkFBSyxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUM7UUFDNUQsTUFBTSxRQUFRLEdBQUcsaUJBQWlCLENBQUMsUUFBUSxDQUFDO1FBRTVDLE1BQU0sR0FBRyxHQUFHLElBQUksR0FBRyxDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsUUFBUSxHQUFHLE1BQU0sRUFBRTtZQUMvQyxPQUFPLEVBQUUsU0FBUztZQUNsQixXQUFXLEVBQUUsR0FBRyxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsaUJBQWlCLENBQUMsY0FBYyxDQUFDO1lBQ25FLE1BQU0sRUFBRSxDQUFDO1NBQ1YsQ0FBQyxDQUFDO1FBRUgsSUFBSSxhQUFhLEdBQVE7WUFDdkIsR0FBRyxFQUFFLEdBQUc7WUFDUiw4QkFBOEIsRUFBRSxJQUFJO1lBQ3BDLGlCQUFpQixFQUFFLGlCQUFpQixDQUFDLDJCQUEyQjtZQUNoRSxXQUFXLEVBQUUsU0FBUztZQUN0Qix3QkFBd0IsRUFBRTtnQkFDeEIsSUFBSSxFQUFFLGlCQUFpQixDQUFDLDJCQUEyQjthQUNwRDtTQUNGLENBQUM7UUFFRixJQUFJLGlCQUFpQixDQUFDLGNBQWMsRUFBRTtZQUNwQyxNQUFNLGFBQWEsR0FBb0M7Z0JBQ3JELE9BQU8sRUFBRSxHQUFHLENBQUMscUJBQXFCLENBQUMsT0FBTzthQUMzQyxDQUFDO1lBQ0YsYUFBYSxHQUFHLEVBQUUsR0FBRyxhQUFhLEVBQUUsYUFBYSxFQUFFLENBQUM7U0FDckQ7UUFFRCxNQUFNLFVBQVUsR0FBRyxJQUFJLEdBQUcsQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLFFBQVEsR0FBRyxhQUFhLEVBQUUsYUFBYSxDQUFDLENBQUM7UUFFbEYsa0JBQUksQ0FBQyxFQUFFLENBQUMsVUFBVSxDQUFDLENBQUMsR0FBRyxDQUFDLFVBQVUsRUFBRSxRQUFRLENBQUMsQ0FBQztRQUU5QyxJQUFJLGlCQUFpQixDQUFDLFlBQVksRUFBRTtZQUNsQyxNQUFNLGNBQWMsR0FBRyxJQUFJLEdBQUcsQ0FBQyxjQUFjLENBQzNDLElBQUksRUFDSixvQkFBb0IsRUFDcEI7Z0JBQ0UsWUFBWSxFQUFFLElBQUksR0FBRyxDQUFDLFlBQVksQ0FDaEMsaUJBQWlCLENBQUMsaUJBQWlCLENBQ3BDO2dCQUNELFlBQVksRUFBRSxHQUFHLENBQUMsaUJBQWlCLENBQUMsWUFBWSxFQUFFO2dCQUNsRCxRQUFRLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxRQUFRLEVBQUU7Z0JBQ2pDLElBQUksRUFBRSxJQUFJLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLHVCQUF1QixFQUFFO29CQUNoRCxTQUFTLEVBQUUsSUFBSSxHQUFHLENBQUMsZ0JBQWdCLENBQUMsbUJBQW1CLENBQUM7aUJBQ3pELENBQUM7YUFDSCxDQUNGLENBQUM7WUFDRixNQUFNLGdCQUFnQixHQUFHLElBQUksV0FBVyxDQUFDLGdCQUFnQixDQUFDLElBQUksRUFBRSxLQUFLLEVBQUU7Z0JBQ3JFLEdBQUc7Z0JBQ0gsb0JBQW9CLEVBQUU7b0JBQ3BCLHFCQUFxQixFQUFFO3dCQUNyQixtQ0FBbUMsRUFBRSxFQUFFO3FCQUN4QztvQkFDRCxjQUFjLEVBQUUsY0FBYztpQkFDL0I7YUFDRixDQUFDLENBQUM7WUFFSCxNQUFNLFNBQVMsR0FBRyxJQUFJLEdBQUcsQ0FBQyxtQkFBbUIsQ0FDM0MsSUFBSSxFQUNKLHFCQUFxQixFQUNyQjtnQkFDRSxnQkFBZ0IsRUFBRSxnQkFBZ0I7Z0JBQ2xDLG9CQUFvQixFQUFFLEdBQUcsU0FBUyxLQUFLO2dCQUN2QyxvQkFBb0IsRUFBRSxJQUFJO2dCQUMxQixrQ0FBa0MsRUFBRSxJQUFJO2dCQUN4QyxnQkFBZ0IsRUFBRSxHQUFHLENBQUMsZ0JBQWdCLENBQUMsY0FBYzthQUN0RCxDQUNGLENBQUM7WUFFRixVQUFVLENBQUMsc0JBQXNCLENBQUMsU0FBUyxDQUFDLENBQUM7WUFFN0MsSUFBSSx1QkFBUyxDQUFDLElBQUksRUFBRSxxQkFBcUIsRUFBRTtnQkFDekMsS0FBSyxFQUFFLFNBQVMsQ0FBQyxvQkFBb0I7Z0JBQ3JDLFVBQVUsRUFBRSx1QkFBdUIsU0FBUyxFQUFFO2FBQy9DLENBQUMsQ0FBQztTQUNKO1FBRUQsSUFBSSxjQUFjLEdBQVEsVUFBVSxDQUFDLFdBQVcsQ0FBQyxjQUFjLENBQUMsTUFBTSxDQUNwRSxTQUFTLEtBQUssQ0FBQyxDQUFDO1lBQ2QsQ0FBQyxDQUFDLGVBQWUsQ0FBQztRQUNwQixDQUFDLENBQ0YsQ0FBQztRQUVGLElBQUksY0FBYyxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUU7WUFDL0IsY0FBYyxHQUFHLElBQUksQ0FBQztTQUN2QjtRQUVELE1BQU0sZ0JBQWdCLEdBQUcsSUFBSSxFQUFFLENBQUMsTUFBTSxDQUFDLElBQUksRUFBRSxrQkFBa0IsRUFBRTtZQUMvRCxVQUFVLEVBQUUsRUFBRSxDQUFDLGdCQUFnQixDQUFDLFVBQVU7WUFDMUMsVUFBVSxFQUFFLElBQUk7U0FDakIsQ0FBQyxDQUFDO1FBRUgsTUFBTSxNQUFNLEdBQUcsSUFBSSxFQUFFLENBQUMsTUFBTSxDQUFDLElBQUksRUFBRSxRQUFRLEdBQUcsT0FBTyxFQUFFO1lBQ3JELGlCQUFpQixFQUFFLEVBQUUsQ0FBQyxpQkFBaUIsQ0FBQyxTQUFTO1lBQ2pELFVBQVUsRUFBRSxFQUFFLENBQUMsZ0JBQWdCLENBQUMsVUFBVTtZQUMxQyxVQUFVLEVBQUUsSUFBSTtZQUNoQixTQUFTLEVBQUUsS0FBSztZQUNoQixhQUFhLEVBQUUsMkJBQWEsQ0FBQyxPQUFPO1lBQ3BDLHNCQUFzQixFQUFFLGdCQUFnQjtZQUN4QyxzQkFBc0IsRUFBRSxNQUFNO1NBQy9CLENBQUMsQ0FBQztRQUVILG1DQUFtQztRQUNuQyxJQUFJLHVCQUFTLENBQUMsSUFBSSxFQUFFLFVBQVUsRUFBRTtZQUM5QixLQUFLLEVBQUUsUUFBUTtZQUNmLFVBQVUsRUFBRSxZQUFZLFNBQVMsRUFBRTtTQUNwQyxDQUFDLENBQUM7UUFDSCxJQUFJLHVCQUFTLENBQUMsSUFBSSxFQUFFLGdCQUFnQixFQUFFO1lBQ3BDLEtBQUssRUFBRSxVQUFVLENBQUMsV0FBVztZQUM3QixVQUFVLEVBQUUsa0JBQWtCLFNBQVMsRUFBRTtTQUMxQyxDQUFDLENBQUM7UUFDSCxJQUFJLHVCQUFTLENBQUMsSUFBSSxFQUFFLGVBQWUsRUFBRTtZQUNuQyxLQUFLLEVBQUUsVUFBVSxDQUFDLFVBQVU7WUFDNUIsVUFBVSxFQUFFLGlCQUFpQixTQUFTLEVBQUU7U0FDekMsQ0FBQyxDQUFDO1FBQ0gsSUFBSSx1QkFBUyxDQUFDLElBQUksRUFBRSxtQkFBbUIsRUFBRTtZQUN2QyxLQUFLLEVBQUUsR0FBRyxjQUFjLEVBQUU7WUFDMUIsVUFBVSxFQUFFLHFCQUFxQixTQUFTLEVBQUU7U0FDN0MsQ0FBQyxDQUFDO1FBQ0gsSUFBSSx1QkFBUyxDQUFDLElBQUksRUFBRSx1QkFBdUIsRUFBRTtZQUMzQyxLQUFLLEVBQUUsTUFBQSxNQUFBLFVBQVUsQ0FBQyx3QkFBd0IsMENBQUUsYUFBYSxtQ0FBSSxNQUFNO1lBQ25FLFVBQVUsRUFBRSxzQkFBc0IsU0FBUyxFQUFFO1NBQzlDLENBQUMsQ0FBQztRQUNILElBQUksdUJBQVMsQ0FBQyxJQUFJLEVBQUUsT0FBTyxFQUFFO1lBQzNCLEtBQUssRUFBRSxHQUFHLENBQUMsS0FBSztZQUNoQixVQUFVLEVBQUUsU0FBUyxTQUFTLEVBQUU7U0FDakMsQ0FBQyxDQUFDO1FBQ0gsSUFBSSx1QkFBUyxDQUFDLElBQUksRUFBRSxZQUFZLEVBQUU7WUFDaEMsS0FBSyxFQUFFLE1BQU0sQ0FBQyxVQUFVO1lBQ3hCLFVBQVUsRUFBRSxjQUFjLFNBQVMsRUFBRTtTQUN0QyxDQUFDLENBQUM7UUFDSCxJQUFJLHVCQUFTLENBQUMsSUFBSSxFQUFFLFdBQVcsRUFBRTtZQUMvQixLQUFLLEVBQUUsTUFBTSxDQUFDLFNBQVM7WUFDdkIsVUFBVSxFQUFFLGFBQWEsU0FBUyxFQUFFO1NBQ3JDLENBQUMsQ0FBQztJQUNMLENBQUM7Q0FDRjtBQTNJRCx3REEySUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBTdGFjaywgU3RhY2tQcm9wcywgQ2ZuT3V0cHV0LCBUYWdzLCBSZW1vdmFsUG9saWN5IH0gZnJvbSBcImF3cy1jZGstbGliXCI7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tIFwiY29uc3RydWN0c1wiO1xuaW1wb3J0ICogYXMgZWNzIGZyb20gXCJhd3MtY2RrLWxpYi9hd3MtZWNzXCI7XG5pbXBvcnQgKiBhcyBlYzIgZnJvbSBcImF3cy1jZGstbGliL2F3cy1lYzJcIjtcbmltcG9ydCAqIGFzIGF1dG9zY2FsaW5nIGZyb20gXCJhd3MtY2RrLWxpYi9hd3MtYXV0b3NjYWxpbmdcIjtcbmltcG9ydCAqIGFzIGlhbSBmcm9tIFwiYXdzLWNkay1saWIvYXdzLWlhbVwiO1xuaW1wb3J0ICogYXMgczMgZnJvbSBcImF3cy1jZGstbGliL2F3cy1zM1wiO1xuXG5pbXBvcnQgaW5wdXQgZnJvbSBcIi4uL3Byb3Rvbi1pbnB1dHMuanNvblwiO1xuXG5leHBvcnQgY2xhc3MgVGVuYW50RW52aXJvbm1lbnRTdGFjayBleHRlbmRzIFN0YWNrIHtcbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IFN0YWNrUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgIGNvbnN0IGVudmlyb25tZW50SW5wdXRzID0gaW5wdXQuZW52aXJvbm1lbnQuaW5wdXRzO1xuICAgIGNvbnN0IHN0YWNrTmFtZSA9IHByb3BzLnN0YWNrTmFtZSA/PyBpbnB1dC5lbnZpcm9ubWVudC5uYW1lO1xuICAgIGNvbnN0IHRlbmFudElkID0gZW52aXJvbm1lbnRJbnB1dHMudGVuYW50SWQ7XG5cbiAgICBjb25zdCB2cGMgPSBuZXcgZWMyLlZwYyh0aGlzLCB0ZW5hbnRJZCArIFwiLVZQQ1wiLCB7XG4gICAgICB2cGNOYW1lOiBzdGFja05hbWUsXG4gICAgICBpcEFkZHJlc3NlczogZWMyLklwQWRkcmVzc2VzLmNpZHIoZW52aXJvbm1lbnRJbnB1dHMudnBjX2NpZHJfYmxvY2spLCAgICAgIFxuICAgICAgbWF4QXpzOiAyLFxuICAgIH0pO1xuXG4gICAgbGV0IGNsdXN0ZXJJbnB1dHM6IGFueSA9IHtcbiAgICAgIHZwYzogdnBjLFxuICAgICAgZW5hYmxlRmFyZ2F0ZUNhcGFjaXR5UHJvdmlkZXJzOiB0cnVlLFxuICAgICAgY29udGFpbmVySW5zaWdodHM6IGVudmlyb25tZW50SW5wdXRzLmVuaGFuY2VkX2NsdXN0ZXJfbW9uaXRvcmluZyxcbiAgICAgIGNsdXN0ZXJOYW1lOiBzdGFja05hbWUsXG4gICAgICBkZWZhdWx0Q2xvdWRNYXBOYW1lc3BhY2U6IHtcbiAgICAgICAgbmFtZTogZW52aXJvbm1lbnRJbnB1dHMuc2VydmljZV9kaXNjb3ZlcnlfbmFtZXNwYWNlLFxuICAgICAgfSxcbiAgICB9O1xuXG4gICAgaWYgKGVudmlyb25tZW50SW5wdXRzLmFsbG93X2Vjc19leGVjKSB7XG4gICAgICBjb25zdCBlY3NFeGVjQ29uZmlnOiBlY3MuRXhlY3V0ZUNvbW1hbmRDb25maWd1cmF0aW9uID0ge1xuICAgICAgICBsb2dnaW5nOiBlY3MuRXhlY3V0ZUNvbW1hbmRMb2dnaW5nLkRFRkFVTFQsXG4gICAgICB9O1xuICAgICAgY2x1c3RlcklucHV0cyA9IHsgLi4uY2x1c3RlcklucHV0cywgZWNzRXhlY0NvbmZpZyB9O1xuICAgIH1cblxuICAgIGNvbnN0IGVjc0NsdXN0ZXIgPSBuZXcgZWNzLkNsdXN0ZXIodGhpcywgdGVuYW50SWQgKyBcIi1FQ1NDbHVzdGVyXCIsIGNsdXN0ZXJJbnB1dHMpO1xuXG4gICAgVGFncy5vZihlY3NDbHVzdGVyKS5hZGQoXCJUZW5hbnRJZFwiLCB0ZW5hbnRJZCk7XG5cbiAgICBpZiAoZW52aXJvbm1lbnRJbnB1dHMuZWMyX2NhcGFjaXR5KSB7XG4gICAgICBjb25zdCBsYXVuY2hUZW1wbGF0ZSA9IG5ldyBlYzIuTGF1bmNoVGVtcGxhdGUoXG4gICAgICAgIHRoaXMsXG4gICAgICAgIFwiQVNHLUxhdW5jaFRlbXBsYXRlXCIsXG4gICAgICAgIHtcbiAgICAgICAgICBpbnN0YW5jZVR5cGU6IG5ldyBlYzIuSW5zdGFuY2VUeXBlKFxuICAgICAgICAgICAgZW52aXJvbm1lbnRJbnB1dHMuZWMyX2luc3RhbmNlX3R5cGVcbiAgICAgICAgICApLFxuICAgICAgICAgIG1hY2hpbmVJbWFnZTogZWNzLkVjc09wdGltaXplZEltYWdlLmFtYXpvbkxpbnV4MigpLFxuICAgICAgICAgIHVzZXJEYXRhOiBlYzIuVXNlckRhdGEuZm9yTGludXgoKSxcbiAgICAgICAgICByb2xlOiBuZXcgaWFtLlJvbGUodGhpcywgXCJMYXVuY2hUZW1wbGF0ZUVDMlJvbGVcIiwge1xuICAgICAgICAgICAgYXNzdW1lZEJ5OiBuZXcgaWFtLlNlcnZpY2VQcmluY2lwYWwoXCJlYzIuYW1hem9uYXdzLmNvbVwiKSxcbiAgICAgICAgICB9KSxcbiAgICAgICAgfVxuICAgICAgKTtcbiAgICAgIGNvbnN0IGF1dG9TY2FsaW5nR3JvdXAgPSBuZXcgYXV0b3NjYWxpbmcuQXV0b1NjYWxpbmdHcm91cCh0aGlzLCBcIkFTR1wiLCB7XG4gICAgICAgIHZwYyxcbiAgICAgICAgbWl4ZWRJbnN0YW5jZXNQb2xpY3k6IHtcbiAgICAgICAgICBpbnN0YW5jZXNEaXN0cmlidXRpb246IHtcbiAgICAgICAgICAgIG9uRGVtYW5kUGVyY2VudGFnZUFib3ZlQmFzZUNhcGFjaXR5OiA1MCxcbiAgICAgICAgICB9LFxuICAgICAgICAgIGxhdW5jaFRlbXBsYXRlOiBsYXVuY2hUZW1wbGF0ZSxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuXG4gICAgICBjb25zdCBjbHVzdGVyQ1AgPSBuZXcgZWNzLkFzZ0NhcGFjaXR5UHJvdmlkZXIoXG4gICAgICAgIHRoaXMsXG4gICAgICAgIFwiRUNTQ2FwYWNpdHlQcm92aWRlclwiLFxuICAgICAgICB7XG4gICAgICAgICAgYXV0b1NjYWxpbmdHcm91cDogYXV0b1NjYWxpbmdHcm91cCxcbiAgICAgICAgICBjYXBhY2l0eVByb3ZpZGVyTmFtZTogYCR7c3RhY2tOYW1lfS1jcGAsXG4gICAgICAgICAgZW5hYmxlTWFuYWdlZFNjYWxpbmc6IHRydWUsXG4gICAgICAgICAgZW5hYmxlTWFuYWdlZFRlcm1pbmF0aW9uUHJvdGVjdGlvbjogdHJ1ZSxcbiAgICAgICAgICBtYWNoaW5lSW1hZ2VUeXBlOiBlY3MuTWFjaGluZUltYWdlVHlwZS5BTUFaT05fTElOVVhfMixcbiAgICAgICAgfVxuICAgICAgKTtcblxuICAgICAgZWNzQ2x1c3Rlci5hZGRBc2dDYXBhY2l0eVByb3ZpZGVyKGNsdXN0ZXJDUCk7XG5cbiAgICAgIG5ldyBDZm5PdXRwdXQodGhpcywgXCJFQzJDYXBhY2l0eVByb3ZpZGVyXCIsIHtcbiAgICAgICAgdmFsdWU6IGNsdXN0ZXJDUC5jYXBhY2l0eVByb3ZpZGVyTmFtZSxcbiAgICAgICAgZXhwb3J0TmFtZTogYEVDMkNhcGFjaXR5UHJvdmlkZXItJHtzdGFja05hbWV9YCxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGxldCBjbHVzdGVyU2VjR3JwczogYW55ID0gZWNzQ2x1c3Rlci5jb25uZWN0aW9ucy5zZWN1cml0eUdyb3Vwcy5maWx0ZXIoXG4gICAgICBmdW5jdGlvbiBnZXRJZCh4KSB7XG4gICAgICAgIHguc2VjdXJpdHlHcm91cElkO1xuICAgICAgfVxuICAgICk7XG5cbiAgICBpZiAoY2x1c3RlclNlY0dycHMubGVuZ3RoID09PSAwKSB7XG4gICAgICBjbHVzdGVyU2VjR3JwcyA9IFwiW11cIjtcbiAgICB9XG5cbiAgICBjb25zdCBhY2Nlc3NMb2dzQnVja2V0ID0gbmV3IHMzLkJ1Y2tldCh0aGlzLCAnQWNjZXNzTG9nc0J1Y2tldCcsIHtcbiAgICAgIGVuY3J5cHRpb246IHMzLkJ1Y2tldEVuY3J5cHRpb24uUzNfTUFOQUdFRCxcbiAgICAgIGVuZm9yY2VTU0w6IHRydWUsICAgICAgXG4gICAgfSk7XG5cbiAgICBjb25zdCBidWNrZXQgPSBuZXcgczMuQnVja2V0KHRoaXMsIHRlbmFudElkICsgXCItZGF0YVwiLCB7XG4gICAgICBibG9ja1B1YmxpY0FjY2VzczogczMuQmxvY2tQdWJsaWNBY2Nlc3MuQkxPQ0tfQUxMLFxuICAgICAgZW5jcnlwdGlvbjogczMuQnVja2V0RW5jcnlwdGlvbi5TM19NQU5BR0VELFxuICAgICAgZW5mb3JjZVNTTDogdHJ1ZSxcbiAgICAgIHZlcnNpb25lZDogZmFsc2UsXG4gICAgICByZW1vdmFsUG9saWN5OiBSZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgICBzZXJ2ZXJBY2Nlc3NMb2dzQnVja2V0OiBhY2Nlc3NMb2dzQnVja2V0LFxuICAgICAgc2VydmVyQWNjZXNzTG9nc1ByZWZpeDogJ2xvZ3MnLFxuICAgIH0pO1xuXG4gICAgLy8gQ0ZOIG91dHB1dHMgZm9yIHByb3RvbiB0byBleHBvc2VcbiAgICBuZXcgQ2ZuT3V0cHV0KHRoaXMsIFwiVGVuYW50SWRcIiwge1xuICAgICAgdmFsdWU6IHRlbmFudElkLFxuICAgICAgZXhwb3J0TmFtZTogYFRlbmFudElkLSR7c3RhY2tOYW1lfWAsXG4gICAgfSk7XG4gICAgbmV3IENmbk91dHB1dCh0aGlzLCBcIkVDU0NsdXN0ZXJOYW1lXCIsIHtcbiAgICAgIHZhbHVlOiBlY3NDbHVzdGVyLmNsdXN0ZXJOYW1lLFxuICAgICAgZXhwb3J0TmFtZTogYEVDU0NsdXN0ZXJOYW1lLSR7c3RhY2tOYW1lfWAsXG4gICAgfSk7XG4gICAgbmV3IENmbk91dHB1dCh0aGlzLCBcIkVDU0NsdXN0ZXJBcm5cIiwge1xuICAgICAgdmFsdWU6IGVjc0NsdXN0ZXIuY2x1c3RlckFybixcbiAgICAgIGV4cG9ydE5hbWU6IGBFQ1NDbHVzdGVyQXJuLSR7c3RhY2tOYW1lfWAsXG4gICAgfSk7XG4gICAgbmV3IENmbk91dHB1dCh0aGlzLCBcIkVDU0NsdXN0ZXJTZWNHcnBzXCIsIHtcbiAgICAgIHZhbHVlOiBgJHtjbHVzdGVyU2VjR3Jwc31gLFxuICAgICAgZXhwb3J0TmFtZTogYEVDU0NsdXN0ZXJTZWNHcnBzLSR7c3RhY2tOYW1lfWAsXG4gICAgfSk7XG4gICAgbmV3IENmbk91dHB1dCh0aGlzLCBcIkVDU0NsdXN0ZXJTRE5hbWVzcGFjZVwiLCB7XG4gICAgICB2YWx1ZTogZWNzQ2x1c3Rlci5kZWZhdWx0Q2xvdWRNYXBOYW1lc3BhY2U/Lm5hbWVzcGFjZU5hbWUgPz8gXCJOb25lXCIsXG4gICAgICBleHBvcnROYW1lOiBgU2VydmljZURpc2NvdmVyeU5TLSR7c3RhY2tOYW1lfWAsXG4gICAgfSk7XG4gICAgbmV3IENmbk91dHB1dCh0aGlzLCBcIlZQQ0lkXCIsIHtcbiAgICAgIHZhbHVlOiB2cGMudnBjSWQsXG4gICAgICBleHBvcnROYW1lOiBgVlBDSUQtJHtzdGFja05hbWV9YCxcbiAgICB9KTtcbiAgICBuZXcgQ2ZuT3V0cHV0KHRoaXMsIFwiQnVja2V0TmFtZVwiLCB7XG4gICAgICB2YWx1ZTogYnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICBleHBvcnROYW1lOiBgQnVja2V0TmFtZS0ke3N0YWNrTmFtZX1gLFxuICAgIH0pO1xuICAgIG5ldyBDZm5PdXRwdXQodGhpcywgXCJCdWNrZXRBcm5cIiwge1xuICAgICAgdmFsdWU6IGJ1Y2tldC5idWNrZXRBcm4sXG4gICAgICBleHBvcnROYW1lOiBgQnVja2V0QXJuLSR7c3RhY2tOYW1lfWAsXG4gICAgfSk7XG4gIH1cbn1cbiJdfQ==