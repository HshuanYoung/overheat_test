import { Card, CardEffect } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';
import { createChoiceQuery, createSelectCardQuery, moveCard } from './BaseUtil';

const shuffleCards = <T>(cards: T[]) => {
  const shuffled = [...cards];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

const getSearchableNames = (deck: Card[]) =>
  Array.from(
    new Set(
      deck
        .map(card => card.fullName)
        .filter((name): name is string => !!name)
    )
  ).sort((a, b) => a.localeCompare(b, 'zh-CN'));

const effect_205110061_activate: CardEffect = {
  id: '205110061_activate',
  type: 'ACTIVATE',
  triggerLocation: ['PLAY'],
  description: '随机舍弃你的最多3张手牌。若正好舍弃了3张，可以从卡组选择最多4张同名卡加入手牌。',
  execute: async (instance, gameState, playerState) => {
    if (playerState.hand.length === 0) return;

    const discardCount = Math.min(3, playerState.hand.length);
    const discarded = shuffleCards(playerState.hand).slice(0, discardCount);
    discarded.forEach(card => moveCard(gameState, playerState.uid, card, 'GRAVE', instance));
    gameState.logs.push(`[${instance.fullName}] 随机舍弃了 ${discardCount} 张手牌。`);

    if (discardCount !== 3) return;

    const names = getSearchableNames(playerState.deck);
    if (names.length === 0) return;

    createChoiceQuery(
      gameState,
      playerState.uid,
      '选择卡名',
      '选择要从卡组加入手牌的卡名，或选择不检索。',
      [
        { id: '__NONE__', label: '不检索' },
        ...names.map(name => ({ id: name, label: name }))
      ],
      { sourceCardId: instance.gamecardId, effectId: '205110061_activate', step: 'CHOOSE_NAME' }
    );
  },
  onQueryResolve: async (instance, gameState, playerState, selections, context) => {
    if (context?.step === 'CHOOSE_NAME') {
      const selectedName = selections[0];
      if (!selectedName || selectedName === '__NONE__') return;

      const candidates = playerState.deck.filter(card => card.fullName === selectedName);
      if (candidates.length === 0) return;

      createSelectCardQuery(
        gameState,
        playerState.uid,
        candidates,
        '选择卡牌',
        `从你的卡组中选择最多4张「${selectedName}」加入手牌。`,
        0,
        Math.min(4, candidates.length),
        { sourceCardId: instance.gamecardId, effectId: '205110061_activate', step: 'SEARCH' },
        () => 'DECK'
      );
      return;
    }

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
