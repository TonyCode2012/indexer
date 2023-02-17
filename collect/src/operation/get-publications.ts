import Bluebird from 'bluebird';
import { apolloClient } from '../apollo-client';
import { 
  PublicationsQueryRequest,
  PublicationsDocument,
  PublicationTypes, 
  PublicationQueryRequest,
  PublicationDocument} from '../graphql/generated';
import { logger } from '../utils/logger';
import os from 'os';

const maxTaskNum = os.cpus().length;

export async function queryPublications(request: PublicationsQueryRequest) {
  const res = await apolloClient.query({
    query: PublicationsDocument,
    variables: {
      request,
    },
  });
  const data = res.data;
  if (data === null || data === undefined)
    throw ({
      statusCode: 404,
      message: `Get publications with request:${request} failed!`,
    });

  return data;
};

export async function queryPublication(request: PublicationQueryRequest) {
  const res = await apolloClient.query({
    query: PublicationDocument,
    variables: {
      request,
    },
  });
  const data = res.data;
  if (data === null || data === undefined)
    throw ({
      statusCode: 404,
      message: `Get publication with request:${request} failed!`,
    });

  return data;
};
