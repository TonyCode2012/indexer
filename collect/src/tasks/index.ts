import Bluebird from 'bluebird';
import { AppContext } from '../types/context.d';
import { SimpleTask } from '../types/tasks.d';
import { createDBOperator } from '../db/operator';
import { createDesoTasks } from '../deso';
import { createLensTasks } from '../lens';
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

export async function createTasks(
  context: AppContext
): Promise<SimpleTask[]> {
  const dbOperator = createDBOperator(context.database);
  await dbOperator.setStartBlockNumber();

  // Insert tmpls
  await dbOperator.insertMany(ACHV_TMPL_COLL, Achievements);
  await dbOperator.insertMany(BENEFIT_TMPL_COLL, Benefits);
  await dbOperator.insertMany(TASK_TMPL_COLL, Tasks);
  await dbOperator.insertMany(APP_COLL, Apps);

  const desoTasks = await createDesoTasks(context);
  //const lensTasks = await createLensTasks(context);

  //return [...desoTasks, ...lensTasks];
  return [...desoTasks];
}
