import { Card, CardEffect } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';
import { createSelectCardQuery } from './BaseUtil';

const effect_305110029_activate: CardEffect = {
  id: '305110029_activate',
  type: 'ACTIVATE',
  triggerLocation: ['ITEM'],
  description: '横置这个道具。选择战场上1个单位。本回合中，其伤害+1、力量+500。',
  condition: (_gameState, _playerState, instance) => !instance.isExhausted,
  execute: async (instance, gameState, playerState) => {
    await AtomicEffectExecutor.execute(gameState, playerState.uid, {
      type: 'ROTATE_HORIZONTAL',
      targetFilter: { gamecardId: instance.gamecardId }
    }, instance);

    const units = Object.values(gameState.players).flatMap(player => player.unitZone.filter((card): card is Card => !!card));
    if (units.length === 0) return;

    createSelectCardQuery(
      gameState,
      playerState.uid,
      units,
      '选择单位',
      '选择战场上1个单位。',
      1,
      1,
      { sourceCardId: instance.gamecardId, effectId: '305110029_activate' }
    );
  },
  onQueryResolve: async (instance, gameState, playerState, selections) => {
    const targetId = selections[0];
    await AtomicEffectExecutor.execute(gameState, playerState.uid, {
      type: 'CHANGE_DAMAGE',
      value: 1,
      turnDuration: 1,
      targetFilter: { gamecardId: targetId }
    }, instance);
    await AtomicEffectExecutor.execute(gameState, playerState.uid, {
      type: 'CHANGE_POWER',
      value: 500,
      turnDuration: 1,
      targetFilter: { gamecardId: targetId }
    }, instance);
  }
};

const card: Card = {
  id: '305110029',
  fullName: '小型自动炮台',
  specialName: '',
  type: 'ITEM',
  color: 'YELLOW',
  gamecardId: null as any,
  colorReq: { YELLOW: 1 },
  faction: '学院要塞',
  acValue: 3,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  feijingMark: false,
  canResetCount: 0,
  effects: [effect_305110029_activate],
  rarity: 'C',
  availableRarities: ['C'],
  cardPackage: 'BT02',
  uniqueId: null as any,
};

export default card;
