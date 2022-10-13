import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";

interface CDKGatsbyStackProps extends cdk.StackProps {
  domain: string;
  subdomain?: string;
}

export class CDKGatsbyStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: CDKGatsbyStackProps) {
    super(scope, id, props);
  }
}
