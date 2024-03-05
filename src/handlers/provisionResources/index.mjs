import { STSClient, AssumeRoleCommand } from "@aws-sdk/client-sts";
import { AthenaClient, ListDatabasesCommand } from "@aws-sdk/client-athena"; 
import { SageMakerClient, ListNotebookInstancesCommand } from "@aws-sdk/client-sagemaker";

const {
  REGION
} = process.env;

export const stsClient = new STSClient({ region: REGION });

export const handler = async (event) => {
  let response;
  console.info(event);

  // Get the role ARN to assume from the request's context
  let roleArn = event.requestContext.authorizer.claims['cognito:roles'];
  // Get the action to perform from the query param
  let action = event.queryStringParameters['action'];  

  console.info('userArn:', event.requestContext.identity.userArn);
  console.info('roleArn', event.requestContext.authorizer.claims['cognito:roles']);
  console.info('action:', action);

  // Use SDK to assume the role stored in roleArn
  const stsResponse = await assumeRole(roleArn);
  
  if (stsResponse) {
    let actionResponse;
    console.info('stsResponse:', stsResponse);

    if (action) {
      actionResponse = await processAction(action, stsResponse);
    }

    response = {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(actionResponse)
    };
  } else {
    response = {
      statusCode: 401,
      message: 'Unauthorized',
      headers: {
        'Access-Control-Allow-Origin': '*'
      }
    };
  }

  return response;
};

/**
 * @param {string} roleArn - The ARN of the role to assume
 * @param {string} sessionId - An identifier for the assumed role session (optional)
 * @param {number} duration - The duration, in seconds, of the role session (optional, maximum 900 seconds (15min)) 
**/
const assumeRole = async (roleArn, sessionId = 'session1', duration = 900) => {
  try {
    // Returns a set of temporary security credentials that you can use to
    // access Amazon Web Services resources that you might not normally
    // have access to.
    const command = new AssumeRoleCommand({
      // The Amazon Resource Name (ARN) of the role to assume.
      RoleArn: roleArn,
      // An identifier for the assumed role session.
      RoleSessionName: sessionId,
      // The duration, in seconds, of the role session. The value specified
      // can range from 900 seconds (15 minutes) up to the maximum session
      // duration set for the role.
      DurationSeconds: duration,
    });
    const response = await stsClient.send(command);

    return response;
  } catch (err) {
    console.error(err);
  }
};

/**
 * @param {string} action - The action to perform (getAthenaDatabases or getSageMakerInstances)
 * @param {object} stsResponse - The response from the assumeRole function
**/
const processAction = async (action, stsResponse) => {
  let response = {};

  const roleCredentials = {
    accessKeyId: stsResponse.Credentials.AccessKeyId,
    secretAccessKey: stsResponse.Credentials.SecretAccessKey,
    sessionToken: stsResponse.Credentials.SessionToken,
  };    

  if (action == 'getAthenaDatabases') {
    response = await getAthenaDatabases(roleCredentials);
  } else if (action == 'getSageMakerInstances') {
    response = await getSageMakerInstances(roleCredentials);
  } else {
    // Unknown action
    console.error('Unknown action:', action);
  }

  return response;
};

/**
 * @param {object} credentials - The credentials to use to access the required AWS service 
 * @returns service response 
**/
const getAthenaDatabases = async (credentials) => {
  const athenaClient = new AthenaClient({ credentials: credentials, region: REGION });

  const input = { 
    CatalogName: "AwsDataCatalog", // required
  };
  
  const command = new ListDatabasesCommand(input);
  const response = await athenaClient.send(command);

  console.info(response)

  return response;
}

/**
 * @param {object} credentials - The credentials to use to access the required AWS service 
 * @returns service response 
**/
const getSageMakerInstances = async (credentials) => {
  const smClient = new SageMakerClient({
    credentials: credentials,
    region: REGION
  });

  const command = new ListNotebookInstancesCommand({ MaxResults: 5 });
  const response = await smClient.send(command);

  console.info(response);

  return response;
}