import Bluebird from 'bluebird';
import { apolloClientWrapper } from '../apollo-client';
import { 
  PublicationsQueryRequest,
  PublicationsDocument,
  PublicationTypes } from '../graphql/generated';
import { logger } from '../utils/logger';
import os from 'os';

const maxTaskNum = os.cpus().length;

export async function queryPublications(request: PublicationsQueryRequest) {
  const res = await apolloClientWrapper.query({
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
