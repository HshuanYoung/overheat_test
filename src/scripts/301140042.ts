import { Card, CardEffect } from '../types/game';
import { AtomicEffectExecutor, addContinuousDamage, addContinuousKeyword, addContinuousPower, universalEquipEffect } from './BaseUtil';

const onlyFeijingPayment: CardEffect = {
  id: '301140042_only_feijing_payment',
  type: 'CONTINUOUS',
  content: 'ONLY_FEIJING_PAYMENT',
  description: '只能通过【菲晶】能力来支付这张卡的使用费用。'
};

const equipBoost: CardEffect = {
  id: '301140042_equip_boost',
  type: 'CONTINUOUS',
  triggerLocation: ['ITEM'],
  description: '装备单位伤害+1、力量+1000并获得【英勇】。',
  applyContinuous: (gameState, instance) => {
    if (!instance.equipTargetId) return;
    const target = AtomicEffectExecutor.findCardById(gameState, instance.equipTargetId);
    if (!target || target.cardlocation !== 'UNIT') return;
    addContinuousDamage(target, instance, 1);
    addContinuousPower(target, instance, 1000);
    addContinuousKeyword(target, instance, 'heroic');
  }
};

const cardEffects: CardEffect[] = [universalEquipEffect, onlyFeijingPayment, equipBoost];

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 301140042
 * Card2 Row: 406
 * Card Row: 276
 * Source CardNo: BT05-W10
 * Package: BT05(SR)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 【装备】
 * 【永】:你只能通过【菲晶】能力来支付这张卡的使用费用。
 * 【永】:装备单位〖伤害+1〗〖力量+1000〗并获得【英勇】。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '301140042',
  fullName: '荣光授礼',
  specialName: '',
  type: 'ITEM',
  color: 'WHITE',
  gamecardId: null as any,
  colorReq: { WHITE: 1 },
  faction: '女神教会',
  acValue: 3,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  feijingMark: true,
  canResetCount: 0,
  effects: cardEffects,
  rarity: 'SR',
  availableRarities: ['SR'],
  cardPackage: 'BT05',
  uniqueId: null as any,
};

export default card;
