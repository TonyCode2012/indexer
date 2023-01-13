import { 
  AchievementsTmpls,
  TasksTmpls,
} from './templates';
import { MongoDB } from '../db';

export const Apps = [
  {
    _id: "0x1",
    name: "NoSocial",
    description: "The gate to decentralized and more",
    picture: "https://xxx",
    achievements: ["0x1"],
    url: ".../..."
  },
  {
    _id: "0x2",
    name: "Lenster",
    description: "Lenster is a composable, decentralized, and permissionless social media web app built with Lens Protocol.",
    achievements: ["0x2", "0x3"],
    picture: "https://xxx",
    url: ".../..."
  }
]

export const Achievements = [
  {
    _id: "0x1",
    contractAddress: "",
    name: "100 Lens Followers",
    category: "popularity",
    provider: "NoSocial",
    description: "Have 100 followers on the lens protocol",
    picture: "",
    totalAmount: -1,
    args: {
      startedAt: "2022-10-10T00:00:00.000Z",
      num: 100,
      appIds: ["all"],
    },
    tmpl: AchievementsTmpls.nFollowers,
  },
  {
    _id: "0x2",
    contractAddress: "",
    name: "20 Posts",
    category: "publictions",
    provider: "Lenster",
    description: "Published 20 posts on lenster",
    picture: "",
    totalAmount: -1,
    args: {
      startedAt: "2022-10-10T00:00:00.000Z",
      num: 20,
      appIds: ["lenster"],
    },
    tmpl: AchievementsTmpls.nPosts,
  },
  {
    _id: "0x3",
    contractAddress: "",
    name: "Send posts for three consecutive days",
    category: "time",
    provider: "Lenster",
    description: "Use the Lenster APP to send post works for three consecutive days to get this reward",
    picture: "",
    totalAmount: -1,
    args: {
      startedAt: "2022-10-10T00:00:00.000Z",
      num: 3,
      appIds: ["lenster"],
    },
    tmpl: AchievementsTmpls.nDaysConsecutivePost,
  },
]

export const Benefits = [
  {
    _id: "0x1",
    rewardType: "token",
    category: "airdrop",
    provider: "Lenster",
    name: "100 Matic Airdrop",
    benefitName: "Lenster active user",
    description: "Lenster is a composable, decentralized, and permissionless social media web app built with Lens Protocol. Use Lenster and get the airdrop",
    picture: "https://xxx",
    providerPicture: "https://xxx",
    tasks: ["0x1", "0x2", "0x3"]
  },
]

export const Tasks = [
  {
    _id: "0x1",
    name: "100 Lens Followers",
    category: "popularity",
    provider: "NoSocial",
    description: "Have 100 followers on the lens protocol",
    url: "",
    args: {
      startedAt: "2022-10-10T00:00:00.000Z",
      num: 100,
      appIds: ["all"],
    },
    tmpl: TasksTmpls.nFollowers,
  },
  {
    _id: "0x2",
    name: "20 Posts",
    category: "publictions",
    provider: "Lenster",
    description: "Published 20 posts on lenster",
    url: "",
    args: {
      startedAt: "2022-10-10T00:00:00.000Z",
      num: 20,
      appIds: ["lenster"],
    },
    tmpl: TasksTmpls.nPosts,
  },
  {
    _id: "0x3",
    name: "Send posts for three consecutive days",
    category: "time",
    provider: "Lenster",
    description: "Use the Lenster APP to send post works for three consecutive days to get this reward",
    url: "",
    args: {
      startedAt: "2022-10-10T00:00:00.000Z",
      num: 3,
      appIds: ["lenster"],
    },
    tmpl: TasksTmpls.nDaysConsecutivePost,
  },
]
