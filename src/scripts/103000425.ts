import { Card } from '../types/game';

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 103000425
 * Card2 Row: 295
 * Card Row: 534
 * Source CardNo: BT04-G04
 * Package: BT04(SR)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 【诱】：对手的每个回合开始时，将对手卡组顶的X张卡送入墓地（X为你的战场上的这个单位以外的卡名含有《魔女》的单位数。
 * 〖10+〗【启】〖1游戏1次〗:选择你的墓地中的1张卡名含有《魔女》的故事卡，将其放逐。之后，将那张卡的效果当做这个能力的效果并处理（不产生对抗）。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '103000425',
  fullName: '黄昏的魔女「爱丽丝」',
  specialName: '爱丽丝',
  type: 'UNIT',
  color: 'GREEN',
  gamecardId: null as any,
  colorReq: { GREEN: 2 },
  faction: '无',
  acValue: 3,
  power: 2500,
  basePower: 2500,
  damage: 1,
  baseDamage: 1,
  godMark: true,
  displayState: 'FRONT_UPRIGHT',
  isExhausted: false,
  isrush: false,
  canAttack: true,
  feijingMark: false,
  canResetCount: 0,
  effects: [],
  rarity: 'SR',
  availableRarities: ['SR'],
  cardPackage: 'BT04',
  uniqueId: null as any,
};

export default card;
