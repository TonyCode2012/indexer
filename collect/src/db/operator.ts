import { ethers } from "ethers";
import Bluebird from 'bluebird';
import { logger } from '../utils/logger';
import { loadDB, MongoDB } from '../db';
import { DbOperator } from '../types/database.d';
import { getTimestamp } from '../utils';
import { queryPublications } from '../operation';
import { 
  POLYGON_ENDPOINT,
  PROFILE_COLL,
  PUBLICATION_COLL,
  CURSOR_COLL,
  WHITELIST_COLL,
  ACHIEVEMENT_COLL,
  TASK_COLL,
  LENS_DATA_LIMIT,
} from "../config";

export function createDBOperator(db: MongoDB): DbOperator {
  const insertOne = async (collName: string, data: any): Promise<void> => {
    try {
      await db.dbHandler.collection(collName).insertOne(data);
    } catch (e: any) {
      if (e.code !== 11000)
        throw new Error(`Insert data failed, message:${e}`);
    }
  }

  const insertMany = async (collName: string, data: any[]): Promise<void> => {
    try {
      if (data.length === 0) {
        return;
      }
      await db.dbHandler.collection(collName).insertMany(data);
    } catch (e: any) {
      if (e.code !== 11000)
        throw new Error(`Insert many data failed, message:${e}`);
    }
  }

  const insertAchievement = async (data: any): Promise<void> => {
    try {
      await db.dbHandler.collection(ACHIEVEMENT_COLL).insertOne(data);
    } catch (e: any) {
      if (e.code !== 11000)
        throw new Error(`Insert Achievement failed, message:${e}`);
    }
  }

  const insertAchievements = async (data: any[]): Promise<void> => {
    try {
      if (data.length === 0) {
        return;
      }
      const options = { ordered: false };
      return await db.dbHandler.collection(ACHIEVEMENT_COLL).insertMany(data, options);
    } catch (e: any) {
      if (e.code !== 11000)
        throw new Error(`Insert achievements failed, message:${e}`);
    }
  }

  const insertTasks = async (data: any[]): Promise<void> => {
    try {
      if (data.length === 0) {
        return;
      }
      const options = { ordered: false };
      return await db.dbHandler.collection(TASK_COLL).insertMany(data, options);
    } catch (e: any) {
      if (e.code !== 11000)
        throw new Error(`Insert tasks failed, message:${e}`);
    }
  }

  const insertWhitelist = async (data: any): Promise<any> => {
    try {
      return await db.dbHandler.collection(WHITELIST_COLL).insertOne(data);
    } catch (e: any) {
      if (e.code !== 11000)
        throw new Error(`Insert whitelist failed, message:${e}`);
    }
  }

  const insertWhitelists = async (data: any[]): Promise<any> => {
    try {
      if (data.length === 0) {
        return;
      }
      const options = { ordered: false };
      return await db.dbHandler.collection(WHITELIST_COLL).insertMany(data, options);
    } catch (e: any) {
      if (e.code !== 11000)
        throw new Error(`Insert whitelists failed, message:${e}`);
    }
  }

  const insertProfile = async (data: any): Promise<any> => {
    try {
      return await db.dbHandler.collection(PROFILE_COLL).insertOne(data);
    } catch (e: any) {
      if (e.code !== 11000)
        throw new Error(`Insert profile failed, message:${e}`);
    }
  }

  const insertProfiles = async (data: any[]): Promise<any> => {
    try {
      if (data.length === 0) {
        return;
      }
      const options = { ordered: false };
      return await db.dbHandler.collection(PROFILE_COLL).insertMany(data, options);
    } catch (e: any) {
      if (e.code !== 11000)
        throw new Error(`Insert profiles failed, message:${e}`);
    }
  }

  const insertPublications = async (data: any[]): Promise<void> => {
    try {
      if (data.length === 0) {
        return;
      }
      const options = { ordered: false };
      return await db.dbHandler.collection(PUBLICATION_COLL).insertMany(data, options);
    } catch (e: any) {
      if (e.code !== 11000)
        throw new Error(`Insert publications failed, message:${e}`);
    }
  }

  const deleteOne = async (collName: string, query: any): Promise<void> => {
    await db.dbHandler.collection(collName).deleteOne(collName, query);
  }

  const deleteMany = async (collName: string, query: any): Promise<void> => {
    await db.dbHandler.collection(collName).deleteMany(collName, query);
  }

  const updateProfileCursor = async (cursor: any, status?: string): Promise<void> => {
    const query = { _id: 'profile' };
    const updateData = ((stats: any) => {
      if (stats) {
        return { 
          value: cursor, 
          status: stats,
        };
      }
      return { value: cursor };
    })(status);
    const options = { upsert: true }; await db.dbHandler.collection(CURSOR_COLL).updateOne(query, { $set: updateData }, options);
  }

  const updatePublicationCursor = async (id: string, cursor: string): Promise<void> => {
    const query = { _id: id };
    const updateData = { publicationCursor: cursor };
    const options = { upsert: true };
    await db.dbHandler.collection(PROFILE_COLL).updateOne(query, { $set: updateData }, options);
  }

  const updateProfile = async (data: any): Promise<void> => {
    const query = { _id: data._id };
    const options = { upsert: true };
    await db.dbHandler.collection(PROFILE_COLL).updateOne(query, { $set: data }, options);
  }

  const updateProfileTimestamp = async (id: string, timestamp: number): Promise<void> => {
    const query = { _id: id };
    const updateData = { lastUpdateTimestamp: timestamp };
    await db.dbHandler.collection(PROFILE_COLL).updateOne(query, { $set: updateData });
  }

  const updateProfileCursorAndTimestamp = async (id: string, cursor: string, timestamp: number): Promise<void> => {
    const query = { _id: id };
    const updateData = { 
      publicationCursor: cursor,
      lastUpdateTimestamp: timestamp,
    };
    await db.dbHandler.collection(PROFILE_COLL).updateOne(query, { $set: updateData });
  }

  const updateProfilePullStatus = async (id: string, status: string): Promise<void> => {
    await db.dbHandler.collection(PROFILE_COLL).updateOne(
      { _id: id },
      { 
        $set: { pullStatus: status }
      }
    );
  }

  const incLensApiQueryCount = async (n: number): Promise<void> => {
    const query = { _id: 'lensApiQueryCount' };
    const options = { upsert: true };
    await db.dbHandler.collection(CURSOR_COLL).updateOne(query, { $inc: { value: n } }, options);
  }

  const getProfileCursor = async (): Promise<any> => {
    const cursor = await db.dbHandler.collection(CURSOR_COLL).findOne({_id: 'profile'})
    if (cursor === null)
      return '{}';

    return cursor;
  }

  const getPublicationCursor = async (id: string): Promise<string> => {
    const cursor = await db.dbHandler.collection(PROFILE_COLL).findOne({_id: id});
    if (cursor === null)
      return '{}';

    if (cursor.publicationCursor === null || cursor.publicationCursor === undefined)
      return '{}';

    return cursor.publicationCursor;
  }

  const getProfileIdsWithLimit = async (limit?: number): Promise<string[]> => {
    if (limit === null || limit === undefined) {
      limit = 1000;
    }

    const lastUpdateTimestamp = await getOrSetLastUpdateTimestamp();
    const res: string[] = [];
    const items = await db.dbHandler.collection(PROFILE_COLL).find(
      {
        $or: [
          { pullStatus: { $exists: false } },
          { pullStatus: { $ne: "complete" } }
        ]
      },
      {
        _id: 1,
      }
    ).limit(limit).toArray();

    for (const item of items) {
      res.push(item._id);
    }
    return res;
  }

  const setSyncedBlockNumber = async (blockNumber: number): Promise<void> => {
    const query = { _id: 'syncedBlock' };
    const updateData = { value: blockNumber };
    const options = { upsert: true }; 
    await db.dbHandler.collection(CURSOR_COLL).updateOne(query, { $set: updateData }, options);
  }

  const getSyncedBlockNumber = async (): Promise<number> => {
    const res = await db.dbHandler.collection(CURSOR_COLL).findOne({_id:'syncedBlock'});
    if (res === null)
      return -1;

    return res.value;
  }

  const setStartBlockNumber = async (): Promise<void> => {
    try {
      const res = await db.dbHandler.collection(CURSOR_COLL).findOne({_id:'startBlock'});
      if (res !== null)
        return;

      const provider = new ethers.providers.JsonRpcProvider(POLYGON_ENDPOINT);
      const startBlockNumber = await provider.getBlockNumber();
      logger.info(`Set monitor start block number to ${startBlockNumber}`);
      const query = { _id: 'startBlock' };
      const updateData = { value: startBlockNumber };
      const options = { upsert: true }; 
      await db.dbHandler.collection(CURSOR_COLL).updateOne(query, { $set: updateData }, options);
    } catch (e: any) {
      logger.error(`Update start block number failed, message:${e}`);
    }
  }

  const setStop = async (): Promise<void> => {
    try {
      await db.dbHandler.collection(CURSOR_COLL).insertOne({ _id: 'stop' });
    } catch (e: any) {
      if (e.code !== 11000)
        throw new Error(`Insert many data failed, message:${e}`);
    }
  }

  const getStop = async (): Promise<boolean> => {
    const res = await db.dbHandler.collection(CURSOR_COLL).findOne({_id:'stop'});
    return res !== null;
  }

  const deleteStop = async (): Promise<void> => {
    await db.dbHandler.collection(CURSOR_COLL).deleteOne({_id:'stop'});
  }

  const getStartBlockNumber = async (): Promise<number> => {
    const res = await db.dbHandler.collection(CURSOR_COLL).findOne({_id:'startBlock'});
    if (res === null)
      return -1;

    return res.value;
  }

  const getStatus = async (): Promise<any> => {
    const profileStats = await db.dbHandler.collection(PROFILE_COLL).stats({scale:1024});
    const publicationStats = await db.dbHandler.collection(PUBLICATION_COLL).stats({scale:1024});
    return {
      profile: {
        count: profileStats.count,
        size: profileStats.size,
      },
      publication: {
        count: publicationStats.count,
        size: publicationStats.size,
      },
    };
  }

  const getWhiteList = async (): Promise<string[]> => {
    const res = await db.dbHandler.collection(WHITELIST_COLL).distinct("_id");
    if (res === null)
      return [];

    return res;
  }

  const setLastUpdateTimestamp = async (timestamp: number): Promise<void> => {
    const query = { _id: 'timestamp' };
    const updateData = { lastUpdateTimestamp: timestamp };
    const options = { upsert: true };
    await db.dbHandler.collection(CURSOR_COLL).updateOne(query, { $set: updateData }, options);
  }

  const setUncompletePubCursor = async (cursor: number): Promise<void> => {
    const query = { _id: 'uncompletePubCursor' };
    const updateData = { value: cursor };
    const options = { upsert: true };
    await db.dbHandler.collection(CURSOR_COLL).updateOne(query, { $set: updateData }, options);
  }

  const getOrSetLastUpdateTimestamp = async (): Promise<number> => {
    const timestamp = await db.dbHandler.collection(CURSOR_COLL).findOne({_id:'timestamp'});
    if (timestamp !== null) {
      return timestamp.lastUpdateTimestamp;
    }

    const lastUpdateTimestamp = getTimestamp();
    const query = { _id: 'timestamp' };
    const updateData = { lastUpdateTimestamp: lastUpdateTimestamp };
    const options = { upsert: true };
    await db.dbHandler.collection(CURSOR_COLL).updateOne(query, { $set: updateData }, options);

    return lastUpdateTimestamp;
  }

  const getWhitelistProfileIds = async (): Promise<string[]> => {
    const addresses = await getWhiteList();
    const profileIds: string[] = [];
    for (const address of addresses) {
      const items = await db.dbHandler.collection(PROFILE_COLL).find({ownedBy:address},{_id:1}).toArray()
      for (const item of items) {
        profileIds.push(item._id);
      }
    }
    return profileIds;
  }

  const getUncompletePubCursor = async (): Promise<number> => {
    const res = await db.dbHandler.collection(CURSOR_COLL).findOne({_id:'uncompletePubCursor'});
    if (!res) {
      return 1;
    }

    return res.value;
  }

  const getMissedPublications = async (startIndex?: number): Promise<void> => {
    let idIndex = startIndex ?? 1;
    logger.info(`Start(from index:${idIndex}) to add missed publications, this will take a while...`);
    const incStep = 50;
    const profileNum = await db.dbHandler.collection(PROFILE_COLL).estimatedDocumentCount();
    while (idIndex <= profileNum) {
      const proIds: string[] = [];
      for (let i = 0; i < 50; i++, idIndex++) {
        let tmp = idIndex.toString(16);
        if (tmp.length % 2 !== 0) {
          tmp = "0" + tmp;
        }
        proIds.push("0x" + tmp);
      }
      const fetchedProIds = await db.dbHandler.collection(PROFILE_COLL).find(
        { _id: { $in: proIds } }
      )
      .project(
        { 
          _id: 1,
          totalPubs: "$stats.totalPublications"
        }
      ).toArray();
      logger.info(`Get missed publications, dealed number:${idIndex}.`);
      const missedPubIds: string[] = [];
      for (const { _id:proId, totalPubs } of fetchedProIds) {
        const pubArry= await db.dbHandler.collection(PUBLICATION_COLL).find(
          { "profile.id": proId },
          { _id: 1 }
        ).toArray();
        const pubIds = pubArry.map((e: any) => {
          const id = e._id;
          return Number(id.substring(id.indexOf("-") + 1, id.length));
        }).sort((a: any, b: any) => { return a - b;});
        pubIds.push(totalPubs + 1);
        let curAcc = 0;
        for (let i = 0; i < pubIds.length - 1; i++) {
          if (pubIds[i] + 1 != pubIds[i+1]) {
            for (let id = pubIds[i]+1; id < pubIds[i+1]; id++) {
              let pubIdPost = id.toString(16);
              if (pubIdPost.length % 2 !== 0) {
                pubIdPost = "0" + pubIdPost;
              }
              missedPubIds.push(proId + "-0x" + pubIdPost);
              curAcc++;
            }
          }
        }
        if (curAcc > 0) logger.info(`profile id:${proId}, missed item number:${curAcc}`);
      }
      await addPublications(missedPubIds);
      logger.info(`Add missed publications num:${missedPubIds.length} successfully.`);
    }
    logger.info("Add missed publications successfully.");
  }

  async function addPublications(pubIds: string[]): Promise<void> {
    let offset = 0;
    while (offset < pubIds.length) {
      try {
        //await Bluebird.delay(1 * 1000);
        const { publications } = await queryPublications({
          publicationIds: pubIds.slice(offset,offset+LENS_DATA_LIMIT),
          limit: LENS_DATA_LIMIT,
        })
        await insertPublications(publications.items);
        offset = offset + LENS_DATA_LIMIT;
      } catch (e: any) {
        logger.error(`Get publications failed,error:${e}`);
        if (e.statusCode === 404) {
          break;
        }
        if (e.networkError.statusCode === 429) {
          await Bluebird.delay(5 * 60 * 1000);
        }
      }
    }
  }

  return {
    insertOne,
    insertMany,
    insertAchievement,
    insertAchievements,
    insertTasks,
    insertWhitelist,
    insertWhitelists,
    insertProfile,
    insertProfiles,
    insertPublications,
    deleteOne,
    deleteMany,
    deleteStop,
    updateProfile,
    updateProfileCursor,
    updateProfileTimestamp,
    updatePublicationCursor,
    updateProfileCursorAndTimestamp,
    updateProfilePullStatus,
    incLensApiQueryCount,
    setSyncedBlockNumber,
    setStartBlockNumber,
    setStop,
    setLastUpdateTimestamp,
    getStop,
    getProfileCursor,
    getPublicationCursor,
    getProfileIdsWithLimit,
    getSyncedBlockNumber,
    getStartBlockNumber,
    getStatus,
    getWhiteList,
    getWhitelistProfileIds,
    getOrSetLastUpdateTimestamp,
    getMissedPublications,
  }
}
