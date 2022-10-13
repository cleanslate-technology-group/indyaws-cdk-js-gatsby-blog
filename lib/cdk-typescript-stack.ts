import * as cdk from "aws-cdk-lib";
import { Duration, RemovalPolicy } from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import { BlockPublicAccess, BucketEncryption } from "aws-cdk-lib/aws-s3";
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

    // Import existing hosted zone for adding subdomain
    // eg: cleanslatetg.cloud => garden.cleanslatetg.cloud
  }
}
