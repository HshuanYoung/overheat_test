import { Card, GameState, PlayerState, CardEffect, GameEvent } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';

const trigger_30403004: CardEffect = {
  id: '30403004_trigger',
  type: 'TRIGGER',
  triggerLocation: ['ITEM'],
  description: '当你的单位卡从侵蚀前区进入战场时，可以选择以下效果之一执行。同一选项每回合最多选择一次：a. 该单位在本回合获得全攻，力量+500 且获得【速攻】。b. 选择对手的一个非神位单位转为横置。c. 从墓地中选择一张「冒险家公会」卡牌放置在侵蚀前区。',
  triggerEvent: 'CARD_EROSION_TO_FIELD',
  isGlobal: true,
  isMandatory: false,
  condition: (gameState, playerState, instance, event) => {
    return event?.playerUid === playerState.uid && !instance.isExhausted;
  },
  execute: async (instance, gameState, playerState, event) => {
    const usageKeyPrefix = `30403004_${instance.gamecardId}_option_`;
    const options: any[] = [];

    // Option A: Buff
    if (!gameState.effectUsage?.[usageKeyPrefix + 'a']) {
      options.push({
        card: {
          gamecardId: 'OPTION_A',
          id: 'OPTION_A',
          fullName: '选项A：力量+500/全攻/速攻',
          type: 'STORY',
          color: 'BLUE',
          rarity: 'C'
        } as any,
        source: 'HAND' as any
      });
    }

    // Option B: Exhaust Opponent
    if (!gameState.effectUsage?.[usageKeyPrefix + 'b']) {
      options.push({
        card: {
          gamecardId: 'OPTION_B',
          id: 'OPTION_B',
          fullName: '选项B：横置对手非神位单位',
          type: 'STORY',
          color: 'BLUE',
          rarity: 'C'
        } as any,
        source: 'HAND' as any
      });
    }

    // Option C: Recycle from Grave
    if (!gameState.effectUsage?.[usageKeyPrefix + 'c']) {
      options.push({
        card: {
          gamecardId: 'OPTION_C',
          id: 'OPTION_C',
          fullName: '选项C：回收墓地「冒险家公会」',
          type: 'STORY',
          color: 'BLUE',
          rarity: 'C'
        } as any,
        source: 'HAND' as any
      });
    }

    if (options.length > 0) {
      gameState.pendingQuery = {
        id: Math.random().toString(36).substring(7),
        type: 'SELECT_CARD',
        playerUid: playerState.uid,
        options,
        title: '【龙翼冒险者协会】模式选择',
        description: '请选择一个尚未在本回合使用的效果执行。',
        minSelections: 1,
        maxSelections: 1,
        callbackKey: 'EFFECT_RESOLVE',
        context: {
          sourceCardId: instance.gamecardId,
          effectId: '30403004_trigger',
          enteringCardId: event?.sourceCardId,
          step: 'RESOLVE_OPTION'
        }
      };
    }
  },
  onQueryResolve: async (instance, gameState, playerState, selections, context) => {
    const usageKeyPrefix = `30403004_${instance.gamecardId}_option_`;
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
          description: '请选择对手的一个非神位单位。',
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
  id: '30403004',
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
  effects: [trigger_30403004],
  rarity: 'R',
  availableRarities: ['R'],
  uniqueId: null,
};

export default card;
