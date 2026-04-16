import { Card, GameState, PlayerState, CardEffect } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';

const effect_20400011_activate: CardEffect = {
  id: '20400011_activate',
  type: 'ACTIVATE',
  description: '选择战场上一个神蚀单位转为竖置状态。在下个对手的回合开始阶段，该单位不能重置。',
  condition: (gameState: GameState) => {
    return Object.values(gameState.players).some(p =>
      p.unitZone.some(u => u && u.godMark && !u.isExhausted)
    );
  },
  execute: async (instance: Card, gameState: GameState, playerState: PlayerState) => {
    const targets: Card[] = [];
    Object.values(gameState.players).forEach(p => {
      p.unitZone.forEach(u => {
        if (u && u.godMark && !u.isExhausted) targets.push(u);
      });
    });

    if (targets.length === 0) return;

    gameState.pendingQuery = {
      id: Math.random().toString(36).substring(7),
      type: 'SELECT_CARD',
      playerUid: playerState.uid,
      options: AtomicEffectExecutor.enrichQueryOptions(gameState, playerState.uid, targets.map(t => ({ card: t, source: 'UNIT' }))),
      title: '选择神位单位',
      description: '选择一个神位单位转为横置状态，回合开始时不能竖置。',
      minSelections: 1,
      maxSelections: 1,
      callbackKey: 'EFFECT_RESOLVE',
      context: {
        sourceCardId: instance.gamecardId,
        effectId: '20400011_activate'
      }
    };
  },
  onQueryResolve: async (instance: Card, gameState: GameState, playerState: PlayerState, selections: string[]) => {
    const targetId = selections[0];
    const target = AtomicEffectExecutor.findCardById(gameState, targetId);
    if (target) {
      await AtomicEffectExecutor.execute(gameState, playerState.uid, {
        type: 'ROTATE_HORIZONTAL',
        targetFilter: { gamecardId: targetId }
      }, instance);

      await AtomicEffectExecutor.execute(gameState, playerState.uid, {
        type: 'SET_CAN_RESET_COUNT',
        targetFilter: { gamecardId: targetId },
        value: 1
      }, instance);

      gameState.logs.push(`[${instance.fullName}] 效果：使 [${target.fullName}] 休息并进入冻结状态。`);
    }
  }
};

const card: Card = {
  id: '20400011',
  fullName: '大陆游历',
  specialName: '',
  type: 'STORY',
  color: 'BLUE',
  gamecardId: null as any,
  colorReq: { BLUE: 1 },
  faction: '无',
  acValue: 3,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  feijingMark: false,
  canResetCount: 0,
  effects: [effect_20400011_activate],
  rarity: 'R',
  availableRarities: ['R'],
  uniqueId: null,
};

export default card;
