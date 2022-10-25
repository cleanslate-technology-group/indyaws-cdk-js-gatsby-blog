# Welcome to a CDK Project that deploys a GatsbyJS Static Site

## How to use this project

Clone or fork this repository
Run `yarn install`
Create a `.env` file. This will not be checked into source control.
Using the `.env.sample` file as an example, populate the `.env` file with your desired values.

## How to deploy to AWS

Install the latest version of aws-cdk

`yarn add aws-cdk`

With credentials configured, run `cdk diff` to see the various resources that will be created.

When you're satisfied, run `cdk deploy` to provision the resources.

## How to connnect the pipeline built with cdk

There will be a CodeStar Connection in a pending state. To proceed, authorize the connection to read from your chosen Github repositiory. 

Once this is complete, changes you make when you create and publish new blog post will trigger a pipeline execution. This is configured to correctly deploy the GatsbyJS site currently inside the `digital-garden` directory.

## How to build and devlop the GatsbyJS site locally

Change directories into the `digital-garden` directory and install dependencies

`yarn install`

Run the development server, it will display a localhost url to live-edit the site

`yarn develop`

## How to publish content

From here, create and edit markdown files to publish content. Standard markdown works, including code blocks and images.

When your new post is ready, commit the changes to the repository and push your changes to Github. Within minutes the pipeline will build the site and invalidate the Cloudfront cache to quickly display your new content.

## Useful CDK commands

* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests
* `cdk deploy`      deploy this stack to your default AWS account/region
* `cdk diff`        compare deployed stack with current state
* `cdk synth`       emits the synthesized CloudFormation template

