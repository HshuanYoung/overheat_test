import { Card, CardEffect, TriggerLocation } from '../types/game';
import { addInfluence } from './BaseUtil';

const cardEffects: CardEffect[] = [{
    id: '101140099_low_erosion_protect',
    type: 'CONTINUOUS',
    erosionTotalLimit: [0, 3],
    description: '0~3：此单位参与的攻击中，此单位不会被破坏。',
    applyContinuous: (gameState, instance) => {
      if (gameState.battleState?.attackers?.includes(instance.gamecardId)) {
        (instance as any).battleImmuneByEffect = true;
        addInfluence(instance, instance, '攻击中不会被破坏');
      }
    }
  }];

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 101140099
 * Card2 Row: 59
 * Card Row: 59
 * Source CardNo: BT01-W04
 * Package: ST01(TD),BT01(U)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 【诱】:回合结束时，若本回合中，这个单位给予过对手战斗伤害，将你的战场上的这个单位以外的所有单位重置。 
 * 〖0~3〗【永】:这个单位参与的攻击中，这个单位不会被破坏。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '101140099',
  fullName: '教会骑士队长',
  specialName: '',
  type: 'UNIT',
  color: 'WHITE',
  gamecardId: null as any,
  colorReq: { WHITE: 1 },
  faction: '女神教会',
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
  rarity: 'U',
  availableRarities: ['U'],
  cardPackage: 'BT01',
  uniqueId: null as any,
};

export default card;
