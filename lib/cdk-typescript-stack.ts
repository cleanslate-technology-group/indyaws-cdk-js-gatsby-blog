// import * as cdk from "aws-cdk-lib";
import { Stack, Duration, RemovalPolicy, StackProps } from "aws-cdk-lib";
import { DnsValidatedCertificate } from "aws-cdk-lib/aws-certificatemanager";
import * as cf from "aws-cdk-lib/aws-cloudfront";
import {
  AllowedMethods,
  HttpVersion,
  ViewerProtocolPolicy,
} from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import { ARecord, HostedZone, RecordTarget } from "aws-cdk-lib/aws-route53";
import { CloudFrontTarget } from "aws-cdk-lib/aws-route53-targets";
import * as s3 from "aws-cdk-lib/aws-s3";
import { BucketEncryption } from "aws-cdk-lib/aws-s3";
import * as s3Deploy from "aws-cdk-lib/aws-s3-deployment";
import { Construct } from "constructs";
import { Pipeline, Artifact } from "aws-cdk-lib/aws-codepipeline";
import {
  CodeBuildAction,
  CodeStarConnectionsSourceAction,
} from "aws-cdk-lib/aws-codepipeline-actions";
import * as codestar from "aws-cdk-lib/aws-codestarconnections";
import { CodePipeline } from "aws-cdk-lib/pipelines";
import { CodeBuildProject } from "aws-cdk-lib/aws-events-targets";
import { BuildSpec, PipelineProject } from "aws-cdk-lib/aws-codebuild";

interface CDKGatsbyStackProps extends StackProps {
  domain: string;
  subdomain?: string;
}

export class CDKGatsbyStack extends Stack {
  constructor(scope: Construct, id: string, props: CDKGatsbyStackProps) {
    super(scope, id, props);

    // S3 bucket to host static Gatsby Site
    const gatsbyBucket = new s3.Bucket(this, "GatsbyCDKSite", {
      bucketName: `${props.subdomain}.${props.domain}`,
      encryption: BucketEncryption.S3_MANAGED,
      publicReadAccess: true,
      versioned: true,
      removalPolicy: RemovalPolicy.RETAIN,
      websiteIndexDocument: "index.html",
      websiteErrorDocument: "404.html",
    });

    // Lifecycle Rule for S3 Bucket object versions
    gatsbyBucket.addLifecycleRule({
      enabled: true,
      noncurrentVersionsToRetain: 5,
      noncurrentVersionExpiration: Duration.days(60),
      abortIncompleteMultipartUploadAfter: Duration.days(10),
    });

    // Import existing hosted zone for adding subdomain
    // eg: cleanslatetg.cloud => garden.cleanslatetg.cloud
    const hz = HostedZone.fromLookup(this, "HostedZone", {
      domainName: props.domain,
    });

    // Create ACM Cert & Verify via DNS entry
    const certificate = new DnsValidatedCertificate(
      this,
      "GatsbyCDKCertificate",
      {
        domainName: `${props.subdomain}.${props.domain}`,
        subjectAlternativeNames: [`www.${props.subdomain}.${props.domain}`],
        hostedZone: hz,
        region: "us-east-1",
      }
    );

    // Create Cloudfront Origin Access Identity
    const originAccessIdentity = new cf.OriginAccessIdentity(
      this,
      "MyOriginAccessIdentity",
      {
        comment: "comment",
      }
    );

    // Create Cloudfront Distribution
    const distribution = new cf.Distribution(this, "GatsbyCDKDistribution", {
      certificate: certificate,
      defaultRootObject: "index.html",
      domainNames: [
        `${props.subdomain}.${props.domain}`,
        `www.${props.subdomain}.${props.domain}`,
      ],
      defaultBehavior: {
        origin: new origins.S3Origin(gatsbyBucket, { originAccessIdentity }),
        allowedMethods: AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      httpVersion: HttpVersion.HTTP2_AND_3,
    });

    // Create route53 record, pointing to distribution
    new ARecord(this, "GatsbyCDKAliasRecord", {
      zone: hz,
      target: RecordTarget.fromAlias(new CloudFrontTarget(distribution)),
      recordName: `${props.subdomain}.${props.domain}`,
    });

    // Create the www record, also pointing to the distribution
    new ARecord(this, "GatsbyCDKWWWAliasRecord", {
      zone: hz,
      target: RecordTarget.fromAlias(new CloudFrontTarget(distribution)),
      recordName: `www.${props.subdomain}.${props.domain}`,
    });

    // Create Sample Site on Asset Creation - Temporary only
    const deployment = new s3Deploy.BucketDeployment(this, "ExampleSite", {
      sources: [s3Deploy.Source.asset("./static")],
      destinationBucket: gatsbyBucket,
      distribution: distribution,
      distributionPaths: ["/*"],
    });

    // Create Codestar Connection
    // Note: This connection will be created in a pending state and must be completed on the AWS Console
    const codestarGithubConnection = new codestar.CfnConnection(
      this,
      "GatsbyCDKGithubConnection",
      {
        connectionName: "gatsbyCdkGithubConnection",
        providerType: "GitHub",
      }
    );

    // Create Code Pipeline
    const pipeline = new Pipeline(this, "GatsbyCDKPipeline", {
      pipelineName: "GatsbyCDKPipeline",
    });

    // Stage: Pull repo from Github
    const sourceOutput = new Artifact();

    const sourceAction = new CodeStarConnectionsSourceAction({
      actionName: "GithubSource",
      owner: "cleanslate-technology-group",
      repo: "indyaws-cdk-js-gatsby-blog",
      connectionArn: codestarGithubConnection.attrConnectionArn,
      output: sourceOutput,
      branch: "main",
    });

    const sourceStage = pipeline.addStage({
      stageName: "Source",
      actions: [sourceAction],
    });

    // Stage: Build Static Gatsby Site
    const buildArtifact = new Artifact();
    const buildGatsbySite = new PipelineProject(this, "StaticSiteBuild", {
      buildSpec: BuildSpec.fromObject({
        version: "0.2",
        phases: {
          install: {
            "runtime-versions": {
              nodejs: "latest",
            },
            commands: ["cd digital-garden", "yarn install"],
          },
        },
      }),
    });

    const buildAction = new CodeBuildAction({
      actionName: "BuildStaticSite",
      project: buildGatsbySite,
      input: sourceOutput,
      runOrder: 1,
      outputs: [buildArtifact],
    });

    const buildStage = pipeline.addStage({
      stageName: "Build",
      actions: [buildAction],
    });

    // Stage: Deploy Static Gatsby Site

    // Stage: Apply Cloudfront Invalidations
  }
}
