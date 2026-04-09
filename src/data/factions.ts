export const FACTIONS = [
  '无',
  '百濑之水城',
  '九尾商会联盟',
  '冒险家工会'
] as const;

export type Faction = (typeof FACTIONS)[number];
