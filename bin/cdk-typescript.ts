#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { CDKGatsbyStack } from "../lib/cdk-typescript-stack";

const app = new cdk.App();

new CDKGatsbyStack(app, "CDKGatsby", {
  env: { account: "310141637485", region: "us-east-2" },
  domain: "cleanslatetg.cloud",
  subdomain: "garden",
  tags: {
    environment: "prod",
    duration: "temporary",
    cdk: "true",
    purpose: "presentation",
    author: "david.poindexter@cleanslatetg.com",
  },
});
