import { Card, GameState, PlayerState, CardEffect, TriggerLocation } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';

const effect_20400013_activation: CardEffect = {
  id: 'kaguya_flowering_silence',
  type: 'ACTIVATE',
  description: '【启】主要阶段：选择场上一个单位的一个“启”效果，在本回合中不被处理。不论目标是否处理该效果，此卡均可参与对抗并支付费用。或者：在对抗阶段：使一次发动无效并送入墓地。',
  triggerLocation: ['HAND', 'UNIT', 'PLAY'],
  condition: (gameState: GameState, playerState: PlayerState, instance: Card) => {
    // 1. Main Phase Mode: Target a unit's ACTIVATE effect on field
    if (gameState.phase === 'MAIN' && playerState.isTurn) {
      return Object.values(gameState.players).some(p =>
        p.unitZone.some(c => c && c.effects && c.effects.some(e => e.type === 'ACTIVATE'))
      );
    }
    
    // 2. Counter Mode: Direct response to a card or effect on stack
    if (gameState.phase === 'COUNTERING') {
      return gameState.counterStack.some(item => 
        (item.type === 'PLAY' || item.type === 'EFFECT') && 
        !item.isNegated
      );
    }
    
    return false;
  },
  execute: async (instance: Card, gameState: GameState, playerState: PlayerState) => {
    // Handle Counter Mode: If resolving from stack or immediate response
    if (gameState.phase === 'COUNTERING') {
      // We look for the most recent valid item on the stack to negate
      for (let i = gameState.counterStack.length - 1; i >= 0; i--) {
        const item = gameState.counterStack[i];
        if ((item.type === 'PLAY' || item.type === 'EFFECT') && !item.isNegated) {
          item.isNegated = true;
          gameState.logs.push(`[${instance.fullName}] 使 [${item.card?.fullName || '效果'}] 发动无效。`);
          return;
        }
      }
      return;
    }

    // Handle Main Phase Mode: Target field
    const targets: Card[] = [];
    Object.values(gameState.players).forEach(p => {
      p.unitZone.forEach(c => {
        if (c && c.effects && c.effects.some(e => e.type === 'ACTIVATE')) {
          targets.push(c);
        }
      });
    });

    if (targets.length > 0) {
      gameState.pendingQuery = {
        id: Math.random().toString(36).substring(7),
        type: 'SELECT_CARD',
        playerUid: playerState.uid,
        options: AtomicEffectExecutor.enrichQueryOptions(gameState, playerState.uid, targets.map(c => ({ card: c, source: 'UNIT' }))),
        title: '选择目标单位',
        description: '请选择一个拥有“启”效果的单位。',
        minSelections: 1,
        maxSelections: 1,
        callbackKey: 'EFFECT_RESOLVE',
        context: {
          effectId: 'kaguya_flowering_silence',
          sourceCardId: instance.gamecardId,
          step: 'SELECT_UNIT'
        }
      };
    } else {
      gameState.logs.push(`[${instance.fullName}] 未发现拥有可封印“启”效果的单位。`);
    }
  },
  onQueryResolve: async (instance: Card, gameState: GameState, playerState: PlayerState, selections: string[], context: any) => {
    if (context.step === 'SELECT_UNIT' && selections.length > 0) {
      const targetId = selections[0];
      const target = AtomicEffectExecutor.findCardById(gameState, targetId);
      if (target && target.effects) {
        const activateEffects = target.effects.filter(e => e.type === 'ACTIVATE');

        if (activateEffects.length === 1) {
          if (!target.silencedEffectIds) target.silencedEffectIds = [];
          target.silencedEffectIds.push(activateEffects[0].id);
          gameState.logs.push(`[${instance.fullName}] 封印了 [${target.fullName}] 的 “${activateEffects[0].description.slice(0, 20)}...” 效果。`);
        } else if (activateEffects.length > 1) {
          gameState.pendingQuery = {
            id: Math.random().toString(36).substring(7),
            type: 'SELECT_CHOICE',
            playerUid: playerState.uid,
            options: activateEffects.map(e => ({ id: e.id, label: e.description })),
            title: '选择效果',
            description: '请选择要封印的“启”效果。',
            callbackKey: 'EFFECT_RESOLVE',
            context: {
              effectId: 'kaguya_flowering_silence',
              sourceCardId: instance.gamecardId,
              targetId,
              step: 'SELECT_EFFECT'
            }
          };
        }
      }
    } else if (context.step === 'SELECT_EFFECT' && selections.length > 0) {
      const { targetId } = context;
      const target = AtomicEffectExecutor.findCardById(gameState, targetId);
      if (target) {
        if (!target.silencedEffectIds) target.silencedEffectIds = [];
        target.silencedEffectIds.push(selections[0]);
        gameState.logs.push(`[${instance.fullName}] 封印了 [${target.fullName}] 的指定“启”效果。`);
      }
    }
  }
};

const card: Card = {
  id: '20400013',
  gamecardId: null as any,
  fullName: '歌月花开',
  specialName: '',
  type: 'STORY',
  color: 'BLUE',
  colorReq: { 'BLUE': 1 },
  faction: '无',
  acValue: 2,
  power: 0,
  basePower: 0,
  damage: 0,
  baseDamage: 0,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  isExhausted: false,
  isrush: false,
  canAttack: false,
  feijingMark: false,
  canResetCount: 0,
  effects: [
    effect_20400013_activation
  ],
  rarity: 'U',
  availableRarities: ['U'],
  uniqueId: null,
};

export default card;
