import { Function2 } from 'lodash';
import { AppContext } from './context.d';

export interface AchvArgs {
  startedAt: string;
  num: number;
  appIds: string[];
}

export interface Achievement {
  _id: string;
  contractAddress: string;
  name: string;
  category: string;
  provider: string;
  description: string;
  picture: string;
  totalAmount: number;
  args: AchvArgs;
  tmpl: Function2<AppContext, AchvArgs, Promise<string[]>>;
}

export interface TaskArgs {
  startedAt: string;
  num: number;
  appIds: string[];
}

export interface NoSocialTask {
  _id: string;
  name: string;
  category: string;
  provider: string;
  description: string;
  url: string;
  args: AchvArgs;
  tmpl: Function2<AppContext, AchvArgs, Promise<string[]>>;
}
