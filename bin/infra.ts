import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { ApplicationProtocol } from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as path from 'path';

const app = new cdk.App();

const stack = new cdk.Stack(app, 'EMD-FargateService15',
  { env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION } }
);

// Create VPC
const vpc = new ec2.Vpc(stack, 'VPC', {
  maxAzs: 2,
  natGateways: 1 // We could set this to 2 to setup a nat gateway per AZ, which would be ideal for prod workloads
});

function generateBucketName(stack: cdk.Stack): string {
  const environmentType = 'Development';
  const region = stack.region;
  const timestamp = new Date().valueOf();
  return `${environmentType}-${region}-${timestamp}`.toLowerCase();
}

const logBucket = new s3.Bucket(stack, 'LogBucket', {
  bucketName: generateBucketName(stack),
  removalPolicy: cdk.RemovalPolicy.DESTROY,
  enforceSSL: true,
  autoDeleteObjects: true,
  versioned: true,
});

// Create Security Group firewall settings
const albSecurityGroup = new ec2.SecurityGroup(stack, 'EMD-ALBSecurityGroup', {
  vpc,
  allowAllOutbound: false,
});

// Create Load Balancer
const alb = new elbv2.ApplicationLoadBalancer(stack, 'EMD-ApplicationLoadBalancer', {
  vpc: vpc,
  internetFacing: true,
  ipAddressType: elbv2.IpAddressType.IPV4,
  securityGroup: albSecurityGroup
});

alb.logAccessLogs(logBucket)

// Create Fargate Cluster
const cluster = new ecs.Cluster(stack, 'Cluster', { vpc });

// Create ECS Task Definition Template
const fargateTaskDefinition = new ecs.FargateTaskDefinition(stack, `EMD-FargateTaskDefinition`, {
  family: `EMD-CDK-fargateTaskDefinition`,
  cpu: 256,
  memoryLimitMiB: 512,
  runtimePlatform: {
    // This is set to ARM to match local development.
    // We'd pick the best architecture based on our requirements
    cpuArchitecture: ecs.CpuArchitecture.ARM64,
  },
});

// Create AWS Fargate Container
const fargateContainer = new ecs.ContainerDefinition(stack, `EMD-FargateContainer`, {
  taskDefinition: fargateTaskDefinition,
  containerName: 'EMD-FargateContainer',
  image: ecs.ContainerImage.fromAsset(path.resolve(__dirname, '../local-image')),
  portMappings: [
    {
      containerPort: 80,
      hostPort: 80,
      protocol: ecs.Protocol.TCP
    }
  ],
  environment: {
    FAVORITE_DESSERT: 'Bread Pudding',
  },
  logging: new ecs.AwsLogDriver({ streamPrefix: "infra" })
});

// Create Security Group firewall settings
const ec2SecurityGroup = new ec2.SecurityGroup(stack, 'EMD-EC2SecurityGroup', {
  vpc,
  allowAllOutbound: false
});

// TODO: We could limit outbound traffic to an ECR VPC Endpoint
ec2SecurityGroup.addEgressRule(
  ec2.Peer.ipv4('0.0.0.0/0'),
  ec2.Port.tcp(443),
  'Allow All HTTPS traffic outbound'
);

const service = new ecs.FargateService(stack, `EMD-ecs-service`, {
  assignPublicIp: true,
  cluster: cluster,
  taskDefinition: fargateTaskDefinition,
  platformVersion: ecs.FargatePlatformVersion.LATEST,
  vpcSubnets: {
    subnets: [
      vpc.privateSubnets[0],
      vpc.privateSubnets[1],
    ]
  },
  securityGroups: [ec2SecurityGroup]
});

// Add HTTP Listener
const httpListener = alb.addListener(`EMD-HTTPListner`, {
  port: 80,
  protocol: ApplicationProtocol.HTTP
});

// Add listener target 
httpListener.addTargets('EMD-ECS', {
  protocol: ApplicationProtocol.HTTP,
  targets: [service.loadBalancerTarget({
    containerName: 'EMD-FargateContainer'
  })],
});
