import { Card } from '../types/game';

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 102050432
 * Card2 Row: 307
 * Card Row: 546
 * Source CardNo: BT04-R06
 * Package: BT04(ESR,OHR)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 【速攻】
 * 【永】：你的战场上只能有一个神蚀单位。所有对手只能在他自己的回合中使用故事卡。
 * 【启】〖同名一回合一次〗：[从你的手牌，卡组，墓地放逐合计两张「迪凯」的神蚀卡]将这个单位重置。本回合中，这个单位的下一次攻击可以攻击对手的单位。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '102050432',
  fullName: '骑士团长「迪凯」',
  specialName: '迪凯',
  type: 'UNIT',
  color: 'RED',
  gamecardId: null as any,
  colorReq: { RED: 2 },
  faction: '伊列宇王国',
  acValue: 5,
  power: 4000,
  basePower: 4000,
  damage: 4,
  baseDamage: 4,
  godMark: true,
  displayState: 'FRONT_UPRIGHT',
  isExhausted: false,
  isrush: true,
  canAttack: true,
  feijingMark: false,
  canResetCount: 0,
  effects: [],
  rarity: 'SER',
  availableRarities: ['SER'],
  cardPackage: 'BT04',
  uniqueId: null as any,
};

export default card;
