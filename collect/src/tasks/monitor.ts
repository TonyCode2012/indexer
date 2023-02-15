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
  profileUpdateSet,
  pubCreatedSet,
  eventOperator,
  EventFunc,
} from '../types/event';
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
    const currentBlock = await (async (startBlock: number) => {
      let tryout = 10;
      while (--tryout >= 0) {
        const endBlock = await provider.getBlockNumber();
        if (endBlock >= startBlock) {
          return endBlock;
        }
      }
      return startBlock;
    })(fromBlock);
    if (toBlock > currentBlock) {
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
      eventHub(context, event, isStopped);
    }
    // Get lens periphery logs
    const lensPeripheryLogs = await provider.getLogs(lensPeripheryFilter);
    for (const log of lensPeripheryLogs) {
      const event = lensPeripheryIface.parseLog(log);
      eventHub(context, event, isStopped);
    }
    if (isStopped()) 
      throw new Error("Stop record break point due to stopped.");
    await dbOperator.setSyncedBlockNumber(toBlock);
  } catch (e: any) {
    logger.error(`Get logs from polychain failed,error:${e}.`);
  }
}

async function eventHub(
  context: AppContext,
  event: any,
  isStopped: IsStopped
): Promise<void> {
  const dbOperator = createDBOperator(context.database);
  const profileCreatedArry = [];
  const profileUpdateMap = new Map<string,Array<any>>();
  const pubCreatedArry = [];
  const othersArry = [];
  const eventName = event.name;
  if (eventName === "ProfileCreated") {
    profileCreatedArry.push(event);
  } else if (profileUpdateSet.has(eventName)) {
    const profileId = event.args.profileId._hex;
    let eventArry = profileUpdateMap.get(profileId);
    if (eventArry === null || eventArry === undefined) {
      eventArry = new Array<any>();
      profileUpdateMap.set(profileId, eventArry);
    }
    eventArry.push(event);
  } else if (pubCreatedSet.has(eventName)) {
    pubCreatedArry.push(event);
  } else {
    othersArry.push(event);
  }

  // Process 'ProfileCreated' event
  await Bluebird.map(profileCreatedArry, async (event: any) => {
    const eventFunc = eventOperator.get(event.name);
    if (!isStopped() && eventFunc !== null && eventFunc !== undefined) {
      await eventFunc(dbOperator, event)
    }
  }, { concurrency : MAX_TASK })

  // Process profile update related event
  await Bluebird.map(profileUpdateMap.values(), async (events: any) => {
    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      const eventFunc = eventOperator.get(event.name);
      if (eventFunc !== null && eventFunc !== undefined) {
        await eventFunc(dbOperator, event)
      }
      if (isStopped()) {
        return;
      }
    }
  }, { concurrency : MAX_TASK })

  // Process publication created related event
  await Bluebird.map(pubCreatedArry, async (event: any) => {
    const eventFunc = eventOperator.get(event.name);
    if (!isStopped() && eventFunc !== null && eventFunc !== undefined) {
      await eventFunc(dbOperator, event)
    }
  }, { concurrency : MAX_TASK })

  // Process other event
  await Bluebird.map(othersArry, async (event: any) => {
    const eventFunc = eventOperator.get(event.name);
    if (!isStopped() && eventFunc !== null && eventFunc !== undefined) {
      await eventFunc(dbOperator, event)
    }
  }, { concurrency : MAX_TASK })
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
