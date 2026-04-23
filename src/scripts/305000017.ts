import { Card, CardEffect } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';

const effect_305000017_skip_ready: CardEffect = {
  id: '305000017_skip_ready',
  type: 'CONTINUOUS',
  content: 'SKIP_OWN_START_READY',
  description: 'This item does not ready during your start phase.'
};

const effect_305000017_activate: CardEffect = {
  id: '305000017_activate',
  type: 'ACTIVATE',
  triggerLocation: ['ITEM'],
  description: 'Pay 1 and exhaust this item. Choose your unit. If it would be destroyed this turn, return it to hand instead.',
  condition: (_gameState, playerState, instance) => {
    return !instance.isExhausted && playerState.unitZone.some(unit => unit !== null);
  },
  execute: async (instance, gameState, playerState) => {
    gameState.pendingQuery = {
      id: Math.random().toString(36).substring(7),
      type: 'SELECT_PAYMENT',
      playerUid: playerState.uid,
      options: [],
      title: `Pay Cost: ${instance.id}`,
      description: 'Pay 1 cost.',
      minSelections: 1,
      maxSelections: 1,
      callbackKey: 'EFFECT_RESOLVE',
      paymentCost: 1,
      paymentColor: instance.color,
      context: {
        sourceCardId: instance.gamecardId,
        effectId: '305000017_activate',
        step: 'SELECT_TARGET'
      }
    };
  },
  onQueryResolve: async (instance, gameState, playerState, selections, context) => {
    if (context.step === 'SELECT_TARGET') {
      await AtomicEffectExecutor.execute(gameState, playerState.uid, {
        type: 'ROTATE_HORIZONTAL',
        targetFilter: { gamecardId: instance.gamecardId }
      }, instance);

      const ownUnits = playerState.unitZone.filter((unit): unit is Card => !!unit);
      if (ownUnits.length === 0) return;

      gameState.pendingQuery = {
        id: Math.random().toString(36).substring(7),
        type: 'SELECT_CARD',
        playerUid: playerState.uid,
        options: AtomicEffectExecutor.enrichQueryOptions(
          gameState,
          playerState.uid,
          ownUnits.map(unit => ({ card: unit, source: 'UNIT' as const }))
        ),
        title: 'Choose A Unit',
        description: 'Choose 1 allied unit.',
        minSelections: 1,
        maxSelections: 1,
        callbackKey: 'EFFECT_RESOLVE',
        context: {
          sourceCardId: instance.gamecardId,
          effectId: '305000017_activate',
          step: 'APPLY_TARGET'
        }
      };
      return;
    }

    if (context.step === 'APPLY_TARGET') {
      const target = AtomicEffectExecutor.findCardById(gameState, selections[0]);
      if (!target) return;

      if (!(target as any).data) {
        (target as any).data = {};
      }

      (target as any).data.returnToHandOnDestroyTurn = gameState.turnCount;
      (target as any).data.returnToHandOnDestroySourceCardId = instance.gamecardId;
      (target as any).data.returnToHandOnDestroySourcePlayerUid = playerState.uid;
      gameState.logs.push(`[${instance.id}] will return [${target.fullName}] to hand instead of destruction this turn.`);
    }
  }
};

const card: Card = {
  id: '305000017',
  fullName: '烟雾弹',
  specialName: '',
  type: 'ITEM',
  color: 'YELLOW',
  gamecardId: null as any,
  colorReq: { YELLOW: 1 },
  faction: '无',
  acValue: 0,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  feijingMark: false,
  canResetCount: 0,
  effects: [effect_305000017_skip_ready, effect_305000017_activate],
  rarity: 'C',
  availableRarities: ['C'],
  cardPackage: 'BT01,ST04',
  uniqueId: null as any,
};

export default card;
