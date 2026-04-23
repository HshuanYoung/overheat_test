import { Card, CardEffect } from '../types/game';
import { findUnitOnBattlefield, universalEquipEffect } from './_bt03YellowUtils';

const effect_305000081_continuous: CardEffect = {
  id: '305000081_continuous',
  type: 'CONTINUOUS',
  description: 'The equipped unit cannot participate in battle, cannot become an attack target, and cannot become the target of unit-card abilities.',
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
      description: 'Cannot participate in battle, cannot be attack target, and ignores unit-card targeting.'
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
