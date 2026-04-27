import { Card, CardEffect } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';
import { canPutUnitOntoBattlefield, createSelectCardQuery, getOnlyGodMarkUnit, moveCard } from './BaseUtil';

const effect_205000135_activate: CardEffect = {
  id: '205000135_activate',
  type: 'ACTIVATE',
  triggerLocation: ['PLAY'],
  limitCount: 1,
  limitNameType: true,
  description: 'If you control only 1 god-mark unit, return 1 of your named god-mark units to the deck, then put a different unit with the same special name from your deck onto the battlefield.',
  condition: (_gameState, playerState) => {
    const loneGodmark = getOnlyGodMarkUnit(playerState);
    if (!loneGodmark?.specialName) return false;
    return playerState.deck.some(card =>
      card.type === 'UNIT' &&
      card.specialName === loneGodmark.specialName &&
      card.fullName !== loneGodmark.fullName &&
      canPutUnitOntoBattlefield(playerState, card)
    );
  },
  execute: async (instance, gameState, playerState) => {
    const loneGodmark = getOnlyGodMarkUnit(playerState);
    if (!loneGodmark?.specialName) return;

    createSelectCardQuery(
      gameState,
      playerState.uid,
      [loneGodmark],
      'Choose Your Unit',
      'Choose the named god-mark unit to return to your deck.',
      1,
      1,
      { sourceCardId: instance.gamecardId, effectId: '205000135_activate', step: 'RETURN_UNIT' }
    );
  },
  onQueryResolve: async (instance, gameState, playerState, selections, context) => {
    if (context.step !== 'RETURN_UNIT') return;

    const target = AtomicEffectExecutor.findCardById(gameState, selections[0]);
    if (!target?.specialName) return;
    const specialName = target.specialName;
    const fullName = target.fullName;

    moveCard(gameState, playerState.uid, target, 'DECK', instance);

    const candidates = playerState.deck.filter(card =>
      card.type === 'UNIT' &&
      card.specialName === specialName &&
      card.fullName !== fullName &&
      canPutUnitOntoBattlefield(playerState, card)
    );
    if (candidates.length === 0) return;

    createSelectCardQuery(
      gameState,
      playerState.uid,
      candidates,
      'Choose A Unit',
      'Choose 1 unit with the same special name but a different card name.',
      1,
      1,
      { sourceCardId: instance.gamecardId, effectId: '205000135_activate', step: 'PUT_UNIT' },
      () => 'DECK'
    );
  }
};

const card: Card = {
  id: '205000135',
  fullName: '怪盗登场！！',
  specialName: '',
  type: 'STORY',
  color: 'YELLOW',
  gamecardId: null as any,
  colorReq: { YELLOW: 1 },
  faction: '无',
  acValue: 0,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  feijingMark: false,
  canResetCount: 0,
  effects: [
    {
      ...effect_205000135_activate,
      onQueryResolve: async (instance, gameState, playerState, selections, context) => {
        if (context.step === 'RETURN_UNIT') {
          const target = AtomicEffectExecutor.findCardById(gameState, selections[0]);
          if (!target?.specialName) return;
          const specialName = target.specialName;
          const fullName = target.fullName;

          moveCard(gameState, playerState.uid, target, 'DECK', instance);

          const candidates = playerState.deck.filter(card =>
            card.type === 'UNIT' &&
            card.specialName === specialName &&
            card.fullName !== fullName &&
            canPutUnitOntoBattlefield(playerState, card)
          );
          if (candidates.length === 0) return;

          createSelectCardQuery(
            gameState,
            playerState.uid,
            candidates,
            'Choose A Unit',
            'Choose 1 unit with the same special name but a different card name.',
            1,
            1,
            { sourceCardId: instance.gamecardId, effectId: '205000135_activate', step: 'PUT_UNIT' },
            () => 'DECK'
          );
          return;
        }

        if (context.step !== 'PUT_UNIT') return;
        await AtomicEffectExecutor.execute(gameState, playerState.uid, {
          type: 'MOVE_FROM_DECK',
          targetFilter: { gamecardId: selections[0] },
          destinationZone: 'UNIT'
        }, instance);
      }
    }
  ],
  rarity: 'R',
  availableRarities: ['R'],
  cardPackage: 'BT04',
  uniqueId: null as any,
};

export default card;
