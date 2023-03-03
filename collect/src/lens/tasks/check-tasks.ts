import Bluebird from 'bluebird';
import axios from 'axios';
import { Logger } from 'winston';
import { AppContext } from '../../types/context.d';
import { SimpleTask } from '../../types/tasks.d';
import { NoSocialTask } from '../../types/rules.d';
import { createDBOperator } from '../../db/operator';
import { Tasks } from '../../rules';
import { IsStopped, makeIntervalTask } from '../../tasks/task-utils';

async function handleTasks(
  context: AppContext,
  logger: Logger,
  _isStopped: IsStopped,
): Promise<void> {
  try {
    const dbOperator = createDBOperator(context.database);
    await Bluebird.map(Tasks, async (task: NoSocialTask) => {
      const profileIds = await task.tmpl(context, task.args);
      const tasks: any[] = [];
      for (const profileId of profileIds) {
        tasks.push({
          _id: profileId + '-' + task._id,
          taskId: task._id,
          profileId: profileId,
          category: task.category,
          provider: task.provider,
          name: task.name,
          description: task.description,
          url: task.url,
        });
      } 
      await dbOperator.insertTasks(tasks);
    });
  } catch (e: any) {
    logger.error(`Check achievements failed, error:${e}`);
  }
}

export async function createTasksTask(
  context: AppContext,
  loggerParent: Logger,
): Promise<SimpleTask> {
  const interval = 15 * 1000;
  return makeIntervalTask(
    0,
    interval,
    'lens-tasks',
    context,
    loggerParent,
    handleTasks,
    '🎁',
  )
}
