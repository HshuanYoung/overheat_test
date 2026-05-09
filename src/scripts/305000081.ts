import { Card, CardEffect } from '../types/game';
import { findUnitOnBattlefield, universalEquipEffect } from './BaseUtil';

const effect_305000081_continuous: CardEffect = {
  id: '305000081_continuous',
  type: 'CONTINUOUS',
  description: '装备单位不能参与战斗，不能成为攻击目标，且不能成为单位卡能力的对象。',
  applyContinuous: (gameState, instance) => {
    const target = findUnitOnBattlefield(gameState, instance.equipTargetId);
    if (!target) {
      instance.equipTargetId = undefined;
      return;
    }

    target.canAttack = false;
    target.isImmuneToUnitEffects = true;
    (target as any).battleForbiddenByEffect = true;
    (target as any).cannotBeAttackTargetByEffect = true;

    if (!target.influencingEffects) target.influencingEffects = [];
    target.influencingEffects.push({
      sourceCardName: instance.fullName,
      description: '不能参与战斗，不能成为攻击目标，且不会成为单位卡效果的对象。'
    });
  }
};

const card: Card = {
  id: '305000081',
  fullName: '秘影斗篷',
  specialName: '',
  type: 'ITEM',
  isEquip: true,
  color: 'YELLOW',
  gamecardId: null as any,
  colorReq: { YELLOW: 1 },
  faction: '无',
  acValue: 2,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  feijingMark: false,
  canResetCount: 0,
  effects: [universalEquipEffect, effect_305000081_continuous],
  rarity: 'C',
  availableRarities: ['C'],
  cardPackage: 'BT03',
  uniqueId: null as any,
};

export default card;
