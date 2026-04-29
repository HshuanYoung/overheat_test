import { Card } from '../types/game';

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 101140437
 * Card2 Row: 314
 * Card Row: 553
 * Source CardNo: BT04-W03
 * Package: BT04(ESR,OHR)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 【永】：你的战场上只能有一个神蚀单位。
 * 【诱】：你的回合结束时，若你的战场上仅有白色单位，你可以将你卡组中一张ACCESS值+2的白色故事卡加入手牌。
 * 【启】〖同名1回合1次〗：[从你的手牌，卡组，墓地放逐合计两张「丝梅特」的神蚀卡]选择对手的一个单位，将其放逐，回合结束时，将那张卡放置到持有者的战场上。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '101140437',
  fullName: '神罚天使「丝梅特」',
  specialName: '丝梅特',
  type: 'UNIT',
  color: 'WHITE',
  gamecardId: null as any,
  colorReq: { WHITE: 2 },
  faction: '女神教会',
  acValue: 5,
  power: 3500,
  basePower: 3500,
  damage: 3,
  baseDamage: 3,
  godMark: true,
  displayState: 'FRONT_UPRIGHT',
  isExhausted: false,
  isrush: false,
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
