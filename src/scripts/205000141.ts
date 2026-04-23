import { Card, CardEffect } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';
import { canPutUnitOntoBattlefield, createSelectCardQuery, moveCard } from './_bt03YellowUtils';

const effect_205000141_activate: CardEffect = {
  id: '205000141_activate',
  type: 'ACTIVATE',
  triggerLocation: ['PLAY'],
  description: 'Send 1 of your ready units to grave. Then you may put up to 2 same-name non-god units from your deck onto the battlefield with the same color and AC 2 less.',
  condition: (_gameState, playerState) =>
    playerState.unitZone.some(unit => unit && !unit.isExhausted),
  execute: async (instance, gameState, playerState) => {
    const readyUnits = playerState.unitZone.filter((unit): unit is Card => !!unit && !unit.isExhausted);
    createSelectCardQuery(
      gameState,
      playerState.uid,
      readyUnits,
      'Choose A Ready Unit',
      'Choose 1 ready unit to send to the grave.',
      1,
      1,
      { sourceCardId: instance.gamecardId, effectId: '205000141_activate', step: 'SEND_UNIT' }
    );
  },
  onQueryResolve: async (instance, gameState, playerState, selections, context) => {
    if (context.step === 'SEND_UNIT') {
      const target = AtomicEffectExecutor.findCardById(gameState, selections[0]);
      if (!target) return;

      const originalAc = target.baseAcValue ?? target.acValue;
      const targetAc = originalAc - 2;
      const targetColor = target.color;
      moveCard(gameState, playerState.uid, target, 'GRAVE', instance);

      const candidates = playerState.deck.filter(card =>
        card.type === 'UNIT' &&
        !card.godMark &&
        card.color === targetColor &&
        (card.baseAcValue ?? card.acValue) === targetAc &&
        canPutUnitOntoBattlefield(playerState, card)
      );
      if (candidates.length === 0) return;

      createSelectCardQuery(
        gameState,
        playerState.uid,
        candidates,
        'Choose The First Unit',
        'Choose up to 1 unit to put onto the battlefield.',
        0,
        1,
        {
          sourceCardId: instance.gamecardId,
          effectId: '205000141_activate',
          step: 'PUT_FIRST'
        },
        () => 'DECK'
      );
      return;
    }

    if (context.step === 'PUT_FIRST') {
      if (selections.length === 0) return;

      const firstId = selections[0];
      const chosen = AtomicEffectExecutor.findCardById(gameState, firstId);
      if (!chosen) return;

      await AtomicEffectExecutor.execute(gameState, playerState.uid, {
        type: 'MOVE_FROM_DECK',
        targetFilter: { gamecardId: firstId },
        destinationZone: 'UNIT'
      }, instance);

      const remainingCopies = playerState.deck.filter(card =>
        card.id === chosen.id &&
        card.type === 'UNIT' &&
        !card.godMark &&
        canPutUnitOntoBattlefield(playerState, card)
      );
      if (remainingCopies.length === 0) return;

      createSelectCardQuery(
        gameState,
        playerState.uid,
        remainingCopies,
        'Choose The Second Unit',
        'You may choose 1 more card with the same name.',
        0,
        1,
        {
          sourceCardId: instance.gamecardId,
          effectId: '205000141_activate',
          step: 'PUT_SECOND'
        },
        () => 'DECK'
      );
      return;
    }

    if (context.step !== 'PUT_SECOND' || selections.length === 0) return;

    await AtomicEffectExecutor.execute(gameState, playerState.uid, {
      type: 'MOVE_FROM_DECK',
      targetFilter: { gamecardId: selections[0] },
      destinationZone: 'UNIT'
    }, instance);
  }
};

const card: Card = {
  id: '205000141',
  fullName: '裂变',
  specialName: '',
  type: 'STORY',
  color: 'YELLOW',
  gamecardId: null as any,
  colorReq: { YELLOW: 1 },
  faction: '无',
  acValue: -3,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  feijingMark: false,
  canResetCount: 0,
  effects: [effect_205000141_activate],
  rarity: 'C',
  availableRarities: ['C'],
  cardPackage: 'BT03',
  uniqueId: null as any,
};

export default card;
