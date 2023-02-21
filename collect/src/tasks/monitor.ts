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
import { Alchemy, Network } from 'alchemy-sdk';
import {
  profileUpdateSet,
  pubCreatedSet,
  eventOperator,
} from '../types/event';
import {
  LENS_HUB_CONTRACT,
  LENS_PERIPHERY_CONTRACT,
  MAX_TASK,
  ALCHEMY_API_KEY,
  ALCHEMY_MATIC_ENDPOINT,
  LENS_TOPICS,
  LENS_EVENT_ABI,
  HTTP_TIMEOUT,
} from '../config';

let currentBlock = -1;
const axios = require('axios');
const axiosInstance = axios.create({
  baseUrl: "https://polygon-mainnet.g.alchemy.com/v2/",
  timeout: HTTP_TIMEOUT,
  headers: { "accept": "application/json", "content-type": "application/json" },
});

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

  // Optional config object, but defaults to the API key 'demo' and Network 'eth-mainnet'.
  // const settings = {
  //   apiKey: ALCHEMY_API_KEY, // Replace with your Alchemy API key.
  //   network: Network.MATIC_MAINNET, // Replace with your network.
  //   batchRequests: true,
  //   url: "https://polygon-mainnet.g.alchemy.com/v2/byjAB841iQ7fkRSAhnVvfkPBp40ARv9z",
  // };
  // const alchemy = new Alchemy(settings);
  // console.log(alchemy)
  const lensIface = new ethers.utils.Interface(LENS_EVENT_ABI);

  let events: any[] = [];
  let toBlock = 0;
  logger.info(`Getting block from:${fromBlock}...`);
  try {
    let acc = 5;
    while (--acc >= 0) {
      toBlock = fromBlock + 2000;
      if (currentBlock === -1 || toBlock > currentBlock) {
        currentBlock = await getCurrentBlock(context);
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
        ALCHEMY_MATIC_ENDPOINT + "/" + ALCHEMY_API_KEY,
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
        events.push(lensIface.parseLog(log));
      }
      fromBlock = toBlock;
    }
    logger.info(`Getting block to:${toBlock}`);
    try {
      await eventHub(context, events, isStopped);
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
        ALCHEMY_MATIC_ENDPOINT + "/" + ALCHEMY_API_KEY,
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

async function eventHub(
  context: AppContext,
  events: any[],
  isStopped: IsStopped
): Promise<void> {
  const logger = context.logger;
  const dbOperator = createDBOperator(context.database);
  const profileCreatedArry = [];
  const profileUpdateMap = new Map<string,Map<string,any>>();
  const pubCreatedArry = [];
  const othersArry = [];
  for (const event of events) {
    const eventName = event.name;
    if (eventName === "ProfileCreated") {
      profileCreatedArry.push(event);
    } else if (profileUpdateSet.has(eventName)) {
      const profileId = event.args.profileId._hex;
      let eventMap = profileUpdateMap.get(profileId);
      if (eventMap === null || eventMap === undefined) {
        eventMap = new Map<string,any>();
        profileUpdateMap.set(profileId, eventMap);
      }
      eventMap.set(eventName, event);
    } else if (pubCreatedSet.has(eventName)) {
      pubCreatedArry.push(event);
    } else {
      othersArry.push(event);
    }
  }
  const profileUpdateArry: any[] = [];
  for (const m of profileUpdateMap.values()) {
    profileUpdateArry.push(...Array.from(m.values()));
  }

  logger.info(`created profile num:${profileCreatedArry.length}`);
  logger.info(`update profile num:${profileUpdateArry.length}`);
  logger.info(`created publication num:${pubCreatedArry.length}`);
  logger.info(`others num:${othersArry.length}`);

  // Process 'ProfileCreated' event
  logger.info("Processing profile create...");
  await Bluebird.map(profileCreatedArry, async (event: any) => {
    const eventFunc = eventOperator.get(event.name);
    if (!isStopped() && eventFunc !== null && eventFunc !== undefined) {
      await eventFunc(dbOperator, event)
    }
  }, { concurrency : MAX_TASK })

  // Process profile update related event
  logger.info("Processing profile update...");
  await Bluebird.map(profileUpdateArry, async (event: any) => {
    const eventFunc = eventOperator.get(event.name);
    if (!isStopped() && eventFunc !== null && eventFunc !== undefined) {
      await eventFunc(dbOperator, event)
    }
  }, { concurrency : MAX_TASK })

  // Process publication created related event
  logger.info("Processing publication create...");
  await Bluebird.map(pubCreatedArry, async (event: any) => {
    const eventFunc = eventOperator.get(event.name);
    if (!isStopped() && eventFunc !== null && eventFunc !== undefined) {
      await eventFunc(dbOperator, event)
    }
  }, { concurrency : MAX_TASK })

  // Process other event
  logger.info("Processing others...");
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
  const interval = 1 * 1000;
  return makeIntervalTask(
    0,
    interval,
    'monitor-chain',
    context,
    loggerParent,
    handleMonitor,
    '👀',
  );
}
