import { Card, GameState, PlayerState, CardEffect, GameEvent, TriggerLocation } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';

const continuous_10106059_color: CardEffect = {
  id: '南宫_永续_忽略颜色',
  type: 'CONTINUOUS',
  description: '【永续】我方装备卡忽略颜色要求。',
  triggerLocation: ['UNIT'],
  applyContinuous: (gameState: GameState, card: Card) => {
    const player = gameState.players[card.ownerUid];
    if (!player) return;
    
    player.hand.forEach(h => {
      if (h && h.type === 'ITEM' && h.isEquip) {
        h.colorReq = {};
      }
    });
  }
};

const trigger_10106059_recover: CardEffect = {
  id: '南宫_诱发_回收装备',
  type: 'TRIGGER',
  description: '【诱发】[名称一回合一次] 当我方装备被破坏送入墓地时，可以支付其AC值将其放置在道具区。',
  triggerLocation: ['UNIT'],
  triggerEvent: 'CARD_LEFT_ZONE', // Reliable for zone transitions
  limitCount: 1,
  limitNameType: true,
  isMandatory: false,
  condition: (gameState: GameState, playerState: PlayerState, instance: Card, event?: GameEvent) => {
    // Ensure the card moved to grave
    if (!event || event.data?.targetZone !== 'GRAVE') return false;
    
    // Check if it's the player's card
    const sourceCardId = event.sourceCardId;
    const playerGrave = playerState.grave;
    const cardInGrave = playerGrave.find(c => c && c.gamecardId === sourceCardId);
    
    if (!cardInGrave) return false;
    
    // Check if it's an equipment
    return !!(cardInGrave.type === 'ITEM' && cardInGrave.isEquip);
  },
  execute: async (instance: Card, gameState: GameState, playerState: PlayerState, event?: GameEvent) => {
    const sourceCardId = event?.sourceCardId;
    const cardInGrave = playerState.grave.find(c => c && c.gamecardId === sourceCardId);
    if (!cardInGrave) return;

    const acCost = cardInGrave.acValue || 0;

    // Issue a SELECT_PAYMENT query for the AC value
    gameState.pendingQuery = {
      id: Math.random().toString(36).substring(7),
      type: 'SELECT_PAYMENT',
      playerUid: playerState.uid,
      options: [],
      title: `支付 AC 费用: ${cardInGrave.fullName}`,
      description: `支付 ${acCost} 点费用以将此装备放置回道具区。`,
      minSelections: 1,
      maxSelections: 1,
      callbackKey: 'EFFECT_RESOLVE',
      paymentCost: acCost,
      paymentColor: cardInGrave.color,
      context: {
        sourceCardId: instance.gamecardId,
        effectId: '南宫_诱发_回收装备',
        recoveringCardId: sourceCardId
      }
    };
  },
  onQueryResolve: async (instance: Card, gameState: GameState, playerState: PlayerState, selections: string[], context: any) => {
    const recoveringCardId = context.recoveringCardId;
    
    await AtomicEffectExecutor.execute(gameState, playerState.uid, {
      type: 'MOVE_FROM_GRAVE',
      targetFilter: { gamecardId: recoveringCardId },
      destinationZone: 'ITEM'
    }, instance);

    const recovered = AtomicEffectExecutor.findCardById(gameState, recoveringCardId);
    gameState.logs.push(`[${instance.fullName}] 效果：支付费用后，将装备 [${recovered?.fullName}] 移回道具区。`);
  }
};

const activate_10106059_search: CardEffect = {
  id: '南宫_启动_检索',
  type: 'ACTIVATE',
  description: '【启动】[一局游戏一次] 仅在侵蚀区没有卡牌时可以发动：从卡组将一张「四方剑仙」卡牌和一张装备卡加入手牌。',
  triggerLocation: ['UNIT'],
  limitGlobal: true,
  limitCount: 1,
  erosionTotalLimit: [0, 0],
  execute: async (instance: Card, gameState: GameState, playerState: PlayerState) => {
    // Search 1: Sword Immortal
    const swordImmortalOptions = playerState.deck.filter(c => c && c.fullName.includes('四方剑仙'));
    
    if (swordImmortalOptions.length > 0) {
      gameState.pendingQuery = {
        id: Math.random().toString(36).substring(7),
        type: 'SELECT_CARD',
        playerUid: playerState.uid,
        options: AtomicEffectExecutor.enrichQueryOptions(gameState, playerState.uid, swordImmortalOptions.map(c => ({ card: c, source: 'DECK' }))),
        title: '检索「四方剑仙」卡牌',
        description: '从卡组选择一张包含「四方剑仙」名称的卡牌。',
        minSelections: 1,
        maxSelections: 1,
        callbackKey: 'EFFECT_RESOLVE',
        context: {
          sourceCardId: instance.gamecardId,
          effectId: '南宫_启动_检索',
          step: 1
        }
      };
    } else {
      // Skip to search 2 if no sword immortals
      await initiateSearch2(instance, gameState, playerState);
    }
  },
  onQueryResolve: async (instance: Card, gameState: GameState, playerState: PlayerState, selections: string[], context: any) => {
    if (context.step === 1) {
      const selectedId = selections[0];
      await AtomicEffectExecutor.execute(gameState, playerState.uid, {
        type: 'SEARCH_DECK',
        targetFilter: { gamecardId: selectedId }
      }, instance);

      // Proceed to search 2
      await initiateSearch2(instance, gameState, playerState);
    } else if (context.step === 2) {
      const selectedId = selections[0];
      await AtomicEffectExecutor.execute(gameState, playerState.uid, {
        type: 'SEARCH_DECK',
        targetFilter: { gamecardId: selectedId }
      }, instance);
      
      gameState.logs.push(`[${instance.fullName}] 完成了双重检索。`);
    }
  }
};

async function initiateSearch2(instance: Card, gameState: GameState, playerState: PlayerState) {
  const equipmentOptions = playerState.deck.filter(c => c && c.type === 'ITEM' && c.isEquip);
  if (equipmentOptions.length > 0) {
    gameState.pendingQuery = {
      id: Math.random().toString(36).substring(7),
      type: 'SELECT_CARD',
      playerUid: playerState.uid,
      options: AtomicEffectExecutor.enrichQueryOptions(gameState, playerState.uid, equipmentOptions.map(c => ({ card: c, source: 'DECK' }))),
      title: '检索装备卡',
      description: '从卡组选择一张装备卡。',
      minSelections: 1,
      maxSelections: 1,
      callbackKey: 'EFFECT_RESOLVE',
      context: {
        sourceCardId: instance.gamecardId,
        effectId: '南宫_启动_检索',
        step: 2
      }
    };
  } else {
     gameState.logs.push(`[${instance.fullName}] 卡组中没有可检索的装备卡。`);
  }
}

const card: Card = {
  id: '10106059',
  fullName: '四方剑仙【南宫】',
  specialName: '南宫',
  type: 'UNIT',
  color: 'WHITE',
  gamecardId: null as any,
  colorReq: { WHITE: 1 },
  faction: '圣王国',
  acValue: 3,
  power: 2500,
  basePower: 2500,
  damage: 2,
  baseDamage: 2,
  godMark: true,
  displayState: 'FRONT_UPRIGHT',
  isExhausted: false,
  isrush: false,
  canAttack: true,
  feijingMark: false,
  canResetCount: 0,
  effects: [continuous_10106059_color, trigger_10106059_recover, activate_10106059_search],
  rarity: 'UR',
  availableRarities: ['UR'],
  uniqueId: null,
};

export default card;
