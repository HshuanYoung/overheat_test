import { Card, GameState, PlayerState, CardEffect } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';
import { standardizeChoiceOptions } from './BaseUtil';

const effect_204020024_activate: CardEffect = {
  id: '204020024_activate',
  type: 'ACTIVATE',
  triggerLocation: ['PLAY'],
  description: '选择以下效果之一发动：a.选择战场上一个非神位单位转为休息状态。b.选择单位区或道具区中一个处于休息状态的非神位卡牌返回持有者手牌。',
  condition: (gameState: GameState) => {
    const hasExhaustMode = Object.values(gameState.players).some(p =>
      p.unitZone.some(u => u && !u.godMark && !u.isExhausted)
    );
    const hasBounceMode = Object.values(gameState.players).some(p =>
      p.unitZone.some(u => u && !u.godMark && u.isExhausted) ||
      p.itemZone.some(i => i && !i.godMark && i.isExhausted)
    );
    return hasExhaustMode || hasBounceMode;
  },
  execute: async (instance: Card, gameState: GameState, playerState: PlayerState) => {
    const hasExhaustMode = Object.values(gameState.players).some(p =>
      p.unitZone.some(u => u && !u.godMark && !u.isExhausted)
    );
    const hasBounceMode = Object.values(gameState.players).some(p =>
      p.unitZone.some(u => u && !u.godMark && u.isExhausted) ||
      p.itemZone.some(i => i && !i.godMark && i.isExhausted)
    );

    const choiceOptions: any[] = [];

    if (hasExhaustMode) {
      choiceOptions.push({
        id: 'MODE_EXHAUST',
        label: '横置单位',
        detail: '选择战场上1个非神位单位转为休息状态。',
        icon: 'exhaust'
      });
    }

    if (hasBounceMode) {
      choiceOptions.push({
        id: 'MODE_BOUNCE',
        label: '回手横置牌',
        detail: '选择单位区或道具区1张休息状态的非神位卡牌返回手牌。',
        icon: 'return'
      });
    }

    if (choiceOptions.length === 0) {
      gameState.logs.push(`[${instance.fullName}] 没有可发动的模式。`);
      return;
    }

    const choiceContext = {
      sourceCardId: instance.gamecardId,
      effectId: '204020024_activate',
      step: 'CHOICE'
    };

    gameState.pendingQuery = {
      id: Math.random().toString(36).substring(7),
      type: 'SELECT_CHOICE',
      playerUid: playerState.uid,
      options: standardizeChoiceOptions(gameState, choiceOptions, choiceContext),
      title: '请选择发动模式',
      description: 'a. 横置非神位单位 | b. 回手横置非神位卡牌',
      minSelections: 1,
      maxSelections: 1,
      callbackKey: 'EFFECT_RESOLVE',
      context: choiceContext
    };
  },
  onQueryResolve: async (instance: Card, gameState: GameState, playerState: PlayerState, selections: string[], context: any) => {
    if (context.step === 'CHOICE') {
      const mode = selections[0];
      if (mode === 'MODE_EXHAUST') {
        const targets: Card[] = [];
        Object.values(gameState.players).forEach(p => {
          p.unitZone.forEach(u => {
            if (u && !u.godMark && !u.isExhausted) targets.push(u);
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
              effectId: '204020024_activate',
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
              effectId: '204020024_activate',
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
  id: '204020024',
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
  effects: [effect_204020024_activate],
  rarity: 'R',
  availableRarities: ['R'],
  cardPackage: 'BT01',
  uniqueId: null,
};

export default card;
