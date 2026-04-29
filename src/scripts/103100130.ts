import { Card, CardEffect } from '../types/game';
import { markAccessTapValue } from './BaseUtil';

const cardEffects: CardEffect[] = [{
  id: '103100130_access_plus_two',
  type: 'CONTINUOUS',
  description: '通过横置这个单位支付的ACCESS值可以当作+1或+2。',
  applyContinuous: (_gameState, instance) => {
    markAccessTapValue(instance, instance, 2);
  }
}];

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 103100130
 * Card2 Row: 108
 * Card Row: 108
 * Source CardNo: BT02-G02
 * Package: BT02(C)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 【永】:通过〖横置〗这个单位来支付的ACCESS值，可以当作+2。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '103100130',
  fullName: '魔女的妖精',
  specialName: '',
  type: 'UNIT',
  color: 'GREEN',
  gamecardId: null as any,
  colorReq: { GREEN: 1 },
  faction: '艾柯利普斯',
  acValue: 2,
  power: 1000,
  basePower: 1000,
  damage: 0,
  baseDamage: 0,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  isExhausted: false,
  isrush: false,
  canAttack: true,
  feijingMark: false,
  canResetCount: 0,
  effects: cardEffects,
  rarity: 'C',
  availableRarities: ['C'],
  cardPackage: 'BT02',
  uniqueId: null as any,
};

export default card;
