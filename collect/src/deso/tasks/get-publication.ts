import Bluebird from 'bluebird';
import _ from 'lodash';
import { Logger } from 'winston';
import { SimpleTask } from '../../types/tasks.d';
import { AppContext } from '../../types/context.d';
import { randomRange } from '../../utils';
import { Dayjs } from '../../utils/datetime';
import { createDBOperator } from '../../db/operator';
import { makeIntervalTask, IsStopped } from '../../tasks/task-utils';
import { 
  DESO_ENDPOINT,
  DESO_DATA_LIMIT,
  MAX_TASK
} from '../../config';

const axios = require('axios');

function getPublicationFromRes(res: any): any {
  return {
    _id: res.PostHashHex,
    posterPublicKeyBase58Check: res.PosterPublicKeyBase58Check,
    parentStakeID: res.ParentStakeID,
    content: res.Body,
    imageURLs: res.ImageURLs,
    videoURLs: res.VideoURLs,
    creatorBasisPoints: res.CreatorBasisPoints,
    stakeMultipleBasisPoints: res.StakeMultipleBasisPoints,
    createdAt: Dayjs(res.TimestampNanos/1000000).toISOString(),
    isHidden: res.IsHidden,
    confirmationBlockHeight: res.ConfirmationBlockHeight,
    inMempool: res.InMempool,
    stats: {
      likeCount: res.LikeCount,
      diamondCount: res.DiamondCount,
      commentCount: res.CommentCount,
      repostCount: res.RepostCount,
      quoteRepostCount: res.QuoteRepostCount,
    },
    inGlobalFeed: res.InGlobalFeed,
    inHotFeed: res.InHotFeed,
    isPinned: res.IsPinned,
    postExtraData: res.PostExtraData,
    isNFT: res.IsNFT,
    numNFTCopies: res.NumNFTCopies,
    numNFTCopiesForSale: res.NumNFTCopiesForSale,
    numNFTCopiesBurned: res.NumNFTCopiesBurned,
    hasUnlockable: res.HasUnlockable,
    nftRoyaltyToCreatorBasisPoints: res.NFTRoyaltyToCreatorBasisPoints,
    nftRoyaltyToCoinBasisPoints: res.NFTRoyaltyToCoinBasisPoints,
    additionalDESORoyaltiesMap: res.AdditionalDESORoyaltiesMap,
    additionalCoinRoyaltiesMap: res.AdditionalCoinRoyaltiesMap,
    diamondsFromSender: res.DiamondsFromSender,
    hotnessScore: res.HotnessScore,
    postMultiplier: res.PostMultiplier,
  }
}

async function getCommentsByPostId(
  context: AppContext, 
  id: string
): Promise<void> {
  const logger = context.logger;
  const dbOperator = createDBOperator(context.database);
  let cursor = 0;
  let tryout = 3;
  while (true) {
    try {
      const res = await axios.post(
        DESO_ENDPOINT + "/api/v0/get-single-post",
        {
          PostHashHex: id,
          CommentOffset: cursor,
          CommentLimit: 30
        },
        {
          "content-type": "application/json"
        }
      );
      const { Comments, CommentCount } = res.data;
      if (!Comments) {
        break;
      }
      const comments = Comments.map((c: any) => {
        return getPublicationFromRes(c);
      })
      await dbOperator.insertDesoPublications(comments);
      cursor += comments.length;
      if (cursor >= CommentCount || comments.length === 0) {
        break;
      }
    } catch (e: any) {
      logger.error(`Get comment by profileId(${id}) failed, error:${e}`);
      if (--tryout === 0) {
        break;
      }
    }
  }
}

async function getPublications(
  context: AppContext, 
  id: string,
): Promise<void> {
  const logger = context.logger;
  const dbOperator = createDBOperator(context.database);
  let cursor = await dbOperator.getDesoPublicationCursor(id);
  let tryout = 3;
  while (true) {
    try {
      await Bluebird.delay(randomRange(1, 5) * 1000);
      const res = await axios.post(
        DESO_ENDPOINT + "/api/v0/get-posts-for-public-key",
        {
          PublicKeyBase58Check: id,
          NumToFetch: DESO_DATA_LIMIT,
          LastPostHashHex: cursor
        },
        {
          "content-type": "application/json"
        }
      );
      const { Posts, LastPostHashHex } = res.data;
      if (!Posts) {
        break;
      }
      const posts = Posts.map((p: any) => {
        return getPublicationFromRes(p);
      })
      await dbOperator.insertDesoPublications(posts);
      for (const { _id } of posts) {
        await getCommentsByPostId(context, _id);
      }
      // Update publication cursor for unexpected crash
      cursor = LastPostHashHex;
      if (!cursor) {
        break;
      }
      await dbOperator.updateDesoPublicationCursor(id, cursor);
    } catch (e: any) {
      logger.error(`Get publication(profileId:${id}) failed, error:${e}`);
      if (--tryout === 0) {
        break;
      }
    }
  }
  await dbOperator.updateDesoProfilePullStatus(id, "complete");
  //logger.info(`id:${id},cursor:${cursor} done.`);
}

export async function handlePublications(
  context: AppContext,
  logger: Logger,
  isStopped: IsStopped,
): Promise<void> {
  const dbOperator = createDBOperator(context.database);
  const subCtx = _.cloneDeep(context);
  subCtx.logger = logger;
  try {
    const ids = await dbOperator.getDesoProfileIdsWithLimit();
    if (ids.length === 0) return;
    await Bluebird.map(ids, async (id: any) => {
      if (!isStopped()) {
        await getPublications(subCtx, id)
      }
    }, { concurrency : MAX_TASK / 2 } )
  } catch (e: any) {
    logger.error(`handle posts failed, error:${e}`);
  }
}

export async function createPublicationTask(
  context: AppContext,
  loggerParent: Logger,
): Promise<SimpleTask> {
  const interval = 5 * 1000;
  return makeIntervalTask(
    0,
    interval,
    'deso-publications',
    context,
    loggerParent,
    handlePublications,
    '💎',
  );
}
