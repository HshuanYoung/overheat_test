import { Card, CardEffect } from '../types/game';
import { addContinuousDamage, addContinuousPower, addInfluence, ownerOf } from './BaseUtil';

const cardEffects: CardEffect[] = [{
  id: '101140062_hand_access_discount',
  type: 'CONTINUOUS',
  content: 'SELF_HAND_COST',
  triggerLocation: ['HAND'],
  description: '手牌中的这张卡的ACCESS值减少你的战场单位数量，最低为0。',
  applyContinuous: (gameState, instance) => {
    if (instance.cardlocation !== 'HAND') return;
    const owner = ownerOf(gameState, instance);
    if (!owner) return;

    const baseCost = instance.baseAcValue ?? 3;
    const unitCount = owner.unitZone.filter(Boolean).length;
    const nextCost = Math.max(0, baseCost - unitCount);
    instance.acValue = nextCost;
    if (nextCost !== baseCost) {
      addInfluence(instance, instance, `ACCESS值-${baseCost - nextCost}`);
    }
  }
}, {
  id: '101140062_low_erosion_buff',
  type: 'CONTINUOUS',
  triggerLocation: ['UNIT'],
  erosionTotalLimit: [0, 3],
  description: '0-3：这个单位伤害+1、力量+500。',
  applyContinuous: (_gameState, instance) => {
    addContinuousDamage(instance, instance, 1);
    addContinuousPower(instance, instance, 500);
  }
}];

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 101140062
 * Card2 Row: 3
 * Card Row: 3
 * Source CardNo: ST01-W03
 * Package: ST01(TD)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 【永】:你的战场上每有1个单位，手牌中的这张卡的ACCESS值便减少1。（最低降到〖0〗）
 * 【永】【0-3】这个单位〖伤害+1〗〖力量+500〗。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '101140062',
  fullName: '受祝福的少女骑士',
  specialName: '',
  type: 'UNIT',
  color: 'WHITE',
  gamecardId: null as any,
  colorReq: { WHITE: 1 },
  faction: '女神教会',
  acValue: 3,
  baseAcValue: 3,
  power: 1500,
  basePower: 1500,
  damage: 1,
  baseDamage: 1,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  isExhausted: false,
  isrush: false,
  canAttack: true,
  feijingMark: false,
  canResetCount: 0,
  effects: cardEffects,
  rarity: 'SR',
  availableRarities: ['SR'],
  cardPackage: 'BT01',
  uniqueId: null as any,
};

export default card;
