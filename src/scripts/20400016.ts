import { Card, GameState, PlayerState, CardEffect } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';

const effect_20400016_activate: CardEffect = {
  id: '20400016_activate',
  type: 'ACTIVATE',
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
        effectId: '20400016_activate'
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
  }
};

const card: Card = {
  id: '20400016',
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
  effects: [effect_20400016_activate],
  rarity: 'R',
  availableRarities: ['R'],
  uniqueId: null,
};

export default card;
