import * as cdk from 'aws-cdk-lib';
import {aws_iam, aws_personalize, CfnParameter} from 'aws-cdk-lib';
import {Construct} from 'constructs';
import {Effect, ManagedPolicy} from "aws-cdk-lib/aws-iam";
import * as cr from "aws-cdk-lib/custom-resources";


export class PersonalizeCdkSampleStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        const personalizeInteractionsS3 = new CfnParameter(this, "PersonalizeInteractionsFile", {
            description: 'S3 path'
        })
        const personalizeItemsS3 = new CfnParameter(this, "PersonalizeItemsFile", {
            description: 'S3 path'
        })
        const personalizeUsersS3 = new CfnParameter(this, "PersonalizeUsersFile", {
            description: 'S3 path'
        })
        const buildFirstSolutionVersion = new CfnParameter(this, "BuildSolutionVersion", {
            allowedValues: ['Yes', 'No'],
            default: 'No'
        });

        const personalizePrincipal = new aws_iam.ServicePrincipal("personalize.amazonaws.com")
        const personalizeIamRole = new aws_iam.Role(this, 'PersonalizeIAMRole', {
            roleName: 'demo-personalize-role',
            assumedBy: personalizePrincipal,
            managedPolicies: [
                ManagedPolicy.fromAwsManagedPolicyName("AmazonS3ReadOnlyAccess")
            ]
        });
        const customResourceLambdaRole = new aws_iam.Role(this, 'CustomResourceLambdaRole', {
            roleName: 'demo-cr-lambda-role',
            assumedBy: new aws_iam.ServicePrincipal('lambda.amazonaws.com'),
            inlinePolicies: {
                PersonalizeAccess: new aws_iam.PolicyDocument({
                    statements: [
                        new aws_iam.PolicyStatement({
                            effect: Effect.ALLOW,
                            actions: ['personalize:*'],
                            resources: ['*']
                        })
                    ]
                })
            }
        });
        /*
        //TODO: unable to add service principal to bucket policy, assets folder also relies on KMS key from cdk bootstrap
        const personalizeInteractions = new aws_s3_assets.Asset(this, "PersonalizeInteractions", {
            path: path.join(__dirname, 'data/personalize_user_interaction.csv')
        })
        //new cdk.CfnOutput(this, 'PersonalizeInteractionsS3', {value: personalizeInteractions.s3ObjectUrl});

        const personalizeItems = new aws_s3_assets.Asset(this, "PersonalizeItems", {
            path: path.join(__dirname, 'data/personalize_item_metadata.csv')
        })

       // new cdk.CfnOutput(this, 'PersonalizeItemsS3', {value: personalizeItems.s3ObjectUrl});

        const personalizeUsers = new aws_s3_assets.Asset(this, "PersonalizeUsers", {
            path: path.join(__dirname, 'data/personalize_user_metadata.csv')
        })
        //new cdk.CfnOutput(this, 'PersonalizeUsersS3', {value: personalizeUsers.s3ObjectUrl});
        */


        const datasetGroup = new aws_personalize.CfnDatasetGroup(this, "PersonalizeDataSetGroup", {
            name: 'demo-dataset-group'
        });

        const interactionsSchema = new aws_personalize.CfnSchema(this, "InteractionsSchema", {
            name: "demo-interactions-schema",
            schema: JSON.stringify({
                type: 'record',
                name: 'Interactions',
                namespace: 'com.amazonaws.personalize.schema',
                fields: [
                    {
                        name: 'USER_ID',
                        type: 'string'
                    },
                    {
                        name: 'ITEM_ID',
                        type: 'string'
                    },
                    {
                        name: 'TIMESTAMP',
                        type: 'long'
                    }
                ],
                version: '1.0'
            })
        });
        const interactionsDataset = new aws_personalize.CfnDataset(this, "InteractionsDataset", {
            name: 'demo-interactions-dataset',
            datasetType: 'Interactions',
            schemaArn: interactionsSchema.attrSchemaArn,
            datasetGroupArn: datasetGroup.attrDatasetGroupArn,
            datasetImportJob: {
                jobName: 'demo-interactions-dataset-import',
                roleArn: personalizeIamRole.roleArn,
                dataSource: {
                    DataLocation: personalizeInteractionsS3.valueAsString
                }
            }
        });

        const itemSchema = new aws_personalize.CfnSchema(this, "ItemSchema", {
            name: 'demo-item-schema',
            schema: JSON.stringify({
                type: "record",
                name: "Items",
                namespace: "com.amazonaws.personalize.schema",
                fields: [
                    {
                        name: "ITEM_ID",
                        type: "string"
                    },
                    {
                        name: "MOVIE_TITLE",
                        type: "string",
                        categorical: true
                    },
                    {
                        name: "GENRE",
                        type: "string",
                        categorical: true
                    },
                    {
                        name: "RELEASE_DATE",
                        type: "string",
                        categorical: true
                    }
                ],
                version: "1.0"
            })
        });

        const itemDataset = new aws_personalize.CfnDataset(this, "ItemDataset", {
            name: 'demo-item-dataset',
            datasetType: "Items",
            schemaArn: itemSchema.attrSchemaArn,
            datasetGroupArn: datasetGroup.attrDatasetGroupArn,
            datasetImportJob: {
                jobName: 'demo-item-dataset-import',
                roleArn: personalizeIamRole.roleArn,
                dataSource: {
                    DataLocation: personalizeItemsS3.valueAsString
                }
            }
        });

        const userSchema = new aws_personalize.CfnSchema(this, "UserSchema", {
            name: 'demo-user-schema',
            schema: JSON.stringify({
                type: "record",
                name: "Users",
                namespace: "com.amazonaws.personalize.schema",
                fields: [
                    {
                        name: "USER_ID",
                        type: "string"
                    },
                    {
                        name: "OCCUPATION",
                        type: "string",
                        categorical: true

                    },
                    {
                        name: "GENDER",
                        type: "string",
                        categorical: true
                    }
                ],
                version: "1.0"
            })
        });

        const userDataset = new aws_personalize.CfnDataset(this, "UserDataset", {
            name: 'demo-user-dataset',
            datasetType: "Users",
            schemaArn: userSchema.attrSchemaArn,
            datasetGroupArn: datasetGroup.attrDatasetGroupArn,
            datasetImportJob: {
                jobName: 'demo-user-dataset-import',
                roleArn: personalizeIamRole.roleArn,
                dataSource: {
                    DataLocation: personalizeUsersS3.valueAsString
                }
            }
        });

        const solution = new aws_personalize.CfnSolution(this, 'DemoSolution', {
            name: 'demo-solution',
            datasetGroupArn: datasetGroup.attrDatasetGroupArn,
            recipeArn: "arn:aws:personalize:::recipe/aws-user-personalization"
        });
        solution.node.addDependency(interactionsDataset);
        solution.node.addDependency(itemDataset);
        solution.node.addDependency(userDataset);

        let solutionVersion: cdk.custom_resources.AwsCustomResource;
        if(buildFirstSolutionVersion.valueAsString == "Yes") {
            solutionVersion = new cr.AwsCustomResource(this, 'DemoSolutionVersion', {
                onCreate: {
                    service: 'Personalize',
                    action: 'createSolutionVersion',
                    parameters: {
                        solutionArn: solution.attrSolutionArn
                    },
                    physicalResourceId: cr.PhysicalResourceId.of(Date.now().toString())
                },
                role: customResourceLambdaRole
            })
            solutionVersion.node.addDependency(solution);
        }

        /*
        // Solution Version asynchronously trains, campaign is unable to be created
                const campaign = new cr.AwsCustomResource(this, 'DemoCampaign', {
                    onCreate: {
                        service: 'Personalize',
                        action: 'createCampaign',
                        parameters: {
                            solutionVersionArn: solutionVersion.getResponseField("solutionVersionArn"),
                        },
                        physicalResourceId: cr.PhysicalResourceId.of(Date.now().toString())
                    },
                    onDelete: {
                        service: 'Personalize',
                        action: 'deleteCampaign',
                        parameters: {
                            campaignArn: new cr.PhysicalResourceIdReference()
                        }

                    },
                    role: customResourceLambdaRole
                })
                campaign.node.addDependency(solution)
         */
    }
}
