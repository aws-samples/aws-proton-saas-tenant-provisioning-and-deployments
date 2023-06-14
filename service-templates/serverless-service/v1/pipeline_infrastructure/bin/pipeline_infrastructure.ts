#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { PipelineInfrastructureStack } from '../lib/pipeline_infrastructure-stack';
import input from "../proton-inputs.json";

const app = new cdk.App();
const service = input.service;

new PipelineInfrastructureStack(app, service.name + '-pipeline', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
});