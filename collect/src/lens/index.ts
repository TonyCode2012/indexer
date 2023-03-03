import Bluebird from 'bluebird';
import { AppContext } from '../types/context.d';
import { SimpleTask } from '../types/tasks.d';
import { createChildLogger } from '../utils/logger';
import { createProfileTask } from './tasks/get-profile';
import { createPublicationTask } from './tasks/get-publication';
import { createAchievementTask } from './tasks/check-achievements';
import { createTasksTask } from './tasks/check-tasks';
import { createMonitorTask } from './tasks/monitor';
import { createWhitelistTask } from './tasks/update-whitelist';

export async function createLensTasks(
  context: AppContext
): Promise<SimpleTask[]> {
  const logger = createChildLogger({ moduleId: 'lens-tasks' });
  let tasks = [
    createProfileTask,
    createPublicationTask,
    createMonitorTask,
    createAchievementTask,
    createTasksTask,
    createWhitelistTask,
  ];
  return Bluebird.mapSeries(tasks, (t) => {
    return t(context, logger);
  });
}
