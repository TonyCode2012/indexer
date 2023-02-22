import Bluebird from 'bluebird';
import { CID } from 'multiformats/cid';
import { DbOperator } from '../types/database.d';
import { logger } from '../utils/logger';
import { Dayjs } from '../utils/datetime';
import { HTTP_TIMEOUT, PROFILE_ID } from '../config';
import { getProfile, queryPublication } from '../operation';
import { getPublication } from './publication-task';

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
): Promise<any> {
  let metadata = await processContentUri(event.args.metadata);
  //if (metadata === null) {
  //  metadata = await getProfileByIdFromApi(event.args.profileId._hex);
  //  await dbOperator.updateLensApiQuery(1);
  //}
  if (metadata !== null) {
    await dbOperator.updateProfile({
      _id: event.args.profileId._hex,
      name: metadata.name,
      bio: metadata.bio,
      coverPicture: getRealImageUri(metadata.coverPicture),
      attributes: metadata.attributes,
      appId: metadata.appId,
      profileUpdateTS: Dayjs(event.args.timestamp.toNumber()*1000).toISOString(),
    });
  } else {
    await dbOperator.updateProfile({
      _id: event.args.profileId._hex,
      metadataUri: event.args.metadata,
    });
  }
  if (!metadata) return event.args.profileId._hex;
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
    followNftUri: getRealImageUri(event.args.followNFTURI),
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
): Promise<any> {
  let content;
  let contentURI = null;
  const pubId = event.args.profileId._hex + "-" + event.args.pubId._hex;
  const profileId = event.args.profileId._hex;
  try {
    contentURI = event.args.contentURI;
    content = await processContentUri(contentURI);
  } catch (e: any) {}
  //if (!content) {
  //  content = await getPubContentByIdFromApi(pubId);
  //  await dbOperator.updateLensApiQuery(1);
  //}
  const res = await dbOperator.insertPublication({
    _id: pubId,
    __typename: 'Post',
    profileId: profileId,
    appId: content ? content.appId : null,
    contentUri: contentURI,
    metadata: content,
    collectModule: event.args.collectModule,
    referenceModule: event.args.referenceModule,
    createdAt: Dayjs(event.args.timestamp.toNumber()*1000).toISOString(),
  });
  if (res && res.acknowledged) {
    await dbOperator.updateProfileEx(
      { _id: profileId },
      { $inc: { "stats.totalPosts": 1 } }
    );
  };
  if (!content) {
    return pubId;
  }
}

export async function commentCreated(
  dbOperator: DbOperator,
  event: any
): Promise<any> {
  let content;
  let contentURI = null;
  const commentedPubId = event.args.profileIdPointed._hex + "-" + event.args.pubIdPointed._hex;
  const pubId = event.args.profileId._hex + "-" + event.args.pubId._hex;
  try {
    contentURI = event.args.contentURI;
    content = await processContentUri(contentURI);
  } catch (e: any) {}
  //if (!content) {
  //  content = await getPubContentByIdFromApi(pubId);
  //}
  const profileId = event.args.profileId._hex;
  let data = {
    _id: pubId,
    __typename: 'Comment',
    profileId: profileId,
    appId: null,
    commentOn: { id: commentedPubId },
    contentUri: contentURI,
    metadata: content,
    collectModule: event.args.collectModule,
    referenceModule: event.args.referenceModule,
    createdAt: Dayjs(event.args.timestamp.toNumber()*1000).toISOString(),
  };
  const res = await dbOperator.insertPublication(data);
  if (res && res.acknowledged) {
    await dbOperator.updateProfileEx(
      { _id: profileId },
      { $inc: { "stats.totalComments": 1 } }
    );
  };
  if (!content) return pubId;
}

export async function mirrorCreated(
  dbOperator: DbOperator,
  event: any
): Promise<void> {
  const mirroredPubId = event.args.profileIdPointed._hex + "-" + event.args.pubIdPointed._hex;
  const profileId = event.args.profileId._hex;
  let data = {
    _id: event.args.profileId._hex + "-" + event.args.pubId._hex,
    __typename: 'Mirror',
    appId: null,
    profileId: profileId,
    mirrorOf: { id: mirroredPubId },
    referenceModule: event.args.referenceModule,
    createdAt: Dayjs(event.args.timestamp.toNumber()*1000).toISOString(),
  };
  const res = await dbOperator.insertPublication(data);
  if (res && res.acknowledged) {
    await dbOperator.updateProfileEx(
      { _id: profileId },
      { $inc: { "stats.totalMirrors": 1 } }
    );
  };
}

export async function collected(
  dbOperator: DbOperator,
  event: any
): Promise<void> {
  const luCollected = Dayjs(event.args.timestamp.toNumber()*1000).toISOString();
  await dbOperator.updatePublicationEx(
    { 
      _id: event.args.rootProfileId._hex + "-" + event.args.rootPubId._hex,
      $or: [
        { "stats.luCollected": { $exists: false } },
        {
          $and: [
            { "stats.luCollected": { $exists: true } },
            { "stats.luCollected": { $lt: luCollected } }
          ]
        }
      ]
    },
    {
      $inc: { "stats.totalCollects": 1 },
      $set: { "stats.luCollected": luCollected },
    },
  );
}

export async function followed(
  dbOperator: DbOperator,
  event: any
): Promise<void> {
  const luFollowed = Dayjs(event.args.timestamp.toNumber()*1000).toISOString();
  await dbOperator.updateProfiles(
    {
      _id: { $in: event.args.profileIds.map((x: any) => x._hex) },
      $or: [
        { "stats.luFollowed": { $exists: false } },
        { 
          $and: [
            { "stats.luFollowed": { $exists: true } },
            { "stats.luFollowed": { $lt: luFollowed } }
          ]
        }
      ]
    },
    {
      $inc: { "stats.totalFollowers": 1 },
      $set: { "stats.luFollowed": luFollowed },
    },
  );
  const defaultProfile = await dbOperator.getDefaultProfileByAddress(event.args.follower);
  if (defaultProfile === null) {
    //logger.error(`Set address:${event.args.follower} following failed, cannot find default profile.`);
    return;
  }
  await dbOperator.updateProfileEx(
    { 
      _id: defaultProfile._id,
      $or: [
        { "stats.luFollowed": { $exists: false } },
        { 
          $and: [
            { "stats.luFollowed": { $exists: true } },
            { "stats.luFollowed": { $lt: luFollowed } }
          ]
        }
      ]
    },
    {
      $inc: { "stats.totalFollowing": 1 },
      $set: { "stats.luFollowed": luFollowed },
    }
  );
}

export async function followNFTTransferred(
  dbOperator: DbOperator,
  event: any
): Promise<void> {
  const luFNT = Dayjs(event.args.timestamp.toNumber()*1000).toISOString();
  const from = event.args.from;
  const to = event.args.to;
  const fromDefaultProfile = await dbOperator.getDefaultProfileByAddress(from);
  const toDefaultProfile = await dbOperator.getDefaultProfileByAddress(to);
  if (fromDefaultProfile !== null) {
    await dbOperator.updateProfileEx(
      {
        _id: fromDefaultProfile._id,
        $or: [
          { "stats.luFNT": { $exists: false } },
          { 
            $and: [
              { "stats.luFNT": { $exists: true } },
              { "stats.luFNT": { $lt: luFNT } }
            ]
          }
        ]
      },
      {
        $inc: { "stats.totalFollowing": -1 },
        $set: { "stats.luFNT": luFNT },
      },
    );
  }
  if (toDefaultProfile !== null) {
    await dbOperator.updateProfileEx(
      {
        _id: toDefaultProfile._id,
        $or: [
          { "stats.luFNT": { $exists: false } },
          { 
            $and: [
              { "stats.luFNT": { $exists: true } },
              { "stats.luFNT": { $lt: luFNT } }
            ]
          }
        ]
      },
      {
        $inc: { "stats.totalFollowing": 1 },
        $set: { "stats.luFNT": luFNT },
      },
    );
  } 
  // else {
  //   logger.error(`Get followNFTTransferred reciever:${to} failed.`);
  // }
}

async function processContentUri(uri: string): Promise<any> {
  if (typeof uri !== 'string') {
    return null;
  }
  const ipfsBaseUrls = [
    "https://lens.infura-ipfs.io/ipfs/",
    "https://ipfs.io/ipfs/"
  ]
  const invalidUrls = [
    "ipfs://",
    "https://ipfs.infura.io/ipfs/",
  ];
  let validUrls: string[] = [];
  if (uri.startsWith("http")) {
    validUrls.push(uri);
  }
  // Filter invalid uris
  for (const iv of invalidUrls) {
    if (uri.startsWith(iv)) {
      try {
        const cid = uri.substring(uri.lastIndexOf("/") + 1, uri.length);
        CID.parse(cid)
        for (const baseUrl of ipfsBaseUrls) {
          validUrls.push(baseUrl + "/" + cid);
        }
      } catch (e: any) {}
      break;
    }
  }
  // Get data from valid urls
  for (const url of validUrls) {
    try {
      let { data } = await axios.get(url, {
        timeout: HTTP_TIMEOUT,
      });
      if (!data) continue;
      if (data.cover_picture) {
        data.coverPicture = data.cover_picture;
        delete data.cover_picture;
      }
      return data;
    } catch (e: any) {
        //logger.warn(`process uri:${uri} failed, info:${e}, retry again.`);
    }
    await Bluebird.delay(1000);
  }
  //logger.error(`get data from uri:${uri} failed, try lens api.`);
  return null;
}

function getRealImageUri(uri: any): string {
  if (!uri) {
    return "";
  }
  let realUri = uri;
  if (typeof uri === 'object') {
    if (uri.original) {
      realUri = uri.original.url;
      while (typeof realUri === 'object' && realUri.original) {
        realUri = realUri.original.url;
      }
    } else if (uri.uri) {
      realUri = uri.uri;
    } else {
      logger.error(`Unkonw image uri type:${uri}`);
      return "";
    }
  }
  const lensInfraUrl = "https://lens.infura-ipfs.io/ipfs/";
  const invalidUrls = [
    "ipfs://",
    "https://ipfs.infura.io/ipfs/",
  ];
  for (const iv of invalidUrls) {
    if (realUri.startsWith(iv)) {
      return lensInfraUrl + realUri.substring(iv.length, realUri.length);
    }
  }
  return realUri;
}

async function getProfileByIdFromApi(profileId: string): Promise<any> {
  let tryout = 3;
  while (--tryout >= 0) {
    try {
      let { profile } = await getProfile({
        profileId: profileId,
      })
      if (!profile) continue;
      profile.coverPicture = ((pic: any) => {
        if (pic && pic.uri) {
          return pic.uri;
        }
        if (!(pic && pic.original && pic.original.url)) {
          return null;
        }
        const url = pic.original.url;
        const lensInfraUrl = "https://lens.infura-ipfs.io/ipfs/";
        const ipfsTitle = "ipfs://";
        if (url.startsWith(ipfsTitle)) {
          return lensInfraUrl + url.substring(ipfsTitle.length, url.length);
        }
        return url;
      })(profile.coverPicture);
      return profile;
    } catch (e: any) {
      logger.warn(`Get profile:${profileId} from lens api failed, message:${e}, try again`);
    }
  }
  logger.error(`Get profile:${profileId} from lens api failed`);
  return null;
}

async function getPubContentByIdFromApi(pubId: string): Promise<any> {
  let tryout = 3;
  while (--tryout >= 0) {
    try {
      const { publication } = await queryPublication({
        publicationId: pubId,
      })
      if (!publication) continue;
      let content = {
        appId: publication?.appId,
      }
      Object.assign(content, publication?.metadata);
      return content;
    } catch (e: any) {
      logger.warn(`Get publication:${pubId} from lens api failed, message:${e}, try again`);
    }
  }
  return null;
}
