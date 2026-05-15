import { Card, GameState, PlayerState, CardEffect, GameEvent } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';
import { createChoiceQuery } from './BaseUtil';

const trigger_304030075: CardEffect = {
  id: '304030075_trigger',
  type: 'TRIGGER',
  triggerLocation: ['ITEM'],
  description: '当你的单位卡从侵蚀前区进入战场时，可以选择以下效果之一执行。同一选项每回合最多选择一次：a. 该单位在本回合伤害+1、力量+500且获得【速攻】。b. 选择对手的一个竖置非神蚀单位横置。c. 从墓地中选择一张「冒险家公会」卡牌放置在侵蚀前区。',
  triggerEvent: 'CARD_EROSION_TO_FIELD',
  isGlobal: true,
  isMandatory: false,
  condition: (gameState, playerState, instance, event) => {
    return event?.playerUid === playerState.uid && !instance.isExhausted;
  },
  execute: async (instance, gameState, playerState, event) => {
    const usageKeyPrefix = `turn_${gameState.turnCount}_304030075_${instance.gamecardId}_option_`;
    const options: { id: string; label: string }[] = [];

    // Option A: Buff
    if (!gameState.effectUsage?.[usageKeyPrefix + 'a']) {
      options.push({
        id: 'OPTION_A',
        label: '该单位+1/+500并获得速攻'
      });
    }

    // Option B: Exhaust Opponent
    const opponentUid = Object.keys(gameState.players).find(uid => uid !== playerState.uid)!;
    const opponent = gameState.players[opponentUid];
    const hasExhaustTarget = opponent.unitZone.some(u => u && !u.godMark && !u.isExhausted);

    if (!gameState.effectUsage?.[usageKeyPrefix + 'b'] && hasExhaustTarget) {
      options.push({
        id: 'OPTION_B',
        label: '横置对手1个竖置非神蚀单位'
      });
    }

    // Option C: Recycle from Grave
    const hasGraveTarget = playerState.grave.some(c => c && c.faction === '冒险家公会');
    if (!gameState.effectUsage?.[usageKeyPrefix + 'c'] && hasGraveTarget) {
      options.push({
        id: 'OPTION_C',
        label: '墓地「冒险家公会」放入侵蚀区'
      });
    }

    if (options.length > 0) {
      createChoiceQuery(
        gameState,
        playerState.uid,
        '选择效果',
        '请选择一个尚未在本回合使用的效果执行。',
        options,
        {
          sourceCardId: instance.gamecardId,
          effectId: '304030075_trigger',
          enteringCardId: event?.sourceCardId,
          step: 'RESOLVE_OPTION'
        }
      );
    }
  },
  onQueryResolve: async (instance, gameState, playerState, selections, context) => {
    const usageKeyPrefix = `turn_${gameState.turnCount}_304030075_${instance.gamecardId}_option_`;
    const choice = selections[0];

    if (choice === 'OPTION_A') {
      if (!gameState.effectUsage) gameState.effectUsage = {};
      gameState.effectUsage[usageKeyPrefix + 'a'] = 1;

      const targetId = context.enteringCardId;
      if (targetId) {
        await AtomicEffectExecutor.execute(gameState, playerState.uid, {
          type: 'CHANGE_POWER',
          targetFilter: { gamecardId: targetId },
          value: 500,
          turnDuration: 1
        }, instance);
        await AtomicEffectExecutor.execute(gameState, playerState.uid, {
          type: 'CHANGE_DAMAGE',
          targetFilter: { gamecardId: targetId },
          value: 1,
          turnDuration: 1
        }, instance);
        await AtomicEffectExecutor.execute(gameState, playerState.uid, {
          type: 'GAIN_KEYWORD',
          targetFilter: { gamecardId: targetId },
          params: { keyword: 'RUSH' },
          turnDuration: 1
        }, instance);
        const target = AtomicEffectExecutor.findCardById(gameState, targetId);
        if (target) {
          gameState.logs.push(`[${instance.fullName}] 选项A：使 [${target.fullName}] 获得了 +1/+500和速攻。`);
        }
      }
    } else if (choice === 'OPTION_B') {
      if (!gameState.effectUsage) gameState.effectUsage = {};
      gameState.effectUsage[usageKeyPrefix + 'b'] = 1;

      const opponentUid = Object.keys(gameState.players).find(uid => uid !== playerState.uid)!;
      const opponent = gameState.players[opponentUid];
      const targets = opponent.unitZone.filter(u => u && !u.godMark && !u.isExhausted) as Card[];

      if (targets.length > 0) {
        gameState.pendingQuery = {
          id: Math.random().toString(36).substring(7),
          type: 'SELECT_CARD',
          playerUid: playerState.uid,
          options: AtomicEffectExecutor.enrichQueryOptions(gameState, playerState.uid, targets.map(t => ({ card: t, source: 'UNIT' as any }))),
          title: '选择横置目标',
          description: '请选择对手的一个竖置非神蚀单位。',
          minSelections: 1,
          maxSelections: 1,
          callbackKey: 'EFFECT_RESOLVE',
          context: {
            ...context,
            step: 'FINALIZE_EXHAUST'
          }
        };
      }
    } else if (choice === 'OPTION_C') {
      if (!gameState.effectUsage) gameState.effectUsage = {};
      gameState.effectUsage[usageKeyPrefix + 'c'] = 1;

      const graveChoices = playerState.grave.filter(c => c && c.faction === '冒险家公会');

      if (graveChoices.length > 0) {
        gameState.pendingQuery = {
          id: Math.random().toString(36).substring(7),
          type: 'SELECT_CARD',
          playerUid: playerState.uid,
          options: AtomicEffectExecutor.enrichQueryOptions(gameState, playerState.uid, graveChoices.map(c => ({ card: c, source: 'GRAVE' as any }))),
          title: '选择回收卡牌',
          description: '请从墓地选择一张「冒险家公会」卡牌放置在侵蚀前区。',
          minSelections: 1,
          maxSelections: 1,
          callbackKey: 'EFFECT_RESOLVE',
          context: {
            ...context,
            step: 'FINALIZE_RECYCLE'
          }
        };
      }
    } else if (context.step === 'FINALIZE_EXHAUST') {
      const targetId = selections[0];
      await AtomicEffectExecutor.execute(gameState, playerState.uid, {
        type: 'ROTATE_HORIZONTAL',
        targetFilter: { gamecardId: targetId }
      }, instance);
      gameState.logs.push(`[${instance.fullName}] 选项B：横置了对手的单位。`);
    } else if (context.step === 'FINALIZE_RECYCLE') {
      const targetId = selections[0];
      await AtomicEffectExecutor.execute(gameState, playerState.uid, {
        type: 'MOVE_FROM_GRAVE',
        targetFilter: { gamecardId: targetId },
        destinationZone: 'EROSION_FRONT'
      }, instance);

      const cardInErosion = playerState.erosionFront.find(c => c?.gamecardId === targetId);
      if (cardInErosion) cardInErosion.displayState = 'FRONT_UPRIGHT';

      gameState.logs.push(`[${instance.fullName}] 选项C：将卡牌从墓地移至侵蚀前区。`);
    }
  }
};

const card: Card = {
  id: '304030075',
  fullName: '【龙翼冒险者协会】',
  specialName: '龙翼冒险者协会',
  type: 'ITEM',
  color: 'BLUE',
  gamecardId: null as any,
  colorReq: { BLUE: 1 },
  faction: '冒险家公会',
  acValue: 2,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  feijingMark: false,
  canResetCount: 0,
  effects: [trigger_304030075],
  rarity: 'R',
  availableRarities: ['R'],
  cardPackage: 'BT04',
  uniqueId: null,
};

export default card;
