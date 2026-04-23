import { Card, CardEffect } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';
import { createSelectCardQuery, hasTruthUnit, revealDeckCards } from './_bt03YellowUtils';

const effect_205000142_activate: CardEffect = {
  id: '205000142_activate',
  type: 'ACTIVATE',
  triggerLocation: ['PLAY'],
  erosionBackLimit: [2, 10],
  description: 'Scratch 2. Add 1 card from the top 7 cards of your deck to your hand. If you control Truth, search any 1 card instead. Then shuffle your deck.',
  execute: async (instance, gameState, playerState) => {
    if (hasTruthUnit(playerState)) {
      if (playerState.deck.length === 0) return;
      createSelectCardQuery(
        gameState,
        playerState.uid,
        [...playerState.deck],
        'Choose A Card',
        'Choose 1 card from your deck to add to your hand.',
        1,
        1,
        { sourceCardId: instance.gamecardId, effectId: '205000142_activate', step: 'SEARCH_ANY' },
        () => 'DECK'
      );
      return;
    }

    const revealed = revealDeckCards(gameState, playerState.uid, 7);
    if (revealed.length === 0) return;

    createSelectCardQuery(
      gameState,
      playerState.uid,
      revealed,
      'Choose A Card',
      'Choose 1 of the revealed cards to add to your hand.',
      1,
      1,
      { sourceCardId: instance.gamecardId, effectId: '205000142_activate', step: 'REVEAL_TOP' },
      () => 'DECK'
    );
  },
  onQueryResolve: async (instance, gameState, playerState, selections, context) => {
    await AtomicEffectExecutor.execute(gameState, playerState.uid, {
      type: 'MOVE_FROM_DECK',
      targetFilter: { gamecardId: selections[0] },
      destinationZone: 'HAND'
    }, instance);

    await AtomicEffectExecutor.execute(gameState, playerState.uid, {
      type: 'SHUFFLE_DECK'
    }, instance);
  }
};

const card: Card = {
  id: '205000142',
  fullName: '世界目录',
  specialName: '',
  type: 'STORY',
  color: 'YELLOW',
  gamecardId: null as any,
  colorReq: { YELLOW: 1 },
  faction: '无',
  acValue: 2,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  feijingMark: false,
  canResetCount: 0,
  effects: [effect_205000142_activate],
  rarity: 'R',
  availableRarities: ['R', 'SER'],
  cardPackage: 'BT03',
  uniqueId: null as any,
};

export default card;
