import { Card } from '../types/game';

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 103000275
 * Card2 Row: 434
 * Card Row: 317
 * Source CardNo: SP02-G04
 * Package: SP02(SR,XSR)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 【歼灭】
 * 【启】〖同名1回合1次〗:异彩3。
 * 【永】{你的战场上有白色单位}:这个单位获得【英勇】。
 * 【诱】{你的战场上有蓝色单位，这个单位宣言攻击时，选择对手的一个非神蚀单位}:将被选择的单位横置。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '103000275',
  fullName: '兽神之胜利「维多利亚」',
  specialName: '维多利亚',
  type: 'UNIT',
  color: 'GREEN',
  gamecardId: null as any,
  colorReq: { GREEN: 3 },
  faction: '无',
  acValue: 5,
  power: 3500,
  basePower: 3500,
  damage: 3,
  baseDamage: 3,
  godMark: true,
  displayState: 'FRONT_UPRIGHT',
  isExhausted: false,
  isrush: false,
  isAnnihilation: true,
  isHeroic: true,
  canAttack: true,
  feijingMark: false,
  canResetCount: 0,
  effects: [],
  rarity: 'SR',
  availableRarities: ['SR'],
  cardPackage: 'BT06',
  uniqueId: null as any,
};

export default card;
