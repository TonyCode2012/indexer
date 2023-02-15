import * as ep from '../tasks/event-operator';
import { Function2 } from 'lodash';
import { DbOperator } from '../types/database.d';

export type EventFunc = Function2<DbOperator, any, Promise<any>>;

export const profileUpdateSet = new Set([
  "DefaultProfileSet",
  "DispatcherSet",
  "ProfileImageURISet",
  "FollowNFTURISet",
  "FollowModuleSet",
  "ProfileMetadataSet",
  //"Followed",
]);

export const pubCreatedSet = new Set([
  "PostCreated",
  "CommentCreated",
  "MirrorCreated",
]);

export const eventOperator = new Map<string,EventFunc>(Object.entries({
  ProfileCreated: ep.profileCreated,
  DefaultProfileSet: ep.defaultProfileSet,
  DispatcherSet: ep.dispatcherSet,
  ProfileImageURISet: ep.profileImageURISet,
  FollowNFTURISet: ep.followNFTURISet,
  FollowModuleSet: ep.followModuleSet,
  PostCreated: ep.postCreated,
  CommentCreated: ep.commentCreated,
  MirrorCreated: ep.mirrorCreated,
  //FollowNFTDeployed: ep.followNFTDeployed,
  //CollectNFTDeployed: ep.collectNFTDeployed,
  Collected: ep.collected,
  Followed: ep.followed,
  FollowNFTTransferred: ep.followNFTTransferred,
  //CollectNFTTransferred: ep.collectNFTTransferred,
  //FollowNFTInitialized: ep.followNFTInitialized,
  //CollectNFTInitialized: ep.collectNFTInitialized,
  //FollowsApproved: ep.followsApproved,
  //FollowsToggled: ep.followsToggled,
  ProfileMetadataSet: ep.profileMetadataSet,
}))
