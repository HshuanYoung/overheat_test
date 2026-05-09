import { Card, CardEffect } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';
import { createSelectCardQuery, hasTruthUnit, revealDeckCards } from './BaseUtil';

const effect_205000142_activate: CardEffect = {
  id: '205000142_activate',
  type: 'ACTIVATE',
  triggerLocation: ['PLAY'],
  erosionBackLimit: [2, 10],
  description: '创痕2。从你的卡组顶7张卡中将1张卡加入手牌。若你控制「真实」，改为检索任意1张卡。之后洗切卡组。',
  execute: async (instance, gameState, playerState) => {
    if (hasTruthUnit(playerState)) {
      if (playerState.deck.length === 0) return;
      createSelectCardQuery(
        gameState,
        playerState.uid,
        [...playerState.deck],
        '选择卡牌',
        '从你的卡组选择1张卡加入手牌。',
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
      '选择卡牌',
      '从展示的卡中选择1张加入手牌。',
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
  availableRarities: ['R'],
  cardPackage: 'BT03',
  uniqueId: null as any,
};

export default card;
