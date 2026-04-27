import { Card, CardEffect, TriggerLocation } from '../types/game';
import { addContinuousDamage } from './BaseUtil';

const cardEffects: CardEffect[] = [{
    id: '102050088_damage',
    type: 'CONTINUOUS',
    erosionTotalLimit: [5, 7],
    description: '5~7：伤害+1。',
    applyContinuous: (_gameState, instance) => addContinuousDamage(instance, instance, 1)
  }];

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 102050088
 * Card2 Row: 42
 * Card Row: 42
 * Source CardNo: BT01-R04
 * Package: BT01(R)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 【速攻】
 * 〖5~7〗【永】:这个单位〖伤害+1〗。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '102050088',
  fullName: '闹市看守',
  specialName: '',
  type: 'UNIT',
  color: 'RED',
  gamecardId: null as any,
  colorReq: {},
  faction: '伊列宇王国',
  acValue: 2,
  power: 2000,
  basePower: 2000,
  damage: 1,
  baseDamage: 1,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  isExhausted: false,
  isrush: true,
  canAttack: true,
  feijingMark: false,
  canResetCount: 0,
  effects: cardEffects,
  rarity: 'R',
  availableRarities: ['R'],
  cardPackage: 'BT01',
  uniqueId: null as any,
};

export default card;
