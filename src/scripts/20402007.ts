import { Card, GameState, PlayerState, CardEffect } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';

const effect_20402007_activate: CardEffect = {
  id: '20402007_activate',
  type: 'ACTIVATE',
  description: '选择以下效果之一发动：a.选择战场上一个非神位单位转为休息状态。b.选择单位区或道具区中一个处于休息状态的非神位卡牌返回持有者手牌。',
  execute: async (instance: Card, gameState: GameState, playerState: PlayerState) => {
    const choiceOptions = [
      {
        card: {
          gamecardId: 'MODE_EXHAUST',
          id: 'MODE_EXHAUST',
          fullName: '横置效果',
          type: 'STORY',
          color: 'BLUE',
          rarity: 'C'
        } as any,
        source: 'HAND'
      },
      {
        card: {
          gamecardId: 'MODE_BOUNCE',
          id: 'MODE_BOUNCE',
          fullName: '回手效果',
          type: 'STORY',
          color: 'BLUE',
          rarity: 'C'
        } as any,
        source: 'HAND'
      }
    ];

    gameState.pendingQuery = {
      id: Math.random().toString(36).substring(7),
      type: 'SELECT_CARD',
      playerUid: playerState.uid,
      options: choiceOptions,
      title: '请选择发动模式',
      description: 'a. 横置非神位单位 | b. 回手横置非神位卡牌',
      minSelections: 1,
      maxSelections: 1,
      callbackKey: 'EFFECT_RESOLVE',
      context: {
        sourceCardId: instance.gamecardId,
        effectId: '20402007_activate',
        step: 'CHOICE'
      }
    };
  },
  onQueryResolve: async (instance: Card, gameState: GameState, playerState: PlayerState, selections: string[], context: any) => {
    if (context.step === 'CHOICE') {
      const mode = selections[0];
      if (mode === 'MODE_EXHAUST') {
        const targets: Card[] = [];
        Object.values(gameState.players).forEach(p => {
          p.unitZone.forEach(u => {
            if (u && !u.godMark) targets.push(u);
          });
        });

        if (targets.length > 0) {
          gameState.pendingQuery = {
            id: Math.random().toString(36).substring(7),
            type: 'SELECT_CARD',
            playerUid: playerState.uid,
            options: AtomicEffectExecutor.enrichQueryOptions(gameState, playerState.uid, targets.map(t => ({ card: t, source: 'UNIT' }))),
            title: '选择横置目标',
            description: '请选择一个战场上的非神位单位转为休息状态',
            minSelections: 1,
            maxSelections: 1,
            callbackKey: 'EFFECT_RESOLVE',
            context: {
              sourceCardId: instance.gamecardId,
              effectId: '20402007_activate',
              step: 'TARGET_EXHAUST'
            }
          };
        } else {
          gameState.logs.push(`[${instance.fullName}] 没有可供横置的有效目标。`);
        }
      } else if (mode === 'MODE_BOUNCE') {
        const targets: Card[] = [];
        Object.values(gameState.players).forEach(p => {
          p.unitZone.forEach(u => {
            if (u && !u.godMark && u.isExhausted) targets.push(u);
          });
          p.itemZone.forEach(i => {
            if (i && !i.godMark && i.isExhausted) targets.push(i);
          });
        });

        if (targets.length > 0) {
          gameState.pendingQuery = {
            id: Math.random().toString(36).substring(7),
            type: 'SELECT_CARD',
            playerUid: playerState.uid,
            options: AtomicEffectExecutor.enrichQueryOptions(gameState, playerState.uid, targets.map(t => ({ card: t, source: t.cardlocation as any }))),
            title: '选择回手目标',
            description: '请选择一个休息状态的非神位卡牌（单位或道具）返回手牌',
            minSelections: 1,
            maxSelections: 1,
            callbackKey: 'EFFECT_RESOLVE',
            context: {
              sourceCardId: instance.gamecardId,
              effectId: '20402007_activate',
              step: 'TARGET_BOUNCE'
            }
          };
        } else {
          gameState.logs.push(`[${instance.fullName}] 没有可供回手的有效目标。`);
        }
      }
    } else if (context.step === 'TARGET_EXHAUST') {
      const targetId = selections[0];
      await AtomicEffectExecutor.execute(gameState, playerState.uid, {
        type: 'ROTATE_HORIZONTAL',
        targetFilter: { gamecardId: targetId }
      }, instance);
      gameState.logs.push(`[${instance.fullName}] 效果：使单位进入了休息状态。`);
    } else if (context.step === 'TARGET_BOUNCE') {
      const targetId = selections[0];
      await AtomicEffectExecutor.execute(gameState, playerState.uid, {
        type: 'MOVE_FROM_FIELD',
        targetFilter: { gamecardId: targetId },
        destinationZone: 'HAND'
      }, instance);
      gameState.logs.push(`[${instance.fullName}] 效果：将卡牌遣回了手牌。`);
    }
  }
};

const card: Card = {
  id: '20402007',
  fullName: '阿克蒂的诱导',
  specialName: '',
  type: 'STORY',
  color: 'BLUE',
  gamecardId: null as any,
  colorReq: { BLUE: 1 },
  faction: '九尾商会联盟',
  acValue: 2,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  feijingMark: false,
  canResetCount: 0,
  effects: [effect_20402007_activate],
  rarity: 'R',
  availableRarities: ['R'],
  uniqueId: null,
};

export default card;
