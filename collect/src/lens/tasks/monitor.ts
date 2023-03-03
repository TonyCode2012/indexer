import Bluebird from 'bluebird';
import _ from 'lodash';
import { Logger } from 'winston';
import { ethers } from "ethers";
import { AppContext } from '../../types/context.d';
import { DbOperator } from '../../types/database.d';
import { SimpleTask } from '../../types/tasks.d';
import { createDBOperator } from '../../db/operator';
import { getProfiles, queryPublications } from '../operation';
import { makeIntervalTask, IsStopped } from '../../tasks/task-utils';
import {
  LENS_DATA_LIMIT,
  LENS_HUB_CONTRACT,
  LENS_PERIPHERY_CONTRACT,
  LENS_TOPICS,
  LENS_EVENT_ABI,
  POLYGON_ENDPOINT,
  MAX_TASK,
} from '../../config';

let currentBlock = -1;
const axios = require('axios');

export async function handleMonitor(
  context: AppContext,
  logger: Logger,
  isStopped: IsStopped,
): Promise<void> {
  const db = context.database;
  const dbOperator = createDBOperator(db);
  const subCtx = _.cloneDeep(context)
  subCtx.logger = logger;
  let fromBlock = await dbOperator.getSyncedBlockNumber();
  if (fromBlock === -1) {
    fromBlock = await dbOperator.getStartBlockNumber();
    if (fromBlock === -1) {
      throw new Error('Monitor lens block: get start block number failed.');
    }
  }

  const lensIface = new ethers.utils.Interface(LENS_EVENT_ABI);
  const _fromBlock = fromBlock;

  const events: any[] = [];
  let toBlock = 0;
  logger.info(`Getting blocks from:${fromBlock}...`);
  try {
    let profileIds: string[] = [];
    let pubIds: string[] = [];
    let acc = 1;
    while (--acc >= 0) {
      toBlock = fromBlock + 2000;
      if (currentBlock === -1 || toBlock > currentBlock) {
        currentBlock = await getCurrentBlock(subCtx);
        if (currentBlock === -1) {
          currentBlock = fromBlock;
        }
      }
      if (toBlock > currentBlock) {
        toBlock = currentBlock;
      }
      if (toBlock === fromBlock) {
        break;
      }
      const lensFilter = {
        address: [LENS_HUB_CONTRACT, LENS_PERIPHERY_CONTRACT],
        topics: [
          LENS_TOPICS
        ],
        fromBlock: "0x".concat(fromBlock.toString(16)),
        toBlock: "0x".concat(toBlock.toString(16)),
      }
      // Get lens logs
      const lensLogs = await axios.post(
        POLYGON_ENDPOINT,
        {
          id: 1,
          jsonrpc: "2.0",
          method: "eth_getLogs",
          params: [lensFilter]
        },
        {
          "content-type": "application/json",
        }
      );
      for (const log of lensLogs.data.result) {
        const event = lensIface.parseLog(log);
        if (event.args.profileId) {
          profileIds.push(event.args.profileId._hex);
          if (event.args.pubId) {
            pubIds.push(event.args.profileId._hex + "-" + event.args.pubId._hex);
          }
        }
        if (event.args.profileIdPointed) {
          profileIds.push(event.args.profileIdPointed._hex);
          if (event.args.pubIdPointed) {
            pubIds.push(event.args.profileIdPointed._hex + "-" + event.args.pubIdPointed._hex);
          }
        }
        if (event.args.rootProfileId) {
          profileIds.push(event.args.rootProfileId._hex);
          if (event.args.rootPubId) {
            pubIds.push(event.args.rootProfileId._hex + "-" + event.args.rootPubId._hex);
          }
        }
        if (event.args.profileIds) {
          profileIds.push(...event.args.profileIds.map((x: any) => x._hex));
        }
      }
      fromBlock = toBlock;
    }
    logger.info(`from:${_fromBlock}, to:${toBlock}`);
    try {
      profileIds = Array.from(new Set(profileIds));
      pubIds = Array.from(new Set(pubIds));
      logger.info(`Profile number:${profileIds.length}, publication number:${pubIds.length}`);
      await updateData(subCtx, profileIds, pubIds, isStopped);
      if (isStopped()) 
        throw new Error("Stop record break point due to stopped.");
      await dbOperator.setSyncedBlockNumber(toBlock);
    } catch (e: any) {
      logger.error(`Process lens logs failed, ${e}`);
    }
  } catch (e: any) {
    logger.error(`Get logs from polychain(block range:${fromBlock}~${toBlock}) failed,error:${e}.`);
  }
}

async function getCurrentBlock(context: AppContext): Promise<number> {
  const logger = context.logger;
  let tryout = 10;
  while (--tryout >= 0) {
    try {
      const res = await axios.post(
        POLYGON_ENDPOINT,
        {
          id: 1,
          jsonrpc: "2.0",
          method: "eth_blockNumber",
          params: []
        }
      );
      return parseInt(res.data.result, 16);
    } catch (e: any) {
      logger.warn(`Get block number error:${e}`);
    }
  }
  return -1;
}

export async function createMonitorTask(
  context: AppContext,
  loggerParent: Logger,
): Promise<SimpleTask> {
  const interval = 5 * 1000;
  return makeIntervalTask(
    0,
    interval,
    'lens-monitor',
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
  await Bluebird.map(promises, async (promise: any) => await promise );
}

async function updateProfiles(
  context: AppContext, 
  profileIds: string[], 
  isStopped: IsStopped,
): Promise<void> {
  const logger = context.logger;
  const dbOperator = createDBOperator(context.database);
  let offset = 0;
  while (offset < profileIds.length && !isStopped()) {
    try {
      await Bluebird.delay(1 * 1000);
      const profiles = await getProfiles({
        profileIds: profileIds.slice(offset,offset+LENS_DATA_LIMIT),
        limit: LENS_DATA_LIMIT,
      })
      //await dbOperator.insertProfiles(profiles.items);
      await Bluebird.map(profiles.items, async (profile: any) => {
        if (!isStopped()) {
          dbOperator.updateProfile(profile);
        }
      }, { concurrency: MAX_TASK } );
      offset = offset + LENS_DATA_LIMIT;
    } catch (e: any) {
      logger.error(`Get profiles failed,error:${e}`);
      if (e.statusCode === 404) {
        break;
      }
      if (e.networkError.statusCode === 429) {
        await Bluebird.delay(5 * 60 * 1000);
      }
    }
  }
}

async function updatePublications(
  context: AppContext,
  pubIds: string[],
  isStopped: IsStopped
): Promise<void> {
  const logger = context.logger;
  const dbOperator = createDBOperator(context.database);
  let offset = 0;
  while (offset < pubIds.length && !isStopped()) {
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
      if (e.statusCode === 404) {
        break;
      }
      if (e.networkError.statusCode === 429) {
        await Bluebird.delay(5 * 60 * 1000);
      }
    }
  }
}
