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
  let toBlock = fromBlock + 2000;

  try {
    if (currentBlock === -1 || toBlock > currentBlock) {
      currentBlock = await (async (startBlock: number) => {
        let tryout = 10;
        while (--tryout >= 0) {
          try {
            const res = await axios.post(
              "https://polygon-mainnet.g.alchemy.com/v2/byjAB841iQ7fkRSAhnVvfkPBp40ARv9z",
              {
                id: 1,
                jsonrpc: "2.0",
                method: "eth_blockNumber",
                params: []
              }
            );
            const endBlock = parseInt(res.data.result, 16);
            return endBlock >= startBlock ? endBlock : startBlock;
          } catch (e: any) {
            logger.warn(`Get block number error:${e}`);
          }
        }
        return startBlock;
      })(fromBlock);
    }
    if (toBlock > currentBlock) {
      toBlock = currentBlock;
    }
    logger.info(`from:${fromBlock}, to:${toBlock}`)

    const lensFilter = {
      address: [LENS_HUB_CONTRACT, LENS_PERIPHERY_CONTRACT],
      topics: [
        LENS_TOPICS
      ],
      fromBlock: "0x".concat(fromBlock.toString(16)),
      toBlock: "0x".concat(toBlock.toString(16)),
    }

    let events: any[] = [];
    // Get lens hub logs
    const lensLogs = await axios.post(
      "https://polygon-mainnet.g.alchemy.com/v2/byjAB841iQ7fkRSAhnVvfkPBp40ARv9z",
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
      // const event = lensIface.parseLog(log);
      events.push(lensIface.parseLog(log));
    }
    await eventHub(context, events, isStopped);
    if (isStopped()) 
      throw new Error("Stop record break point due to stopped.");
    await dbOperator.setSyncedBlockNumber(toBlock);
  } catch (e: any) {
    logger.error(`Get logs from polychain failed,error:${e}.`);
  }
}

async function eventHub(
  context: AppContext,
  events: any[],
  isStopped: IsStopped
): Promise<void> {
  const logger = context.logger;
  //console.log(Dayjs(event.args.timestamp.toNumber()*1000).toISOString());
  const dbOperator = createDBOperator(context.database);
  const profileCreatedArry = [];
  const profileUpdateMap = new Map<string,Array<any>>();
  const pubCreatedArry = [];
  const othersArry = [];
  for (const event of events) {
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
  }

  logger.info(`created profile num:${profileCreatedArry.length}, created publication num:${pubCreatedArry.length}`);

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
