import { Card, GameState, PlayerState, CardEffect } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';

const trigger_30401005: CardEffect = {
  id: '30401005_trigger',
  type: 'TRIGGER',
  description: '在你的回合，当你战场上的单位返回手牌时，可以发动：将这张卡转为横置状态，选择手牌中一张非神位且属于「百濑之水城」势力单位卡放置在战场上。',
  triggerEvent: 'CARD_FIELD_TO_HAND',
  isMandatory: false,
  condition: (gameState, playerState, instance, event) => {
    return playerState.isTurn && event?.playerUid === playerState.uid && !instance.isExhausted;
  },
  execute: async (instance, gameState, playerState) => {
    // 1. Confirm activation by asking to choose from hand
    const validTargets = playerState.hand.filter(c => c && c.faction === '百濑之水城' && !c.godMark && c.type === 'UNIT');
    
    if (validTargets.length > 0) {
      gameState.pendingQuery = {
        id: Math.random().toString(36).substring(7),
        type: 'SELECT_CARD',
        playerUid: playerState.uid,
        options: AtomicEffectExecutor.enrichQueryOptions(gameState, playerState.uid, validTargets.map(c => ({ card: c, source: 'HAND' as any }))),
        title: '选择出击单位',
        description: '发动【水城客栈】效果：将此卡横置，并选择手牌中的「百濑之水城」单位放置在单位区。',
        minSelections: 1,
        maxSelections: 1,
        callbackKey: 'EFFECT_RESOLVE',
        context: {
          sourceCardId: instance.gamecardId,
          effectId: '30401005_trigger',
          step: 1
        }
      };
    }
  },
  onQueryResolve: async (instance, gameState, playerState, selections, context) => {
    if (context.step === 1) {
      const targetId = selections[0];
      const target = playerState.hand.find(c => c.gamecardId === targetId);
      if (target) {
        // Cost: Exhaust
        await AtomicEffectExecutor.execute(gameState, playerState.uid, {
          type: 'ROTATE_HORIZONTAL',
          targetFilter: { gamecardId: instance.gamecardId }
        }, instance);

        // Effect: Place on Unit Zone
        await AtomicEffectExecutor.execute(gameState, playerState.uid, {
          type: 'MOVE_FROM_HAND',
          targetFilter: { gamecardId: targetId },
          destinationZone: 'UNIT'
        }, instance);
        
        gameState.logs.push(`[${instance.fullName}] 横置并使 [${target.fullName}] 登场了！`);
      }
    }
  }
};

const card: Card = {
  id: '30401005',
  fullName: '【水城客栈】',
  specialName: '',
  type: 'ITEM',
  color: 'BLUE',
  gamecardId: null as any,
  colorReq: { BLUE: 1 },
  faction: '百濑之水城',
  acValue: 2,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  feijingMark: false,
  canResetCount: 0,
  effects: [trigger_30401005],
  rarity: 'R',
  availableRarities: ['R'],
  uniqueId: null,
};

export default card;
