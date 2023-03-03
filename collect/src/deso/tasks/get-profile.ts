import Bluebird from 'bluebird';
import { Logger } from 'winston';
import { createDBOperator } from '../../db/operator';
import { makeIntervalTask, IsStopped } from '../../tasks/task-utils';
import { SimpleTask } from '../../types/tasks.d';
import { AppContext } from '../../types/context.d';
import { DESO_ENDPOINT, DESO_DATA_LIMIT } from '../../config';

const axios = require('axios');

async function handleProfiles(
  context: AppContext,
  logger: Logger,
  _isStopped: IsStopped,
): Promise<void> {
  try {
    const dbOperator = createDBOperator(context.database);
    let { cursor, status } = await dbOperator.getDesoProfileCursor();
    if (status === 'complete') return;
    const res = await axios.post(
      DESO_ENDPOINT + "/api/v0/get-profiles",
      {
        NumToFetch: DESO_DATA_LIMIT,
        NextPublicKey: cursor
      },
      {
        "content-type": "application/json"
      }
    );
    const { ProfilesFound, NextPublicKey } = res.data;
    if (ProfilesFound) {
      const profiles = ProfilesFound.map((p: any) => {
        return {
          _id: p.PublicKeyBase58Check,
          username: p.Username,
          description: p.Description,
          isHidden: p.IsHidden,
          isReserved: p.IsReserved,
          isVerified: p.IsVerified,
          isFeaturedTutorialWellKnownCreator: p.IsFeaturedTutorialWellKnownCreator,
          isFeaturedTutorialUpAndComingCreator: p.IsFeaturedTutorialUpAndComingCreator,
          extraData: p.ExtraData
        }
      })
      await dbOperator.insertDesoProfiles(profiles);
    }
    // Update cursor for unexpected crash
    cursor = NextPublicKey;
    if (cursor !== null) {
      await dbOperator.updateDesoProfileCursor(cursor);
    } else {
      await dbOperator.updateDesoProfileCursor(cursor, 'complete');
    }
  } catch(e: any) {
    logger.error(`Get deso profile error, error:${e}`);
  }
}

export async function createProfileTask(
  context: AppContext,
  loggerParent: Logger,
): Promise<SimpleTask> {
  const interval = 5 * 1000;
  return makeIntervalTask(
    0,
    interval,
    'deso-profiles',
    context,
    loggerParent,
    handleProfiles,
    '🧑',
  );
}
