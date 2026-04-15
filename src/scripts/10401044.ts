import { Card, GameState, PlayerState, CardEffect, TriggerLocation } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';

const effect_10401044_activation: CardEffect = {
  id: 'suisen_bounce',
  type: 'ACTIVATE',
  triggerLocation: ['UNIT'],
  description: '【启】侵蚀区域在1-4张时：将此单位返回持有者手牌，选择场上一张横置的非神蚀单位返回其持有者手牌。',
  erosionTotalLimit: [1, 4],
  condition: (gameState: GameState, playerState: PlayerState) => {
    return playerState.isTurn && gameState.phase === 'MAIN';
  },
  execute: async (instance: Card, gameState: GameState, playerState: PlayerState) => {
    const pUid = playerState.uid;
    // 1. Move self to hand
    await AtomicEffectExecutor.execute(gameState, pUid, {
      type: 'MOVE_FROM_FIELD',
      targetFilter: { gamecardId: instance.gamecardId },
      destinationZone: 'HAND'
    }, instance);
    gameState.logs.push(`[${instance.fullName}] 自行回到了手牌。`);

    // 2. Select target to bounce
    const targets: Card[] = [];
    Object.values(gameState.players).forEach(p => {
      p.unitZone.forEach(c => {
        if (c && !c.godMark && c.isExhausted) {
          targets.push(c);
        }
      });
    });

    if (targets.length > 0) {
      gameState.pendingQuery = {
        id: Math.random().toString(36).substring(7),
        type: 'SELECT_CARD',
        playerUid: pUid,
        options: AtomicEffectExecutor.enrichQueryOptions(gameState, pUid, targets.map(c => ({ card: c, source: 'UNIT' }))),
        title: '选择回场目标',
        description: '请选择一张横置的非神蚀单位返回其持有者手牌。',
        minSelections: 1,
        maxSelections: 1,
        callbackKey: 'EFFECT_RESOLVE',
        context: {
          effectId: 'suisen_bounce',
          sourceCardId: instance.gamecardId,
          step: 'BOUNCE'
        }
      };
    } else {
      gameState.logs.push(`[${instance.fullName}] 未发现符合条件的横置单位，仅自身返场。`);
    }
  },
  onQueryResolve: async (instance: Card, gameState: GameState, playerState: PlayerState, selections: string[], context: any) => {
    if (context.step === 'BOUNCE' && selections.length > 0) {
      const targetId = selections[0];
      const target = AtomicEffectExecutor.findCardById(gameState, targetId)!;
      const owner = AtomicEffectExecutor.findCardOwnerKey(gameState, targetId)!;

      await AtomicEffectExecutor.execute(gameState, owner, {
        type: 'MOVE_FROM_FIELD',
        targetFilter: { gamecardId: targetId },
        destinationZone: 'HAND'
      }, instance);
      gameState.logs.push(`[${instance.fullName}] 的效果使 [${target.fullName}] 返回了手牌。`);
    }
  }
};

const card: Card = {
  id: '10401044',
  gamecardId: null as any,
  fullName: '水仙--剑姬',
  specialName: '',
  type: 'UNIT',
  color: 'BLUE',
  colorReq: { 'BLUE': 1 },
  faction: '百濑之水城',
  acValue: 3,
  power: 2500,
  basePower: 2500,
  damage: 2,
  baseDamage: 2,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  isExhausted: false,
  isrush: false,
  canAttack: true,
  feijingMark: false,
  canResetCount: 0,
  effects: [
    effect_10401044_activation
  ],
  rarity: 'U',
  availableRarities: ['U'],
  uniqueId: null,
};

export default card;
