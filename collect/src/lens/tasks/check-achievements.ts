import Bluebird from 'bluebird';
import { Logger } from 'winston';
import { SimpleTask } from '../../types/tasks.d';
import { Achievement } from '../../types/rules.d';
import { AppContext } from '../../types/context.d';
import { createDBOperator } from '../../db/operator';
import { Achievements } from '../../rules';
import { makeIntervalTask, IsStopped } from '../../tasks/task-utils';

export enum AchievementStatus {
  NOTSTART = 'notStart',
  READY = 'ready',
  UNCLAIMED = 'unclaimed',
  CLAIMING = 'claiming',
  ACHIEVED = 'achieved'
}

async function handleAchievement(
  context: AppContext,
  logger: Logger,
  _isStopped: IsStopped,
): Promise<void> {
  try {
    const dbOperator = createDBOperator(context.database);
    await Bluebird.map(Achievements, async (achv: Achievement) => {
      const profileIds = await achv.tmpl(context, achv.args);
      const achvs: any[] = [];
      for (const profileId of profileIds) {
        achvs.push({
          _id: profileId + '-' + achv._id,
          achvId: achv._id,
          profileId: profileId,
          category: achv.category,
          provider: achv.provider,
          name: achv.name,
          description: achv.description,
          picture: achv.picture,
          tokenId: null,
          url: null,
          status: AchievementStatus.READY,
        });
      }
      await dbOperator.insertAchievements(achvs);
    });
  } catch (e: any) {
    logger.error(`Check achievements failed, error:${e}`);
  }
}

export async function createAchievementTask(
  context: AppContext,
  loggerParent: Logger,
): Promise<SimpleTask> {
  const interval = 15 * 1000;
  return makeIntervalTask(
    0,
    interval,
    'lens-achievements',
    context,
    loggerParent,
    handleAchievement,
    '🎖',
  );
}
