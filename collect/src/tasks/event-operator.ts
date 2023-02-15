import Bluebird from 'bluebird';
import { DbOperator } from '../types/database.d';
import { logger } from '../utils/logger';
import { Dayjs } from '../utils/datetime';
import { HTTP_TIMEOUT } from '../config';

const axios = require('axios')
const axiosInstance = axios.create()

export async function profileCreated(
  dbOperator: DbOperator,
  event: any
): Promise<void> {
  await dbOperator.updateProfile({
    _id: event.args.profileId._hex,
    ownedBy: event.args.to,
    handle: event.args.handle,
    //stats: {
    //  totalFollowers: 0,
    //  totalFollowing: 0
    //  //totalPosts: 0,
    //  //totalComments: 0,
    //  //totalMirrors: 0,
    //},
    picture: getRealImageUri(event.args.imageURI),
    followModule: event.args.followModule,
    createdAt: Dayjs(event.args.timestamp.toNumber()).toString(),
    dispatcher: null,
    isDefault: false,
  });
}

// From LensPeriphery
export async function profileMetadataSet(
  dbOperator: DbOperator,
  event: any
): Promise<void> {
  const metadata = await processContentUri(event.args.contentURI);
  await dbOperator.updateProfile({
    _id: event.args.profileId._hex,
    name: metadata.name,
    bio: metadata.bio,
    cover_picture: metadata.cover_picture,
    attributes: metadata.attributes,
    appId: metadata.appId,
  });
}

export async function defaultProfileSet(
  dbOperator: DbOperator,
  event: any
): Promise<void> {
  await dbOperator.updateProfileEx(
    {
      _id: event.args.profileId._hex,
      ownedBy: event.args.wallet,
    },
    {
      $set: { isDefault: true },
    },
  );
  await dbOperator.updateProfileEx(
    {
      _id: { $ne: event.args.profileId._hex },
      ownedBy: event.args.wallet,
    },
    {
      $set: { isDefault: false },
    },
  )
}

export async function dispatcherSet(
  dbOperator: DbOperator,
  event: any
): Promise<void> {
  await dbOperator.updateProfile({
    _id: event.args.profileId._hex,
    dispatcher: event.args.dispatcher
  });
}

export async function profileImageURISet(
  dbOperator: DbOperator,
  event: any
): Promise<void> {
  await dbOperator.updateProfile({
    _id: event.args.profileId._hex,
    picture: getRealImageUri(event.args.imageURI),
  });
}

export async function followNFTURISet(
  dbOperator: DbOperator,
  event: any
): Promise<void> {
  await dbOperator.updateProfile({
    _id: event.args.profileId._hex,
    followNftUri: event.args.followNFTURI,
  });
}

export async function followModuleSet(
  dbOperator: DbOperator,
  event: any
): Promise<void> {
  await dbOperator.updateProfile({
    _id: event.args.profileId._hex,
    followModule: event.args.followModule,
  });
}

export async function postCreated(
  dbOperator: DbOperator,
  event: any
): Promise<void> {
  const content = await processContentUri(event.args.contentURI);
  await dbOperator.insertPublication({
    _id: event.args.profileId._hex + "-" + event.args.pubId._hex,
    __typename: 'Post',
    profileId: event.args.profileId._hex,
    appId: content.appId,
    contentUri: event.args.contentURI,
    //stats: {
    //  //totalMirrors: 0,
    //  //totalComments: 0,
    //  totalCollects: 0,
    //},
    metadata: content,
    collectModule: event.args.collectModule,
    referenceModule: event.args.referenceModule,
    createdAt: Dayjs(event.args.timestamp.toNumber()).toString(),
  });
}

export async function commentCreated(
  dbOperator: DbOperator,
  event: any
): Promise<void> {
  const pubId = event.args.profileIdPointed._hex + "-" + event.args.pubIdPointed._hex;
  const content = await processContentUri(event.args.contentURI);
  const commentedPub = await GetPublicationById(dbOperator, pubId);
  await dbOperator.insertPublication({
    _id: pubId,
    __typename: 'Comment',
    profileId: event.args.profileId._hex,
    appId: content.appId,
    contentUri: event.args.contentURI,
    commentOn: { __typename: commentedPub.__typename, id: commentedPub._id },
    //stats: {
    //  //totalMirrors: 0,
    //  //totalComments: 0,
    //  totalCollects: 0,
    //},
    metadata: content,
    collectModule: event.args.collectModule,
    referenceModule: event.args.referenceModule,
    createdAt: Dayjs(event.args.timestamp.toNumber()).toString(),
  });
}

export async function mirrorCreated(
  dbOperator: DbOperator,
  event: any
): Promise<void> {
  const pubId = event.args.profileIdPointed._hex + "-" + event.args.pubIdPointed._hex;
  const mirroredPub = await GetPublicationById(dbOperator, pubId);
  await dbOperator.insertPublication({
    _id: pubId,
    __typename: 'Mirror',
    appId: mirroredPub.appId,
    profileId: event.args.profileId._hex,
    //stats: {
    //  //totalMirrors: 0,
    //  //totalComments: 0,
    //  totalCollects: 0,
    //},
    mirrorOf: { __typename: mirroredPub.__typename, id: mirroredPub._id },
    referenceModule: event.args.referenceModule,
    createdAt: Dayjs(event.args.timestamp.toNumber()).toString(),
  });
}

export async function collected(
  dbOperator: DbOperator,
  event: any
): Promise<void> {
  await dbOperator.updatePublicationEx(
    { _id: event.args.rootProfileId._hex + "-" + event.args.rootPubId._hex },
    {
      $inc: { "stats.totalCollects": 1 },
    },
  );
}

export async function followed(
  dbOperator: DbOperator,
  event: any
): Promise<void> {
  await dbOperator.updateProfiles(
    {
      $in: event.args.profileIds.map((x: any) => x._hex),
    },
    {
      $inc: { "stats.totalFollowers": 1 },
    },
  );
  const defaultProfile = await dbOperator.getDefaultProfileByAddress(event.args.follower);
  if (defaultProfile === null) {
    logger.error(`Set address:${event.args.follower} following failed, cannot find default profile.`);
    return;
  }
  await dbOperator.updateProfileEx(
    { 
      _id: defaultProfile._id,
    },
    {
      $inc: { "stats.totalFollowing": 1 },
    }
  );
}

export async function followNFTTransferred(
  dbOperator: DbOperator,
  event: any
): Promise<void> {
  const from = event.args.from;
  const to = event.args.to;
  const fromDefaultProfile = await dbOperator.getDefaultProfileByAddress(from);
  const toDefaultProfile = await dbOperator.getDefaultProfileByAddress(to);
  await dbOperator.updateProfileEx(
    {
      _id: fromDefaultProfile._id,
    },
    {
      $inc: { "stats.totalFollowing": -1 },
    },
  );
  await dbOperator.updateProfileEx(
    {
      _id: toDefaultProfile._id,
    },
    {
      $inc: { "stats.totalFollowing": 1 },
    },
  );
}

async function processContentUri(uri: string): Promise<any> {
  const lensInfraUrl = "https://lens.infura-ipfs.io/ipfs/";
  const ipfsUriHead = "ipfs://";
  let realUri = uri;
  let tryout = 3;
  while (--tryout >= 0) {
    try {
      if (realUri.startsWith(ipfsUriHead)) {
        realUri = lensInfraUrl + realUri.substring(ipfsUriHead.length, realUri.length);
      } else if (!realUri.startsWith("http")) {
        logger.error(`Invalid uri:${realUri}`);
        return {};
      }
      const data = await axiosInstance.get(realUri, {
        timeout: HTTP_TIMEOUT,
      });
    } catch (e: any) {
      if (realUri.startsWith(lensInfraUrl)) {
        return {};
      }
      realUri = lensInfraUrl + realUri.substring(realUri.lastIndexOf("/") + 1, realUri.length);
    }
  }
}

function getRealImageUri(uri: string): string {
  const lensInfraUrl = "https://lens.infura-ipfs.io/ipfs/";
  const ipfsUriHead = "ipfs://";
  if (uri.startsWith(ipfsUriHead)) {
    return lensInfraUrl + uri.substring(ipfsUriHead.length, uri.length);
  }
  return uri;
}

async function GetPublicationById(
  dbOperator: DbOperator,
  pubId: string
): Promise<any> {
  let tryout = 10;
  while (--tryout >= 0) {
    const res = await dbOperator.getPublicationById(pubId);
    if (res !== null) {
      return res;
    }
    await Bluebird.delay(2000);
  }
  logger.error(`get publication by id:${pubId} failed.`);
}
