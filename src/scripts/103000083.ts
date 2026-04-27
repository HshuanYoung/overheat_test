import { Card, CardEffect, TriggerLocation } from '../types/game';
import { addTempPower, paymentCost } from './BaseUtil';

const cardEffects: CardEffect[] = [{
    id: '103000083_power',
    type: 'ACTIVATE',
    triggerLocation: ['UNIT'],
    limitCount: 1,
    description: '支付2费：此单位力量+1000。',
    cost: paymentCost(2, 'GREEN'),
    execute: async instance => addTempPower(instance, instance, 1000)
  }];

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 103000083
 * Card2 Row: 31
 * Card Row: 31
 * Source CardNo: BT01-G10
 * Package: BT01(C)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 【启】〖1回合1次〗:[〖支付2费〗]这个单位〖力量+1000〗。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '103000083',
  fullName: '普尔氏·食人魔',
  specialName: '',
  type: 'UNIT',
  color: 'GREEN',
  gamecardId: null as any,
  colorReq: {},
  faction: '无',
  acValue: 2,
  power: 1500,
  basePower: 1500,
  damage: 2,
  baseDamage: 2,
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
  cardPackage: 'BT01',
  uniqueId: null as any,
};

export default card;
