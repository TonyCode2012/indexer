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
  await dbOperator.insertProfile({
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
    createdAt: Dayjs(event.args.timestamp.toNumber()*1000).toISOString(),
    dispatcher: null,
    isDefault: false,
  });
}

// From LensPeriphery
export async function profileMetadataSet(
  dbOperator: DbOperator,
  event: any
): Promise<void> {
  const metadata = await processContentUri(event.args.metadata);
  if (metadata !== null) {
    await dbOperator.updateProfile({
      _id: event.args.profileId._hex,
      name: metadata.name,
      bio: metadata.bio,
      cover_picture: metadata.cover_picture,
      attributes: metadata.attributes,
      appId: metadata.appId,
    });
  } else {
    await dbOperator.updateProfile({
      _id: event.args.profileId._hex,
      metadataUri: event.args.metadata,
    });
  }
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
    appId: content !== null ? content.appId : null,
    contentUri: event.args.contentURI,
    //stats: {
    //  //totalMirrors: 0,
    //  //totalComments: 0,
    //  totalCollects: 0,
    //},
    metadata: content,
    collectModule: event.args.collectModule,
    referenceModule: event.args.referenceModule,
    createdAt: Dayjs(event.args.timestamp.toNumber()*1000).toISOString(),
  });
}

export async function commentCreated(
  dbOperator: DbOperator,
  event: any
): Promise<void> {
  const commentedPubId = event.args.profileIdPointed._hex + "-" + event.args.pubIdPointed._hex;
  const content = await processContentUri(event.args.contentURI);
  const commentedPub = await GetPublicationById(dbOperator, commentedPubId);
  let data = {
    _id: event.args.profileId._hex + "-" + event.args.pubId._hex,
    __typename: 'Comment',
    profileId: event.args.profileId._hex,
    appId: commentedPub !== null ? commentedPub.appId : null,
    contentUri: event.args.contentURI,
    //stats: {
    //  //totalMirrors: 0,
    //  //totalComments: 0,
    //  totalCollects: 0,
    //},
    metadata: content,
    collectModule: event.args.collectModule,
    referenceModule: event.args.referenceModule,
    createdAt: Dayjs(event.args.timestamp.toNumber()*1000).toISOString(),
  };
  if (commentedPub) {
    Object.assign(data, { commentOn: { __typename: commentedPub.__typename, id: commentedPub._id } });
  } else {
    Object.assign(data, { commentOn: { id: commentedPubId } });
  }
  await dbOperator.insertPublication(data);
}

export async function mirrorCreated(
  dbOperator: DbOperator,
  event: any
): Promise<void> {
  const mirroredPubId = event.args.profileIdPointed._hex + "-" + event.args.pubIdPointed._hex;
  const mirroredPub = await GetPublicationById(dbOperator, mirroredPubId);
  let data = {
    _id: event.args.profileId._hex + "-" + event.args.pubId._hex,
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
    createdAt: Dayjs(event.args.timestamp.toNumber()*1000).toISOString(),
  };
  if (mirroredPub) {
    Object.assign(data, { mirrorOf: { __typename: mirroredPub.__typename, id: mirroredPub._id } });
  } else {
    Object.assign(data, { mirrorOf: { id: mirroredPubId } });
  }
  await dbOperator.insertPublication(data);
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
      _id: { $in: event.args.profileIds.map((x: any) => x._hex) },
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
  if (fromDefaultProfile !== null) {
    await dbOperator.updateProfileEx(
      {
        _id: fromDefaultProfile._id,
      },
      {
        $inc: { "stats.totalFollowing": -1 },
      },
    );
  }
  if (toDefaultProfile !== null) {
    await dbOperator.updateProfileEx(
      {
        _id: toDefaultProfile._id,
      },
      {
        $inc: { "stats.totalFollowing": 1 },
      },
    );
  } 
  // else {
  //   logger.error(`Get followNFTTransferred reciever:${to} failed.`);
  // }
}

async function processContentUri(uri: string): Promise<any> {
  const lensInfraUrl = "https://lens.infura-ipfs.io/ipfs/";
  const ipfsUriHead = "ipfs://";
  let realUri = uri;
  let tryout = 30;
  while (--tryout >= 0) {
    try {
      if (realUri.startsWith(ipfsUriHead)) {
        realUri = lensInfraUrl + realUri.substring(ipfsUriHead.length, realUri.length);
      } else if (!realUri.startsWith("http")) {
        logger.error(`Invalid uri:${realUri}`);
        return null;
      }
      const res = await axiosInstance.get(realUri, {
        timeout: HTTP_TIMEOUT,
      });
      return res.data;
    } catch (e: any) {
      if (realUri.startsWith(lensInfraUrl)) {
        logger.warn(`process uri:${realUri} failed, info:${e}, retry again.`);
      } else {
        realUri = lensInfraUrl + realUri.substring(realUri.lastIndexOf("/") + 1, realUri.length);
      }
    }
    await Bluebird.delay(3000);
  }
  logger.error(`get data from uri:${realUri} failed.`);
  return null;
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
  let tryout = 300;
  while (--tryout >= 0) {
    const res = await dbOperator.getPublicationById(pubId);
    if (res !== null) {
      return res;
    }
    await Bluebird.delay(2000);
  }
  logger.error(`get publication by id:${pubId} failed.`);
}
