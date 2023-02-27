import Bluebird from 'bluebird';
import { apolloClientWrapper } from '../apollo-client';
import {
  ExploreProfilesDocument,
  ExploreProfilesRequest,
  ProfileSortCriteria,
  ProfileQueryRequest,
  ProfilesDocument,
} from '../graphql/generated';
import { loadDB, closeAllDB } from '../db';
import { logger } from '../utils/logger';
import { LENS_DATA_LIMIT } from '../config';

export async function exploreProfiles(request: ExploreProfilesRequest) {
  const res = await apolloClientWrapper.query({
    query: ExploreProfilesDocument,
    variables: {
      request,
    },
  });
  if (!(res.data && res.data.exploreProfiles))
    throw ({
      statusCode: 404,
      message: 'Explore profiles failed!',
    });

  return res.data.exploreProfiles;
}

export async function getProfiles(request: ProfileQueryRequest) {
  const res = await apolloClientWrapper.query({
    query: ProfilesDocument,
    variables: {
      request,
    },
  });
  if (!(res.data && res.data.profiles))
    throw ({
      statusCode: 404,
      message: 'Get profiles failed!',
    });

  return res.data.profiles;
}

export async function getProfilesByAddress(address: string): Promise<any[]> {
  return await getProfilesByAddresses([address]);
}

export async function getProfilesByAddresses(addresses: string[]): Promise<any[]> {
  let cursor = '{}';
  const res: any[] = [];
  let offset = 0;
  while (offset < addresses.length) {
    try {
      const profiles = await getProfiles({
        ownedBy: addresses.slice(offset, offset+LENS_DATA_LIMIT),
        limit: LENS_DATA_LIMIT,
        cursor: cursor,
      })
      res.push(...profiles.items);
      cursor = profiles.pageInfo.next;
      if (profiles.items.length < LENS_DATA_LIMIT) {
        cursor = '{}';
        offset += LENS_DATA_LIMIT;
      }
    } catch (e: any) {
      logger.error(`Get profile by addresses failed, error:${e}`);
      if (e.networkError.statusCode === 429)
        await Bluebird.delay(5 * 60 * 1000);
    }
  }
  return res;
}
