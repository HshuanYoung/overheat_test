import { Card, GameState, PlayerState, CardEffect, GameEvent, TriggerLocation } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';

const effect_10400055_trigger: CardEffect = {
  id: 'tsukiyoru_bounce_trigger',
  type: 'TRIGGER',
  triggerEvent: 'CARD_ENTERED_ZONE',
  description: '【诱】当此单位进入对战区时：选择对战区或道具区中一张横置的非神蚀卡牌返回其持有者手牌。',
  condition: (gameState: GameState, playerState: PlayerState, instance: Card, event?: GameEvent) => {
    return event?.type === 'CARD_ENTERED_ZONE' &&
      event.sourceCardId === instance.gamecardId &&
      event.data?.zone === 'UNIT';
  },
  triggerLocation: ['UNIT'],
  execute: async (instance: Card, gameState: GameState, playerState: PlayerState) => {
    const targets: Card[] = [];
    Object.values(gameState.players).forEach(p => {
      // Unit Zone
      p.unitZone.forEach(c => {
        if (c && !c.godMark && c.isExhausted) {
          targets.push(c);
        }
      });
      // Item Zone
      p.itemZone.forEach(c => {
        if (c && !c.godMark && c.isExhausted) {
          targets.push(c);
        }
      });
    });

    if (targets.length > 0) {
      gameState.pendingQuery = {
        id: Math.random().toString(36).substring(7),
        type: 'SELECT_CARD',
        playerUid: playerState.uid,
        // Identify source zone for UI
        options: AtomicEffectExecutor.enrichQueryOptions(gameState, playerState.uid, targets.map(c => ({
          card: c,
          source: c.cardlocation as TriggerLocation
        }))),
        title: '选择回场目标',
        description: '请选择一张横置的非神蚀卡牌返回其持有者手牌。',
        minSelections: 1,
        maxSelections: 1,
        callbackKey: 'EFFECT_RESOLVE',
        context: {
          effectId: 'tsukiyoru_bounce_trigger',
          sourceCardId: instance.gamecardId
        }
      };
    } else {
      gameState.logs.push(`[${instance.fullName}] 未发现符合条件的横置卡牌。`);
    }
  },
  onQueryResolve: async (instance: Card, gameState: GameState, playerState: PlayerState, selections: string[]) => {
    if (selections.length > 0) {
      const targetId = selections[0];
      const target = AtomicEffectExecutor.findCardById(gameState, targetId);
      if (target) {
        const ownerUid = AtomicEffectExecutor.findCardOwnerKey(gameState, targetId)!;
        await AtomicEffectExecutor.execute(gameState, ownerUid, {
          type: 'MOVE_FROM_FIELD',
          targetFilter: { gamecardId: targetId },
          destinationZone: 'HAND'
        }, instance);
        gameState.logs.push(`[${instance.fullName}] 诱发效果：使对手的 [${target.fullName}] 返回了手牌。`);
      }
    }
  }
};

const card: Card = {
  id: '10400056',
  gamecardId: null as any,
  fullName: '月夜飞龙',
  specialName: '',
  type: 'UNIT',
  color: 'BLUE',
  colorReq: { 'BLUE': 1 },
  faction: '无',
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
    effect_10400055_trigger
  ],
  rarity: 'R',
  availableRarities: ['R'],
  uniqueId: null,
};

export default card;
