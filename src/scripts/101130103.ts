import { Card, CardEffect, TriggerLocation } from '../types/game';
import { addContinuousDamage, addContinuousPower } from './BaseUtil';

const cardEffects: CardEffect[] = [{
    id: '101130103_alliance_buff',
    type: 'CONTINUOUS',
    description: '英勇；参与联军攻击中，伤害+1、力量+500。',
    applyContinuous: (_gameState, instance) => {
      if (instance.inAllianceGroup) {
        addContinuousDamage(instance, instance, 1);
        addContinuousPower(instance, instance, 500);
      }
    }
  }];

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 101130103
 * Card2 Row: 63
 * Card Row: 63
 * Source CardNo: BT01-W08
 * Package: ST01(TD),BT01(R)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 【英勇】
 * 【永】:这个单位参与的联军攻击中，这个单位〖伤害+1〗〖力量+500〗。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '101130103',
  fullName: '信仰坚定的战士',
  specialName: '',
  type: 'UNIT',
  color: 'WHITE',
  gamecardId: null as any,
  colorReq: { WHITE: 1 },
  faction: '圣王国',
  acValue: 2,
  power: 2000,
  basePower: 2000,
  damage: 1,
  baseDamage: 1,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  isExhausted: false,
  isrush: false,
  isHeroic: true,
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
