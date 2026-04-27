import { Card, CardEffect } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';
import { EventEngine } from '../services/EventEngine';
import { createSelectCardQuery, isYellowHandCard, moveCard } from './BaseUtil';

const effect_305120030_activate: CardEffect = {
  id: '305120030_activate',
  type: 'ACTIVATE',
  triggerLocation: ['ITEM'],
  description: 'Main phase only. Discard 1 yellow hand card and exhaust this item. Send 1 allied unit to grave, then put a unit with the same color and AC +1 from your deck onto the battlefield.',
  condition: (gameState, playerState, instance) =>
    gameState.phase === 'MAIN' &&
    !instance.isExhausted &&
    playerState.hand.some(isYellowHandCard) &&
    playerState.unitZone.some(card => card !== null),
  execute: async (instance, gameState, playerState) => {
    const yellowHand = playerState.hand.filter(isYellowHandCard);
    createSelectCardQuery(
      gameState,
      playerState.uid,
      yellowHand,
      'Discard A Yellow Card',
      'Discard 1 yellow hand card.',
      1,
      1,
      { sourceCardId: instance.gamecardId, effectId: '305120030_activate', step: 'DISCARD' },
      () => 'HAND'
    );
  },
  onQueryResolve: async (instance, gameState, playerState, selections, context) => {
    if (context.step === 'DISCARD') {
      await AtomicEffectExecutor.execute(gameState, playerState.uid, {
        type: 'DISCARD_CARD',
        targetFilter: { gamecardId: selections[0] }
      }, instance);

      await AtomicEffectExecutor.execute(gameState, playerState.uid, {
        type: 'ROTATE_HORIZONTAL',
        targetFilter: { gamecardId: instance.gamecardId }
      }, instance);

      const ownUnits = playerState.unitZone.filter((card): card is Card => !!card);
      createSelectCardQuery(
        gameState,
        playerState.uid,
        ownUnits,
        'Choose A Unit',
        'Send 1 allied unit to grave.',
        1,
        1,
        { sourceCardId: instance.gamecardId, effectId: '305120030_activate', step: 'SEND_UNIT' }
      );
      return;
    }

    if (context.step === 'SEND_UNIT') {
      const target = AtomicEffectExecutor.findCardById(gameState, selections[0]);
      if (!target) return;

      const nextAc = (target.acValue || 0) + 1;
      const targetColor = target.color;
      moveCard(gameState, playerState.uid, target, 'GRAVE', instance);

      const candidates = playerState.deck.filter(card =>
        card.type === 'UNIT' &&
        card.color === targetColor &&
        (card.acValue || 0) === nextAc &&
        (!card.specialName || !playerState.unitZone.some(unit => unit?.specialName === card.specialName))
      );
      if (candidates.length === 0) {
        EventEngine.recalculateContinuousEffects(gameState);
        return;
      }

      createSelectCardQuery(
        gameState,
        playerState.uid,
        candidates,
        'Choose A Unit',
        'Choose 1 matching unit from your deck.',
        1,
        1,
        { sourceCardId: instance.gamecardId, effectId: '305120030_activate', step: 'PUT_UNIT' },
        () => 'DECK'
      );
      return;
    }

    if (context.step === 'PUT_UNIT') {
      await AtomicEffectExecutor.execute(gameState, playerState.uid, {
        type: 'MOVE_FROM_DECK',
        targetFilter: { gamecardId: selections[0] },
        destinationZone: 'UNIT'
      }, instance);
    }
  }
};

const card: Card = {
  id: '305120030',
  fullName: '「永生炼金釜」',
  specialName: '永生炼金釜',
  type: 'ITEM',
  color: 'YELLOW',
  gamecardId: null as any,
  colorReq: { YELLOW: 2 },
  faction: '永生之乡',
  acValue: 3,
  godMark: true,
  displayState: 'FRONT_UPRIGHT',
  feijingMark: false,
  canResetCount: 0,
  effects: [effect_305120030_activate],
  rarity: 'R',
  availableRarities: ['R'],
  cardPackage: 'BT02',
  uniqueId: null as any,
};

export default card;
