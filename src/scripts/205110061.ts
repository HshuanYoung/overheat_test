import { Card, CardEffect } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';
import { createSelectCardQuery, moveCard } from './BaseUtil';

const effect_205110061_activate: CardEffect = {
  id: '205110061_activate',
  type: 'ACTIVATE',
  triggerLocation: ['PLAY'],
  description: '从你的手牌中选择最多3张卡并舍弃。若正好舍弃了3张，从卡组选择最多4张同名卡加入手牌。',
  execute: async (instance, gameState, playerState) => {
    if (playerState.hand.length === 0) return;

    createSelectCardQuery(
      gameState,
      playerState.uid,
      [...playerState.hand],
      '舍弃卡牌',
      '从你的手牌中选择最多3张卡舍弃。',
      0,
      Math.min(3, playerState.hand.length),
      { sourceCardId: instance.gamecardId, effectId: '205110061_activate', step: 'DISCARD' },
      () => 'HAND'
    );
  },
  onQueryResolve: async (instance, gameState, playerState, selections, context) => {
    if (context?.step === 'SEARCH') {
      for (const selectedId of selections) {
        await AtomicEffectExecutor.execute(gameState, playerState.uid, {
          type: 'MOVE_FROM_DECK',
          targetFilter: { gamecardId: selectedId },
          destinationZone: 'HAND'
        }, instance);
      }
      await AtomicEffectExecutor.execute(gameState, playerState.uid, {
        type: 'SHUFFLE_DECK'
      }, instance);
      return;
    }

    const discarded = selections
      .map(id => playerState.hand.find(card => card.gamecardId === id))
      .filter((card): card is Card => !!card);

    discarded.forEach(card => moveCard(gameState, playerState.uid, card, 'GRAVE', instance));
    if (discarded.length !== 3) return;

    const discardedNames = new Set(discarded.map(card => card.fullName));
    const candidates = playerState.deck.filter(card => discardedNames.has(card.fullName));
    if (candidates.length === 0) return;

    createSelectCardQuery(
      gameState,
      playerState.uid,
      candidates,
      '选择卡牌',
      '从你的卡组中选择最多4张与舍弃的卡同名的卡。',
      0,
      Math.min(4, candidates.length),
      { sourceCardId: instance.gamecardId, effectId: '205110061_activate', step: 'SEARCH' },
      () => 'DECK'
    );
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
