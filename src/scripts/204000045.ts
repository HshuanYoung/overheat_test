import { Card, GameState, PlayerState, CardEffect } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';

const effect_204000045_activate: CardEffect = {
  id: '204000045_activate',
  type: 'ACTIVATE',
  triggerLocation: ['PLAY', 'HAND'],
  description: '选择你侵蚀位前区的一张卡牌加入手牌。',
  condition: (gameState: GameState, playerState: PlayerState) => {
    return playerState.erosionFront.some(c => c !== null);
  },
  execute: async (instance: Card, gameState: GameState, playerState: PlayerState) => {
    const choices = playerState.erosionFront.filter(c => c !== null) as Card[];
    if (choices.length === 0) return;

    gameState.pendingQuery = {
      id: Math.random().toString(36).substring(7),
      type: 'SELECT_CARD',
      playerUid: playerState.uid,
      options: AtomicEffectExecutor.enrichQueryOptions(gameState, playerState.uid, choices.map(c => ({ card: c, source: 'EROSION_FRONT' }))),
      title: '选择卡牌',
      description: '选择一张侵蚀前区的卡牌加入手牌。',
      minSelections: 1,
      maxSelections: 1,
      callbackKey: 'EFFECT_RESOLVE',
      context: {
        sourceCardId: instance.gamecardId,
        effectId: '204000045_activate'
      }
    };
  },
  onQueryResolve: async (instance: Card, gameState: GameState, playerState: PlayerState, selections: string[]) => {
    const targetId = selections[0];
    const target = AtomicEffectExecutor.findCardById(gameState, targetId);
    if (target) {
      await AtomicEffectExecutor.execute(gameState, playerState.uid, {
        type: 'MOVE_FROM_EROSION',
        targetFilter: { gamecardId: targetId },
        destinationZone: 'HAND'
      }, instance);
      gameState.logs.push(`[${instance.fullName}] 效果：将 [${target.fullName}] 从侵蚀区回收。`);
    }
  },
  targetSpec: {
    title: '选择卡牌',
    description: '选择一张侵蚀前区的卡牌加入手牌。',
    minSelections: 1,
    maxSelections: 1,
    zones: ['EROSION_FRONT'],
    getCandidates: (_gameState, playerState) => playerState.erosionFront
      .filter((card): card is Card => !!card)
      .map(card => ({ card, source: 'EROSION_FRONT' as any }))
  }
};

const card: Card = {
  id: '204000045',
  fullName: '交易术实习',
  specialName: '',
  type: 'STORY',
  color: 'BLUE',
  gamecardId: null as any,
  colorReq: { BLUE: 1 },
  faction: '无',
  acValue: 1,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  feijingMark: false,
  canResetCount: 0,
  effects: [effect_204000045_activate],
  rarity: 'R',
  availableRarities: ['R'],
  cardPackage: 'BT02',
  uniqueId: null,
};

export default card;
