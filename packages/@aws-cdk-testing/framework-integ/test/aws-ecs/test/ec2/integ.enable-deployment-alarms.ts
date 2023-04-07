import * as autoscaling from 'aws-cdk-lib/aws-autoscaling';
import * as cloudwatch from '../../../aws-cloudwatch';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as cdk from 'aws-cdk-lib';
import * as integ from '@aws-cdk/integ-tests-alpha';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import { EcsMetric } from 'aws-cdk-lib/aws-ecs';

const app = new cdk.App();
const stack = new cdk.Stack(app, 'integ-enable-deployment-alarms');

const vpc = new ec2.Vpc(stack, 'Vpc', { maxAzs: 2 });

const taskDefinition = new ecs.Ec2TaskDefinition(stack, 'TaskDef');

taskDefinition.addContainer('web', {
  image: ecs.ContainerImage.fromRegistry('amazon/amazon-ecs-sample'),
  memoryReservationMiB: 256,
});

const autoScalingGroup = new autoscaling.AutoScalingGroup(stack, 'ASG', {
  vpc,
  instanceType: new ec2.InstanceType('t2.micro'),
  machineImage: ecs.EcsOptimizedImage.amazonLinux2(),
});

const cp = new ecs.AsgCapacityProvider(stack, 'EC2CapacityProvider', {
  autoScalingGroup,
  // This is to allow cdk destroy to work; otherwise deletion will hang bc ASG cannot be deleted
  enableManagedTerminationProtection: false,
});

const cluster = new ecs.Cluster(stack, 'EC2CPCluster', {
  vpc,
  enableFargateCapacityProviders: true,
});

cluster.addAsgCapacityProvider(cp);
const myAlarm = cloudwatch.Alarm.fromAlarmArn(stack, 'myAlarm', 'arn:aws:cloudwatch:us-east-1:372902930120:alarm:myAlarm');

const service = new ecs.Ec2Service(stack, 'EC2Service', {
  cluster,
  taskDefinition,
});
service.enableDeploymentAlarms({
  alarms: [myAlarm],
});
service.createEcsMetricAlarm(EcsMetric.MEMORY_RESERVATION, { useAsDeploymentAlarm: true });

new integ.IntegTest(app, 'EnableDeploymentAlarms', {
  testCases: [stack],
});
app.synth();