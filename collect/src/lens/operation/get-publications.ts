import Bluebird from 'bluebird';
import os from 'os';
import { apolloClientWrapper } from '../../apollo-client';
import { 
  PublicationsDocument,
  PublicationsQueryRequest } from '../graphql/generated';
import { logger } from '../../utils/logger';

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
