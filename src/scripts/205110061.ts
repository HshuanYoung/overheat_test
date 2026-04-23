import { Card, CardEffect } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';
import { createSelectCardQuery, moveCard } from './_bt02YellowUtils';

const effect_205110061_activate: CardEffect = {
  id: '205110061_activate',
  type: 'ACTIVATE',
  triggerLocation: ['PLAY'],
  description: 'Randomly discard up to 3 cards from your hand. If exactly 3 were discarded, choose up to 3 cards with matching names from your deck and add them to your hand.',
  execute: async (instance, gameState, playerState) => {
    const discardCount = Math.min(3, playerState.hand.length);
    if (discardCount === 0) return;

    const shuffled = [...playerState.hand].sort(() => Math.random() - 0.5);
    const discarded = shuffled.slice(0, discardCount);
    const discardedNames = discarded.map(card => card.fullName);

    discarded.forEach(card => moveCard(gameState, playerState.uid, card, 'GRAVE', instance));

    if (discarded.length !== 3) return;

    const candidates = playerState.deck.filter(card => discardedNames.includes(card.fullName));
    if (candidates.length === 0) return;

    createSelectCardQuery(
      gameState,
      playerState.uid,
      candidates,
      'Choose Cards',
      'Choose up to 3 cards with matching names from your deck.',
      0,
      Math.min(3, candidates.length),
      { sourceCardId: instance.gamecardId, effectId: '205110061_activate' },
      () => 'DECK'
    );
  },
  onQueryResolve: async (instance, gameState, playerState, selections) => {
    for (const selectedId of selections) {
      await AtomicEffectExecutor.execute(gameState, playerState.uid, {
        type: 'MOVE_FROM_DECK',
        targetFilter: { gamecardId: selectedId },
        destinationZone: 'HAND'
      }, instance);
    }
    await AtomicEffectExecutor.execute(gameState, playerState.uid, { type: 'SHUFFLE_DECK' }, instance);
  }
};

const card: Card = {
  id: '205110061',
  fullName: '独占购买',
  specialName: '',
  type: 'STORY',
  color: 'YELLOW',
  gamecardId: null as any,
  colorReq: { YELLOW: 1 },
  faction: '学院要塞',
  acValue: -3,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  feijingMark: false,
  canResetCount: 0,
  effects: [effect_205110061_activate],
  rarity: 'C',
  availableRarities: ['C'],
  cardPackage: 'BT02',
  uniqueId: null as any,
};

export default card;
