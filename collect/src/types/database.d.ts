export interface DbOperator {
  insertOne: (collName: string, data: any) => Promise<void>;
  insertMany: (collName: string, data: any[]) => Promise<void>;
  insertAchievement: (data: any) => Promise<any>;
  insertAchievements: (data: any[]) => Promise<any>;
  insertTasks: (data: any[]) => Promise<any>;
  insertWhitelist: (data: any) => Promise<any>;
  insertWhitelists: (data: any[]) => Promise<any>;
  insertProfile: (data: any) => Promise<any>;
  insertProfiles: (data: any[]) => Promise<any>;
  insertPublication: (data: any) => Promise<any>;
  insertPublications: (data: any[]) => Promise<void>;
  deleteStop: () => Promise<void>;
  deleteOne: (collName: string, query: any) => Promise<void>;
  deleteMany: (collName: string, query: any) => Promise<void>;
  updateProfile: (data: any) => Promise<void>;
  updateProfiles: (query: any, update: any) => Promise<void>;
  updateProfileEx: (query: any, data: any, options?: any) => Promise<void>;
  updatePublication: (data: any) => Promise<void>;
  updatePublicationEx: (query: any, data: any, options?: any) => Promise<void>;
  updateProfileCursor: (cursor: any, status?: string) => Promise<void>;
  updateProfileTimestamp: (id: string, timestamp: number) => Promise<void>;
  updatePublicationCursor: (id: string, cursor: string) => Promise<void>;
  updateProfileCursorAndTimestamp: (id: string, cursor: string, timestamp: number) => Promise<void>;
  findOneAndUpdateProfile: (filter: any, update: any, options: any) => Promise<void>;
  setSyncedBlockNumber: (blockNumber: number) => Promise<void>;
  setStartBlockNumber: () => Promise<void>;
  setLastUpdateTimestamp: (timestamp: number) => Promise<void>;
  setStop: () => Promise<void>;
  getStop: () => Promise<boolean>;
  getDefaultProfileByAddress: (string: address) => Promise<any>;
  getProfileCursor: () => Promise<string>;
  getPublicationById: (string: id) => Promise<any>;
  getPublicationCursor: (id: string) => Promise<string>;
  getProfileIdsWithLimit: (limit?: number) => Promise<string[]>;
  getSyncedBlockNumber: () => Promise<number>;
  getStartBlockNumber: () => Promise<number>;
  getStatus: () => Promise<any>;
  getWhiteList: () => Promise<string[]>;
  getWhitelistProfileIds: () => Promise<string[]>;
  getOrSetLastUpdateTimestamp: () => Promise<number>;
}
