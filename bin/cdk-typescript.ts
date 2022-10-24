#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { CDKGatsbyStack } from "../lib/cdk-typescript-stack";
import * as dotenv from "dotenv";
dotenv.config();

const app = new cdk.App();

const environment: string = process.env.ENVIRONMENT || "";
const duration: string = process.env.DURATION || "";
const purpose: string = process.env.PURPOSE || "";
const author: string = process.env.AUTHOR || "";
const githubOwner: string = process.env.GITHUB_OWNER || "";
const githubRepo: string = process.env.GITHUB_REPO || "";

new CDKGatsbyStack(app, "CDKGatsby", {
  env: { account: process.env.AWS_ACCOUNT, region: process.env.AWS_REGION },
  domain: process.env.DOMAIN || "",
  subdomain: process.env.SUBDOMAIN || "",
  githubRepo,
  githubOwner,
  tags: {
    environment,
    duration,
    cdk: "true",
    purpose,
    author,
  },
});
