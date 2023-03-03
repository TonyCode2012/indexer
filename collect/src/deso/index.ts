import Bluebird from 'bluebird';
import { AppContext } from '../types/context.d';
import { SimpleTask } from '../types/tasks.d';
import { createProfileTask } from './tasks/get-profile';
import { createPublicationTask } from './tasks/get-publication';
import { createChildLogger } from '../utils/logger';

export async function createDesoTasks(
  context: AppContext
): Promise<SimpleTask[]> {
  const logger = createChildLogger({ moduleId: 'deso-tasks' });
  let tasks = [
    createProfileTask,
    createPublicationTask,
    //createMonitorTask,
  ];
  return Bluebird.mapSeries(tasks, (t) => {
    return t(context, logger);
  });
}
