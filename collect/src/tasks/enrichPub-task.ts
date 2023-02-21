import { Logger } from 'winston';
import { AppContext } from '../types/context.d';
import { DbOperator } from '../types/database.d';
import { createDBOperator } from '../db/operator';
import { IsStopped } from './task-utils';
import { SimpleTask } from '../types/tasks.d';
import { makeIntervalTask } from './task-utils';

async function handleUpdateUncompletePubs(
  context: AppContext,
  logger: Logger,
  isStopped: IsStopped,
): Promise<void> {
  const dbOperator = createDBOperator(context.database);
  await dbOperator.updateUncompletePubs();
}

export async function createEnrichPubTask(
  context: AppContext,
  loggerParent: Logger,
): Promise<SimpleTask> {
  const interval = 3 * 1000;
  return makeIntervalTask(
    0,
    interval,
    'enrich-pub',
    context,
    loggerParent,
    handleUpdateUncompletePubs,
    '🔧',
  );
}
