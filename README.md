># idkpopup.com Backend
idkpopup.com's backend registers a website contact, allows marketing campaigns to be sent to the customer and sends email and SMS notifications when a contact is registered, `ContactRouter` is an `AWS Lambda` function written in `node.js`. Upon putting an object to `S3`, the function tranfers JSON formated contacts from s3://{bucket}/contacts/web to `Pinpoint` as endpoints for digital customer engagement. The function then leverages `Amazon Pinpoint` to broadcast notifications to your email and SMS channels when new contacts are registered on the website.
<br><br>
The ContactRouter's infrastructural components include:
* `GitHub` for source control
* `IAM` for authorization
* `AWS Lambda` for execution
* `S3` for storage
* `Amazon Pinpoint` for digital customer engagement
* `ElasticBeanstalk` for deployment
* `AWS CloudFormation` for serverless creation
* `AWS CodePipelines` for CICD

<br><br>
># Instructions for the FrontEnd
If you haven't already, follow the website setup instructions here: https://github.com/idkpopup/website-frontend/blob/master/README.md

># For this GitHub repository
Fork this repository on GitHub as updates need to be made for new AWS accounts
<br><br>

Update `buildspec.xml` with your deployment bucket name. This bucket was created when creating the front-end and is used to hold website contacts.
```
aws cloudformation package --template-file template.yml --s3-bucket {bucket name} --output-template-file outputtemplate.yml
```

># Create a Amazon Pinpoint Project
In the AWS console, navigate to the `Pinpoint` service and create a project.

Once created, click `All Projects` to see your Pinpoint Project ID.

In the `Setting` for your project, setup `Email` and `SMS and voice` channels to receive notifications from `ContactRouter`.
<br><br>

># Environment Variables
Add the following environment variable.

## Windows
``` cmd
SET PINPOINT_PROJECT_ID `{your-pinpoint-project-id}`
SET CONTACTS_BUCKET `{your bucket name}`
SET PHONE '+1{your phone number to be notified on}'
SET EMAIL '{your email to be notified on}'
SET ORIGINATION_NUMBER '+1{your Pinpoint registered phone number found in the Pinpoin project's settings under SMS and voice}'
```

## Linux/Mac
``` terminal
SET PINPOINT_PROJECT_ID=`{your-pinpoint-project-id}`
SET CONTACTS_BUCKET=`{your bucket name}`
SET PHONE='+1{your phone number to be notified on}'
SET EMAIL='{your email to be notified on}'
SET ORIGINATION_NUMBER='+1{your Pinpoint registered phone number found in the Pinpoin project's settings under SMS and voice}'
```
<br><br>

># Run The Code
Test the code with either the `AWS Serverless Application Model(AWS SAM)`, or with a javascript debugger.
<br><br>

># Prepare CodePipeline (IAM)
Create a new role in `IAM` named `IDKpopup-website-backend`

Add an inline policy named `IDKpopup-website-backend-policy` to the role:
```
{
    "Statement": [
        {
            "Action": [
                "apigateway:*",
                "codedeploy:*",
                "lambda:*",
                "cloudformation:*",
                "iam:GetRole",
                "iam:CreateRole",
                "iam:DeleteRole",
                "iam:PutRolePolicy",
                "iam:AttachRolePolicy",
                "iam:DeleteRolePolicy",
                "iam:DetachRolePolicy",
                "iam:PassRole",
                "s3:*"
                
            ],
            "Resource": "*",
            "Effect": "Allow"
        }
    ],
    "Version": "2012-10-17"
}
```

Add the following trust relationship:
``` javascript
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "",
      "Effect": "Allow",
      "Principal": {
        "Service": [
          "codedeploy.amazonaws.com",
          "s3.amazonaws.com",
          "cloudformation.amazonaws.com"
        ]
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
```

># Configure CodePipeline
Create a new pipene with the following inputs:

Pipeline name: `IDKpopup-website-backend`

Service role: `New Service Role`

Click `Next`

Source: `GitHub`

Click `Connect to GitHub`.

Repository: {your-repository}

Branch: master

Click `Next`

Build provider: `AWS CodeBuild`

Click `Create project`

Project name: `IDKpopup-website-backend`

Environment image: `Managed image`

Operating system: `Ubuntu`

Runtime(s): `Standard`

Image: `aws/codebuild/standard:3.0`

Service role: `New service role`

Click `Continue to CodePipeline`

Deploy provider: `AWS CloudFormation`

Action mode: `Create or replace a change set`

Stack name: `IDKpopup-website-backend-stack`

Change set name: `IDKpopup-website-backend-changeset`

Template: `BuildArtifact`

File name: `outputtemplate.yml`

Capabilities: `CAPABILITY_IAM` and `CAPABILITY_AUTO_EXPAND`

Use the service role's ARN for the `IDKpopup-website-backend` role: 

In `CodePipeline` paste the role `ARN` into Role name.

Click `Next`

Click `Create Pipeline`

Monitor the deployment.

The build will fail due to missing policies when CodeBuild creates the service role. Update the `codebuild-IDKpopup-website-backend-service-role` role by attaching the `AmazonS3FullAccess` policy.

<br><br>

The deployment will be incomplete due to a missing CloudFormation deployment action which you are unable to setup during pipeline creation.
On the pipeline, click `Edit` and click `Edit stage` on the Deploy stage. Click `Add action group`.

Action Name: `Execute-Changeset`

Action Provider: `AWS CloudFormation`

Input Artifacts: `BuildArtifact`

Action mode: `Execute a change set`

Stack name: `IDKpopup-website-backend-stack`

Change set name: `IDKpopup-website-backend-changeset`

Click `Done`

Click `Done`

Click `Save`

Click `Release Change`

Monitor the deployment for completeion. Once complete, a `Lambda` function named `ContactRouter` will be created.
<br><br>

># Configure the Lammbda
Open the `Lambda` console and navigate to `ContactRouter`. 

Click `Add trigger`

Select `S3`

Bucket: {your bucket}

Event type: `contacts/web`

Name: `S3-to-ContactRouter`

Check `Multipart upload completed`

Prefix: `/contacts/web`

Click `Add`

In the Designer, select `ContactRouter` to view the Lambda properties.

Click `Manage environment variables`.

Click `Add environment variable`

Name `PINPOINT_PROJECT_ID`

Value: {your pinpoint application id}

Click `Add environment vairable`

NAME: `CONTACTS_BUCKET`

Value: {your bucket name}

Click `Add environment vairable`

Name: `EMAIL`

Value: {your email address}

Click `Add environment vairable`

Name: `PHONE`

Value: +1{your phone number}

Click `Add environment variable`

Name: `ORIGINATION_NUMBER`

Value: +1{your Amazon Pinpoint registered phone number found in the Pinpoint project's settings under SMS and voice}

Click `Save`

#> Configure Lambda's IAM role
The `ContactRouter` requires a set of permissions to leverage `Amazon Pinpoint`.

In the `Execution role` section of the Lambda console, click the link below `Existing role` to open the `IAM` role.

Attach an Inline Policy named `ContactRouter-Policy`:
```
{
    "Statement": [
        {
            "Action": [
                "mobiletargeting:*"
            ],
            "Resource": "*",
            "Effect": "Allow"
        }
    ],
    "Version": "2012-10-17"
}
```

And update the trust policy:
```
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": [
            "lambda.amazonaws.com", 
            "pinpoint.amazonaws.com"
        ]
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
```


># Deployment
A push to `GitHub` triggers a build in `CodePipeline` which downloads the repository and runs the `buildspec.yml` build instructions. This in turns updates the `Lambda function` and its code via `CloudFormation`.

Test the `ContactRouter` by submitting contact information on the website landing page using the link in `ElasticBeansta;l`. `S3` will have a JSON contact artifact in {bucket-name}/contacts/web. In `Amazon Pinpoint`, you can create a target `Segment` with 1 `endpoint` to send targetinged email or SMS marketing campaigns. You should also receive an email and SMS notification. If you don't see the email, check your spam folder. If you don't receive the email or SMS notification, check the `CloudWatch Logs` log group `aws/lambda/ContactRouter`.