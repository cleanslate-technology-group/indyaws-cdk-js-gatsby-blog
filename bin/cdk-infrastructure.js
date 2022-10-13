#!/usr/bin/env node

const cdk = require("aws-cdk-lib");
const { CDKGatsby } = require("../lib/cdk-infrastructure-stack");

const app = new cdk.App();

new CDKGatsby(app, "CDKGatsby", {
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
