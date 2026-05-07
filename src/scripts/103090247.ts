import { Card, CardEffect } from '../types/game';
import { addInfluence, ownerOf } from './BaseUtil';

const cardEffects: CardEffect[] = [{
  id: '103090247_hand_xenobu_discount',
  type: 'CONTINUOUS',
  triggerLocation: ['HAND'],
  content: 'SELF_HAND_COST',
  description: '手牌中的这张卡ACCESS值-X，X为你单位区<瑟诺布>单位数量。',
  applyContinuous: (gameState, instance) => {
    if (instance.cardlocation !== 'HAND') return;
    const owner = ownerOf(gameState, instance);
    if (!owner) return;
    const xenobuCount = owner.unitZone.filter(unit => unit?.faction === '瑟诺布').length;
    const base = instance.baseAcValue ?? instance.acValue ?? 0;
    const next = Math.max(0, base - xenobuCount);
    if (instance.acValue !== next) {
      instance.acValue = next;
      addInfluence(instance, instance, `ACCESS值-${xenobuCount}`);
    }
  }
}];

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 103090247
 * Card2 Row: 356
 * Card Row: 287
 * Source CardNo: ST02-G10
 * Package: ST02(TD)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 歼灭
 * 永续效果：手牌中的这张卡的AC值减少X。X为你单位区的势力为瑟诺布单位数量。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '103090247',
  fullName: '瑟诺布的银女团',
  specialName: '',
  type: 'UNIT',
  color: 'GREEN',
  gamecardId: null as any,
  colorReq: { GREEN: 3 },
  faction: '瑟诺布',
  acValue: 7,
  power: 4000,
  basePower: 4000,
  damage: 3,
  baseDamage: 3,
  godMark: true,
  displayState: 'FRONT_UPRIGHT',
  isExhausted: false,
  isrush: false,
  canAttack: true,
  feijingMark: false,
  canResetCount: 0,
  isAnnihilation: true,
  baseAnnihilation: true,
  effects: cardEffects,
  rarity: 'U',
  availableRarities: ['U'],
  cardPackage: 'BT02',
  uniqueId: null as any,
};

export default card;
