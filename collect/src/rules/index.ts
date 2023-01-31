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
    picture: "https://raw.githubusercontent.com/nosocialxyz/apps/main/src/assets/images/logo640.png",
    achievements: ["0x1"],
    url: "https://nosocial.xyz/"
  },
  {
    _id: "0x2",
    name: "lenster",
    description: "Lenster is a composable, decentralized, and permissionless social media web app built with Lens Protocol.",
    achievements: ["0x2", "0x3"],
    picture: "https://raw.githubusercontent.com/nosocialxyz/apps/main/public/assets/images/3.svg",
    url: "https://lenster.xyz/"
  }
]

export const Achievements = [
  {
    _id: "0x1",
    contractAddress: "0x9B82DAF85E9dcC4409ed13970035a181fB411542",
    name: "100 Lens Followers",
    category: "popularity",
    provider: "NoSocial",
    description: "Have 100 followers on the lens protocol",
    picture: "https://data.nosocial.xyz/achievements/0x1.png",
    totalAmount: -1,
    args: {
      startedAt: "2021-10-10T00:00:00.000Z",
      num: 100,
      appIds: ["all"],
    },
    tmpl: AchievementsTmpls.nFollowers,
  },
  {
    _id: "0x2",
    contractAddress: "0x9B82DAF85E9dcC4409ed13970035a181fB411542",
    name: "20 Posts",
    category: "publictions",
    provider: "lenster",
    description: "Published 20 posts on lenster",
    picture: "https://data.nosocial.xyz/achievements/0x2.png",
    totalAmount: -1,
    args: {
      startedAt: "2021-10-10T00:00:00.000Z",
      num: 20,
      appIds: ["lenster"],
    },
    tmpl: AchievementsTmpls.nPosts,
  },
  {
    _id: "0x3",
    contractAddress: "0x9B82DAF85E9dcC4409ed13970035a181fB411542",
    name: "3 days post",
    category: "time",
    provider: "lenster",
    description: "Use the Lenster APP to send post works for three consecutive days to get this reward",
    picture: "https://data.nosocial.xyz/achievements/0x3.png",
    totalAmount: -1,
    args: {
      startedAt: "2021-10-10T00:00:00.000Z",
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
    provider: "lenster",
    name: "100 Matic Airdrop",
    benefitName: "Lenster active user",
    description: "Lenster is a composable, decentralized, and permissionless social media web app built with Lens Protocol. Use Lenster and get the airdrop",
    picture: "https://raw.githubusercontent.com/nosocialxyz/apps/main/public/assets/images/3.svg",
    providerPicture: "https://raw.githubusercontent.com/nosocialxyz/apps/main/public/assets/images/3.svg",
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
    url: "https://nosocial.xyz/",
    args: {
      startedAt: "2021-10-10T00:00:00.000Z",
      num: 100,
      appIds: ["all"],
    },
    tmpl: TasksTmpls.nFollowers,
  },
  {
    _id: "0x2",
    name: "20 Posts",
    category: "publictions",
    provider: "lenster",
    description: "Published 20 posts on lenster",
    url: "https://lenster.xyz/",
    args: {
      startedAt: "2021-10-10T00:00:00.000Z",
      num: 20,
      appIds: ["lenster"],
    },
    tmpl: TasksTmpls.nPosts,
  },
  {
    _id: "0x3",
    name: "Send posts for three consecutive days",
    category: "time",
    provider: "lenster",
    description: "Use the Lenster APP to send post works for three consecutive days to get this reward",
    url: "https://lenster.xyz/",
    args: {
      startedAt: "2021-10-10T00:00:00.000Z",
      num: 3,
      appIds: ["lenster"],
    },
    tmpl: TasksTmpls.nDaysConsecutivePost,
  },
]
