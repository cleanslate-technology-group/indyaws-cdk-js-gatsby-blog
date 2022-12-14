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
import { BucketAccessControl, BucketEncryption } from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";
import { Pipeline, Artifact } from "aws-cdk-lib/aws-codepipeline";
import {
  CodeBuildAction,
  CodeStarConnectionsSourceAction,
  S3DeployAction,
} from "aws-cdk-lib/aws-codepipeline-actions";
import * as codestar from "aws-cdk-lib/aws-codestarconnections";
import { BuildSpec, PipelineProject } from "aws-cdk-lib/aws-codebuild";
import {
  Effect,
  PolicyStatement,
  Role,
  ServicePrincipal,
} from "aws-cdk-lib/aws-iam";

interface CDKGatsbyStackProps extends StackProps {
  domain: string;
  subdomain: string;
  githubOwner: string;
  githubRepo: string;
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
      websiteErrorDocument: "index.html",
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
        region: "us-east-1", //Must use this region for the certificat
      }
    );

    // Create Cloudfront Origin Access Identity
    const originAccessIdentity = new cf.OriginAccessIdentity(
      this,
      "MyOriginAccessIdentity",
      {
        comment: "comment", //purely optional comment about OAI
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

    // Create Codestar Connection
    // Note: This connection will be created in a pending state and must be completed on the AWS Console
    const codestarGithubConnection = new codestar.CfnConnection(
      this,
      "GatsbyCDKGithubConnection",
      {
        connectionName: "gatsby-cdk-github",
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
      owner: props.githubOwner,
      repo: props.githubRepo,
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
            commands: ["n 16.14.0", "cd digital-garden", "yarn install"],
          },
          build: {
            commands: ["n 16.14.0", "yarn build"],
          },
        },
        artifacts: {
          "base-directory": "digital-garden/public",
          files: ["**/*"],
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
    const deployAction = new S3DeployAction({
      bucket: gatsbyBucket,
      input: buildArtifact,
      actionName: "Deploy-To-S3",
      accessControl: BucketAccessControl.PUBLIC_READ,
      runOrder: 1,
    });

    const deployStage = pipeline.addStage({
      stageName: "Deploy",
      actions: [deployAction],
    });

    // Stage: Apply Cloudfront Invalidations
    const cfInvalidateIamRole = new Role(this, "GatbsyCDKInvalidateRole", {
      assumedBy: new ServicePrincipal("codebuild.amazonaws.com"),
    });

    cfInvalidateIamRole.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        resources: [
          `arn:aws:cloudfront::${this.account}:distribution/${distribution.distributionId}`,
        ],
        actions: ["cloudfront:CreateInvalidation"],
      })
    );

    const invalidateSite = new PipelineProject(this, "StaticSiteInvalidate", {
      role: cfInvalidateIamRole,
      buildSpec: BuildSpec.fromObject({
        version: "0.2",
        phases: {
          build: {
            commands: [
              `aws cloudfront create-invalidation --distribution-id ${distribution.distributionId} --paths '/*'`,
            ],
          },
        },
      }),
    });

    const invalidateAction = new CodeBuildAction({
      actionName: "InvalidateStaticSite",
      project: invalidateSite,
      input: buildArtifact,
      runOrder: 1,
    });

    const invalidateStage = pipeline.addStage({
      stageName: "Invalidate",
      actions: [invalidateAction],
    });
  }
}
