import * as cdk from "aws-cdk-lib";
import { Duration, RemovalPolicy } from "aws-cdk-lib";
import { DnsValidatedCertificate } from "aws-cdk-lib/aws-certificatemanager";
import { HostedZone } from "aws-cdk-lib/aws-route53";
import * as s3 from "aws-cdk-lib/aws-s3";
import { BlockPublicAccess, BucketEncryption } from "aws-cdk-lib/aws-s3";
import * as s3Deploy from "aws-cdk-lib/aws-s3-deployment";
import { BucketDeployment, Source } from "aws-cdk-lib/aws-s3-deployment";
import { Construct } from "constructs";

interface CDKGatsbyStackProps extends cdk.StackProps {
  domain: string;
  subdomain?: string;
}

export class CDKGatsbyStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: CDKGatsbyStackProps) {
    super(scope, id, props);

    // S3 bucket to host static Gatsby Site
    const gatsbyBucket = new s3.Bucket(this, "GatsbyCDKSite", {
      bucketName: `${props.subdomain}.${props.domain}`,
      encryption: BucketEncryption.S3_MANAGED,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
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

    // Create Sample Site on Asset Creation
    const deployment = new s3Deploy.BucketDeployment(this, "ExampleSite", {
      sources: [s3Deploy.Source.asset("./static")],
      destinationBucket: gatsbyBucket,
    });

    // Import existing hosted zone for adding subdomain
    // eg: cleanslatetg.cloud => garden.cleanslatetg.cloud
    const hz = HostedZone.fromLookup(this, "HostedZone", {
      domainName: props.domain,
    });

    // Create ACM Cert & Verify via DNS entry
    // const certificate = new DnsValidatedCertificate(
    //   this,
    //   "GatsbyCDKCertificate",
    //   {
    //     domainName: `${props.subdomain}.${props.domain}`,
    //     hostedZone: hz,
    //     region: "us-east-1",
    //   }
    // );
  }
}
