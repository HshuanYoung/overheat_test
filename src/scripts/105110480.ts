import { Card } from '../types/game';

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 105110480
 * Card2 Row: 267
 * Card Row: 623
 * Source CardNo: SP01-Y01
 * Package: SP01(R,SPR)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 【诱】〖将你的侵蚀区中的2张黄色正面卡送入墓地〗这个单位进入战场时，若对手场上的单位比你的单位多2个以上，从你的卡组中选择1张黄色非神蚀卡，将其放置到战场上。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '105110480',
  fullName: '拂风迎新「遂汐」',
  specialName: '遂汐',
  type: 'UNIT',
  color: 'YELLOW',
  gamecardId: null as any,
  colorReq: {},
  faction: '学院要塞',
  acValue: 3,
  power: 2500,
  basePower: 2500,
  damage: 2,
  baseDamage: 2,
  godMark: true,
  displayState: 'FRONT_UPRIGHT',
  isExhausted: false,
  isrush: false,
  canAttack: true,
  feijingMark: false,
  canResetCount: 0,
  effects: [],
  rarity: 'R',
  availableRarities: ['R'],
  cardPackage: 'BT05',
  uniqueId: null as any,
};

export default card;
