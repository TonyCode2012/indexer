import Bluebird from 'bluebird';
import { ethers } from "ethers";
import { AppContext } from '../types/context.d';
import { DbOperator } from '../types/database.d';
import { createDBOperator } from '../db/operator';
import { getProfiles, queryPublications } from '../operation';
import { makeIntervalTask } from './task-utils';
import { Logger } from 'winston';
import { SimpleTask } from '../types/tasks.d';
import { IsStopped } from './task-utils';
import { getTimestamp } from '../utils';
import { getPublication } from './publication-task';
import {
  LENS_DATA_LIMIT,
  LENS_HUB_CONTRACT,
  LENS_PERIPHERY_CONTRACT,
  LENS_HUB_EVENT_ABI,
  LENS_PERIPHERY_EVENT_ABI,
  LENS_HUB_TOPICS,
  LENS_PERIPHERY_TOPICS,
  POLYGON_ENDPOINT,
  MAX_TASK,
} from '../config';


export async function handleMonitor(
  context: AppContext,
  logger: Logger,
  isStopped: IsStopped,
): Promise<void> {
  const db = context.database;
  const dbOperator = createDBOperator(db);
  context.logger = logger;
  let fromBlock = await dbOperator.getSyncedBlockNumber();
  if (fromBlock === -1) {
    fromBlock = await dbOperator.getStartBlockNumber();
    if (fromBlock === -1) {
      throw new Error('Monitor lens block: get start block number failed.');
    }
  }

  const provider = new ethers.providers.JsonRpcProvider(POLYGON_ENDPOINT);
  const lensHubIface = new ethers.utils.Interface(LENS_HUB_EVENT_ABI);
  const lensPeripheryIface = new ethers.utils.Interface(LENS_PERIPHERY_EVENT_ABI);
  let toBlock = fromBlock + 2000;

  try {
    const currentBlock = await provider.getBlockNumber();
    if (currentBlock > fromBlock && toBlock > currentBlock) {
      toBlock = currentBlock;
    }
    logger.info(`from:${fromBlock}, to:${toBlock}`)

    const lensHubFilter = {
      address: LENS_HUB_CONTRACT,
      topics: [
        LENS_HUB_TOPICS
      ],
      fromBlock: fromBlock,
      toBlock: toBlock,
    }
    const lensPeripheryFilter = {
      address: LENS_PERIPHERY_CONTRACT,
      topics: [
        LENS_PERIPHERY_TOPICS
      ],
      fromBlock: fromBlock,
      toBlock: toBlock,
    }

    let profileIds: string[] = [];
    let pubIds: string[] = [];
    // Get lens hub logs
    const lensHubLogs = await provider.getLogs(lensHubFilter);
    for (const log of lensHubLogs) {
      const event = lensHubIface.parseLog(log);
      const profileId = event.args.profileId._hex;
      profileIds.push(profileId);
      if (event.args.pubId) {
        const pubId = event.args.pubId._hex;
        if (pubId.includes("-")) {
          pubIds.push(pubId);
        } else {
          pubIds.push(profileId + "-" + pubId);
        }
      }
    }
    // Get lens periphery logs
    const lensPeripheryLogs = await provider.getLogs(lensPeripheryFilter);
    for (const log of lensPeripheryLogs) {
      const event = lensPeripheryIface.parseLog(log);
      if (event.args.hasOwnProperty('profileId')) {
        profileIds.push(event.args.profileId._hex)
      } else if (event.args.hasOwnProperty('profileIds')) {
        for (const id of event.args.profileIds) {
          profileIds.push(id._hex);
        }
      }
    }
    profileIds = Array.from(new Set(profileIds));
    pubIds = Array.from(new Set(pubIds));
    logger.info(`Get profile number:${profileIds.length}, publication number:${pubIds.length}`);
    await updateData(context, profileIds, pubIds, isStopped);
    if (isStopped()) 
      throw new Error("Stop record break point due to stopped.");
    await dbOperator.setSyncedBlockNumber(toBlock);
  } catch (e: any) {
    logger.error(`Get logs from polychain failed,error:${e}.`);
  }
}

export async function createMonitorTask(
  context: AppContext,
  loggerParent: Logger,
): Promise<SimpleTask> {
  const interval = 5 * 1000;
  return makeIntervalTask(
    0,
    interval,
    'monitor-chain',
    context,
    loggerParent,
    handleMonitor,
    '👀',
  )
}

async function updateData(
  context: AppContext, 
  profileIds: string[], 
  pubIds: string[],
  isStopped: IsStopped,
): Promise<void> {
  const promises: Promise<void>[] = [];
  promises.push(updateProfiles(context, profileIds, isStopped));
  promises.push(updatePublications(context, pubIds, isStopped));
  await Bluebird.map(promises, async (promise: any) => await promise);
}

async function updateProfiles(
  context: AppContext, 
  profileIds: string[], 
  isStopped: IsStopped,
): Promise<void> {
  const logger = context.logger;
  const dbOperator = createDBOperator(context.database);
  let offset = 0;
  while (offset < profileIds.length) {
    try {
      await Bluebird.delay(1 * 1000);
      const profiles = await getProfiles({
        profileIds: profileIds.slice(offset,offset+LENS_DATA_LIMIT),
        limit: LENS_DATA_LIMIT,
      })
      //await dbOperator.insertProfiles(profiles.items);
      await Bluebird.map(profiles.items, async (profile: any) => {
        if (!isStopped())
          await dbOperator.updateProfile(profile);
      }, { concurrency: MAX_TASK/2});
      offset = offset + LENS_DATA_LIMIT;
    } catch (e: any) {
      logger.error(`Get profiles failed,error:${e}`);
      if (e.statusCode === 404)
        break;

      if (e.networkError.statusCode === 429)
        await Bluebird.delay(5 * 60 * 1000);
    }
  }
}

async function updatePublications(
  context: AppContext,
  pubIds: string[],
  isStopped: IsStopped,
): Promise<void> {
  const logger = context.logger;
  const dbOperator = createDBOperator(context.database);
  let offset = 0;
  while (offset < pubIds.length) {
    try {
      await Bluebird.delay(1 * 1000);
      const { publications } = await queryPublications({
        publicationIds: pubIds.slice(offset,offset+LENS_DATA_LIMIT),
        limit: LENS_DATA_LIMIT,
      })
      await dbOperator.insertPublications(publications.items);
      offset = offset + LENS_DATA_LIMIT;
    } catch (e: any) {
      logger.error(`Get publications failed,error:${e}`);
      if (e.statusCode === 404)
        break;

      if (e.networkError.statusCode === 429)
        await Bluebird.delay(5 * 60 * 1000);
    }
  }
}
