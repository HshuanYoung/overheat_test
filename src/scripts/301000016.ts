import { Card, CardEffect, TriggerLocation } from '../types/game';
import { AtomicEffectExecutor, addContinuousDamage, addContinuousPower, addInfluence, universalEquipEffect } from './BaseUtil';

const cardEffects: CardEffect[] = [universalEquipEffect, {
    id: '301000016_equip_buff',
    type: 'CONTINUOUS',
    description: '装备单位伤害+1、力量+500并获得英勇。',
    applyContinuous: (gameState, instance) => {
      if (!instance.equipTargetId) return;
      const target = AtomicEffectExecutor.findCardById(gameState, instance.equipTargetId);
      if (!target) return;
      addContinuousDamage(target, instance, 1);
      addContinuousPower(target, instance, 500);
      target.isHeroic = true;
      addInfluence(target, instance, '获得效果: 【英勇】');
    }
  }];

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 301000016
 * Card2 Row: 72
 * Card Row: 72
 * Source CardNo: BT01-W17
 * Package: ST01(TD),BT01(U)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 【装备】（〖1回合1次〗你的主要阶段中，你可以选择你的1个单位装备这张卡，或者解除这张卡的装备状态。）
 * 【永】:装备单位〖伤害+1〗〖力量+500〗并获得【英勇】。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '301000016',
  fullName: '战歌祝福',
  specialName: '',
  type: 'ITEM',
  color: 'WHITE',
  gamecardId: null as any,
  colorReq: { WHITE: 1 },
  faction: '无',
  acValue: 3,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  feijingMark: false,
  canResetCount: 0,
  effects: cardEffects,
  rarity: 'U',
  availableRarities: ['U'],
  cardPackage: 'BT01',
  uniqueId: null as any,
};

export default card;
