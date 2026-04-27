import { Card, CardEffect, TriggerLocation } from '../types/game';
import { addContinuousDamage, addContinuousPower, ownUnits, ownerOf } from './BaseUtil';

const cardEffects: CardEffect[] = [{
    id: '103090077_buff',
    type: 'CONTINUOUS',
    description: '若你的战场上的<瑟诺布>单位有3个以上，这个单位伤害+1、力量+1000。',
    applyContinuous: (gameState, instance) => {
      const owner = ownerOf(gameState, instance);
      if (!owner || ownUnits(owner).filter(unit => unit.faction === '瑟诺布').length < 3) return;
      addContinuousDamage(instance, instance, 1);
      addContinuousPower(instance, instance, 1000);
    }
  }];

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 103090077
 * Card2 Row: 25
 * Card Row: 25
 * Source CardNo: BT01-G04
 * Package: BT01(U),ST02(TD)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 【永】:若你的战场上的<瑟诺布>单位有3个以上，这个单位〖伤害+1〗〖力量+1000〗。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '103090077',
  fullName: '瑟诺布建筑工',
  specialName: '',
  type: 'UNIT',
  color: 'GREEN',
  gamecardId: null as any,
  colorReq: {},
  faction: '瑟诺布',
  acValue: 3,
  power: 2000,
  basePower: 2000,
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
  rarity: 'U',
  availableRarities: ['U'],
  cardPackage: 'BT01',
  uniqueId: null as any,
};

export default card;
