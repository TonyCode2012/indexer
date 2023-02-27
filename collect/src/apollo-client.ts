import ApolloLinkTimeout from 'apollo-link-timeout';
import {
  ApolloClient,
  ApolloLink,
  DefaultOptions,
  from,
  HttpLink,
  InMemoryCache,
} from '@apollo/client/core';
import { onError } from '@apollo/client/link/error';
import fetch from 'cross-fetch';
import { LENS_API } from './config';
import { createChildLogger } from './utils/logger';
import { getAuthenticationToken } from './state';
import { DbOperator } from './types/database.d';

const defaultOptions: DefaultOptions = {
  watchQuery: {
    fetchPolicy: 'no-cache',
    errorPolicy: 'ignore',
  },
  query: {
    fetchPolicy: 'no-cache',
    errorPolicy: 'all',
  },
};

const httpLink = new HttpLink({
  uri: LENS_API,
  fetch,
});

const timeoutLink = new ApolloLinkTimeout(60000);
const timeoutHttpLink = timeoutLink.concat(httpLink);
const logger = createChildLogger({moduleId:'ApolloClient'});

const errorLink = onError(({ graphQLErrors, networkError }) => {
  /*
  if (graphQLErrors)
    graphQLErrors.forEach(({ message, locations, path }) =>
      logger.error(`[GraphQL error]: Message: ${message}, Location: ${JSON.stringify(locations)}, Path: ${path}`)
    );

  if (networkError) logger.error(`[Network error]: ${networkError}`);
  */
});

// example how you can pass in the x-access-token into requests using `ApolloLink`
const authLink = new ApolloLink((operation, forward) => {
  const token = getAuthenticationToken();
  //console.log('jwt token:', token);

  // Use the setContext method to set the HTTP headers.
  operation.setContext({
    headers: {
      'x-access-token': token ? `Bearer ${token}` : '',
    },
  });

  // Call the next link in the middleware chain.
  return forward(operation);
});

export const apolloClient = new ApolloClient({
  link: from([errorLink, authLink, timeoutHttpLink]),
  cache: new InMemoryCache(),
  defaultOptions: defaultOptions,
});

class ApolloClientWrapper {
  private client: ApolloClient<any>;
  private dbOperator: DbOperator;

  public constructor(client: ApolloClient<any>) {
    this.client = client;
  }

  public setDbOperator(dbOperator: DbOperator) {
    this.dbOperator = dbOperator;
  }

  public setApolloClient(client: ApolloClient<any>) {
    this.client = client;
  }

  public async query(params: any): Promise<any> {
    if (!this.dbOperator) {
      throw new Error('dbOperator is not set!');
    }
    if (!this.client) {
      throw new Error('apolloClient is not set!');
    }
    await this.dbOperator.incLensApiQueryCount(1);
    return this.client.query(params);
  }
}

export const apolloClientWrapper = new ApolloClientWrapper(apolloClient);
