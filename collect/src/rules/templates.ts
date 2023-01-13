import { MongoDB } from '../db';
import { AppContext } from '../types/context.d';
import { Dayjs } from '../utils/datetime';
import {
  AchvArgs,
  TaskArgs,
} from '../types/rules.d';
import {
  PROFILE_COLL,
  PUBLICATION_COLL,
  CURSOR_COLL,
} from "../config";

export const AchievementsTmpls = {
  nFollowers: async (context: AppContext, args: AchvArgs): Promise<string[]> => {
    const { startedAt, num, appIds } = args;
    if (appIds.length === 0) {
      throw new Error('Apps name not be indicated.')
    }
    const res: string[] = [];
    const query = ((appIds: string[]) => {
      if (appIds[0] === 'all') {
        return { 
          "stats.totalFollowers": { $gte: num } 
        };
      } else {
        return {
          "stats.totalFollowers": { $gte: num },
          appId: { $in: appIds },
        }
      }
    })(appIds);
    const ids = await context.database.dbHandler.collection(PROFILE_COLL).find(
      query,
      { _id: 1 },
    ).toArray();
    for (const { _id } of ids) {
      res.push(_id);
    }
    return res;
  },
  nPosts: async (context: AppContext, args: AchvArgs): Promise<string[]> => {
    const { startedAt, num, appIds } = args;
    if (appIds.length === 0) {
      throw new Error('Apps name not be indicated.')
    }
    const res: string[] = [];
    // ***NOTE***: why number of posts not equal to the one fetched from lens api
    const query = ((appIds: string[]) => {
      if (appIds[0] === 'all') {
        return { 
          "stats.totalPosts": { $gte: num } 
        };
      } else {
        return {
          "stats.totalPosts": { $gte: num },
          appId: { $in: appIds },
        }
      }
    })(appIds);
    const ids = await context.database.dbHandler.collection(PROFILE_COLL).find(
      query,
      { _id: 1 },
    ).toArray();
    /*
    const stages = ((appIds: string[]) => {
      const stageArray: any[] = [];
      if (appIds[0] !== 'all') {
        stageArray.push({
          $match: {
            appId: { $in: appIds },
          }
        });
      }
      stageArray.push(...[
        {
          $group: {
            _id: "$profile.id",
            num: { $sum: 1 },
          },
        },
        { 
          $match: {
            num: { $gte: num },
          },
        },
      ]);
      return stageArray;
    })(appIds);
    const ids = await context.database.dbHandler.collection(PUBLICATION_COLL).aggregate(stages);
    */
    for (const { _id } of ids) {
      res.push(_id);
    }
    return res;
  },
  nDaysConsecutivePost: async (context: AppContext, args: AchvArgs): Promise<string[]> => {
    const { startedAt, num, appIds } = args;
    if (appIds.length === 0) {
      throw new Error('Apps name not be indicated.')
    }
    const logger = context.logger;
    //const startDate = Dayjs().subtract(num-1, 'day').format('YYYY-MM-DD');
    const startDate = Dayjs('2022-12-01').format('YYYY-MM-DD');
    const res: string[] = [];
    const stages = ((appIds: string[]) => {
      const stageArray: any[] = [];
      if (appIds[0] === 'all') {
        stageArray.push({
          $match: {
            createdAt: { $gte: startDate },
          }
        });
      } else {
        stageArray.push({
          $match: {
            appId: { $in: appIds },
            createdAt: { $gte: startDate },
          }
        });
      }
      stageArray.push(...[
        {
          $group: {
            _id: "$profile.id",
            diff: { $sum: 1 },
            dates: { $addToSet: "$createdAt" },
          }
        },
        {
          $match: {
            diff: { $gte: num },
          }
        },
      ]);
      return stageArray;
    })(appIds);
    const items = await context.database.dbHandler.collection(PUBLICATION_COLL).aggregate(stages).toArray();
    for (const item of items) {
      if (item.dates.length > 0) {
        const formatter = 'YYYY-MM-DD';
        item.dates.sort();
        let curDate = item.dates[0];
        let acc = 1;
        for (let i = 1; i < item.dates.length; i++) {
          const nextDate = item.dates[i];
          if (Dayjs(curDate).add(1, 'day').format(formatter) === Dayjs(nextDate).format(formatter)) {
            if (++acc === num) {
              res.push(item._id);
              break;
            }
          } else {
            acc = 1;
          }
          curDate = nextDate;
        }
      }
    }
    return res;
  },
}

export const TasksTmpls = {
  nFollowers: async (context: AppContext, args: TaskArgs): Promise<string[]> => {
    const { startedAt, num, appIds } = args;
    if (appIds.length === 0) {
      throw new Error('Apps name not be indicated.')
    }
    const res: string[] = [];
    const query = ((appIds: string[]) => {
      if (appIds[0] === 'all') {
        return { 
          "stats.totalFollowers": { $gte: num } 
        };
      } else {
        return {
          "stats.totalFollowers": { $gte: num },
          appId: { $in: appIds },
        }
      }
    })(appIds);
    const ids = await context.database.dbHandler.collection(PROFILE_COLL).find(
      query,
      { _id: 1 },
    ).toArray();
    for (const { _id } of ids) {
      res.push(_id);
    }
    return res;
  },
  nPosts: async (context: AppContext, args: TaskArgs): Promise<string[]> => {
    const { startedAt, num, appIds } = args;
    if (appIds.length === 0) {
      throw new Error('Apps name not be indicated.')
    }
    const res: string[] = [];
    // ***NOTE***: why number of posts not equal to the one fetched from lens api
    const query = ((appIds: string[]) => {
      if (appIds[0] === 'all') {
        return { 
          "stats.totalPosts": { $gte: num } 
        };
      } else {
        return {
          "stats.totalPosts": { $gte: num },
          appId: { $in: appIds },
        }
      }
    })(appIds);
    const ids = await context.database.dbHandler.collection(PROFILE_COLL).find(
      query,
      { _id: 1 },
    ).toArray();
    for (const { _id } of ids) {
      res.push(_id);
    }
    return res;
  },
  nDaysConsecutivePost: async (context: AppContext, args: TaskArgs): Promise<string[]> => {
    const { startedAt, num, appIds } = args;
    if (appIds.length === 0) {
      throw new Error('Apps name not be indicated.')
    }
    const logger = context.logger;
    const formatter = 'YYYY-MM-DD';
    const startDate = Dayjs('2022-12-01').format(formatter);
    const res: string[] = [];
    const stages = ((appIds: string[]) => {
      const stageArray: any[] = [];
      if (appIds[0] === 'all') {
        stageArray.push({
          $match: {
            createdAt: { $gte: startDate },
          }
        });
      } else {
        stageArray.push({
          $match: {
            appId: { $in: appIds },
            createdAt: { $gte: startDate },
          }
        });
      }
      stageArray.push(...[
        {
          $group: {
            _id: "$profile.id",
            diff: { $sum: 1 },
            dates: { $addToSet: "$createdAt" },
          }
        },
        {
          $match: {
            diff: { $gte: num },
          }
        },
      ]);
      return stageArray;
    })(appIds);
    const items = await context.database.dbHandler.collection(PUBLICATION_COLL).aggregate(stages).toArray();
    for (const item of items) {
      if (item.dates.length > 0) {
        item.dates.sort();
        let curDate = item.dates[0];
        let acc = 1;
        for (let i = 1; i < item.dates.length; i++) {
          const nextDate = item.dates[i];
          if (Dayjs(curDate).add(1, 'day').format(formatter) === Dayjs(nextDate).format(formatter)) {
            if (++acc === num) {
              res.push(item._id);
              break;
            }
          } else {
            acc = 1;
          }
          curDate = nextDate;
        }
      }
    }
    return res;
  },
}
