import Bluebird from 'bluebird';
import { AppContext } from '../types/context.d';
import { SimpleTask } from '../types/tasks.d';
import { createChildLogger } from '../utils/logger';
import { createDBOperator } from '../db/operator';
import { createProfileTask } from './profile-task';
import { createPublicationTask } from './publication-task';
import { createWhitelistTask } from './whitelist-task';
import { createMonitorTask } from './monitor';
import { createAchievementTask } from './check-achievements';
import { createTasksTask } from './check-tasks';
import { createChildLoggerWith } from '../utils/logger';
import {
  Apps,
  Achievements,
  Benefits,
  Tasks,
} from '../rules';
import {
  ACHV_TMPL_COLL,
  BENEFIT_TMPL_COLL,
  TASK_TMPL_COLL,
  APP_COLL,
} from '../config';

export async function createSimpleTasks(
  context: AppContext
): Promise<SimpleTask[]> {
  const dbOperator = createDBOperator(context.database);
  await dbOperator.setStartBlockNumber();

  // Insert tmpls
  await dbOperator.insertMany(ACHV_TMPL_COLL, Achievements);
  await dbOperator.insertMany(BENEFIT_TMPL_COLL, Benefits);
  await dbOperator.insertMany(TASK_TMPL_COLL, Tasks);
  await dbOperator.insertMany(APP_COLL, Apps);

  const logger = createChildLogger({ moduleId: 'simple-tasks' });
  let tasks = [
    //createProfileTask,
    //createPublicationTask,
    //createWhitelistTask,
    //createAchievementTask,
    //createTasksTask,
    createMonitorTask,
  ];
  return Bluebird.mapSeries(tasks, (t) => {
    return t(context, logger);
  });
}
