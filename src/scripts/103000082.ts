import { Card } from '../types/game';
import { getBt01CardEffects } from './_bt03YellowUtils';

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 103000082
 * Card2 Row: 30
 * Card Row: 30
 * Source CardNo: BT01-G09
 * Package: BT01(SR,ESR)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 【永】:这个单位不能组成联军，也不能成为效果对象。
 * 【永】:这个单位可以攻击对手的重置单位。这个单位攻击对手单位的战斗中，对手不能用其他单位防御。
 * 【启】〖1回合1次〗:[〖支付2费〗]本回合中，这个单位〖力量+1500〗。
 * 〖10+〗 【永】:这个单位〖伤害+3〗〖力量+3500〗，获得【速攻】【歼灭】。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '103000082',
  fullName: '孤寂天涯「萨拉拉」',
  specialName: '萨拉拉',
  type: 'UNIT',
  color: 'GREEN',
  gamecardId: null as any,
  colorReq: { GREEN: 2 },
  faction: '无',
  acValue: 2,
  power: 2000,
  basePower: 2000,
  damage: 1,
  baseDamage: 1,
  godMark: true,
  displayState: 'FRONT_UPRIGHT',
  isExhausted: false,
  isrush: true,
  isAnnihilation: true,
  canAttack: true,
  feijingMark: false,
  canResetCount: 0,
  effects: getBt01CardEffects('103000082'),
  rarity: 'SR',
  availableRarities: ['SR', 'SER'],
  cardPackage: 'BT01',
  uniqueId: null as any,
};

export default card;
