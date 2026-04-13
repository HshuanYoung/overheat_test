import { Card, GameState, PlayerState, CardEffect, TriggerLocation } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';

const effect_20400013_activation: CardEffect = {
  id: 'kaguya_flowering_silence',
  type: 'ACTIVATE',
  description: '【起】选择场上一个单位的一个“起”效果，在本回合中不被处理。',
  condition: (gameState: GameState, playerState: PlayerState) => {
    return playerState.isTurn && gameState.phase === 'MAIN';
  },
  execute: async (gameState: GameState, playerState: PlayerState, instance: Card) => {
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
        description: '请选择一个拥有“起”效果的单位。',
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
      gameState.logs.push(`[${instance.fullName}] 未发现拥有可封印“起”效果的单位。`);
    }
  },
  onQueryResolve: (instance: Card, gameState: GameState, playerState: PlayerState, selections: string[], context: any) => {
    if (context.step === 'SELECT_UNIT' && selections.length > 0) {
      const targetId = selections[0];
      const target = AtomicEffectExecutor.findCardById(gameState, targetId);
      if (target && target.effects) {
        const activateEffects = target.effects.filter(e => e.type === 'ACTIVATE');
        
        if (activateEffects.length === 1) {
          // Auto-select if only one
          if (!target.silencedEffectIds) target.silencedEffectIds = [];
          target.silencedEffectIds.push(activateEffects[0].id);
          gameState.logs.push(`[${instance.fullName}] 封印了 [${target.fullName}] 的 “${activateEffects[0].description.slice(0, 20)}...” 效果。`);
        } else if (activateEffects.length > 1) {
          // Give choice
          gameState.pendingQuery = {
            id: Math.random().toString(36).substring(7),
            type: 'SELECT_CHOICE',
            playerUid: playerState.uid,
            options: activateEffects.map(e => ({ id: e.id, label: e.description })),
            title: '选择效果',
            description: '请选择要封印的“起”效果。',
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
        gameState.logs.push(`[${instance.fullName}] 封印了 [${target.fullName}] 的指定“起”效果。`);
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
