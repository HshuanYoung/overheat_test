export const FACTIONS = [
  '无',
  '百濑之水城',
  '九尾商会联盟',
  '冒险家工会',
  '魔王不死传说'
] as const;

export type Faction = (typeof FACTIONS)[number];
