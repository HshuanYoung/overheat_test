export const FACTIONS = [
  '无',
  '百濑之水城',
  '九尾商会联盟',
  '冒险家工会',
  '魔王不死传说',
  '伊列宇王国',
  '圣王国'
] as const;

export type Faction = (typeof FACTIONS)[number];
