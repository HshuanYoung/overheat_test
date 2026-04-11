import { Card, GameState, PlayerState, CardEffect } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';


const activation_10401008_1: CardEffect = {
  id: 'beitian_activate_1',
  type: 'ACTIVATE',
  description: '【启动】[名称一回合一次][单位区] 选择本单位装备的一张装备卡：将其破坏。之后，对对手造成等同于该装备卡AC值的效果伤害。',
  triggerLocation: ['UNIT'],
  limitCount: 1,
  limitNameType: true,
  condition: (gameState: GameState, playerState: PlayerState, instance: Card) => {
    // Must have at least one item equipped to this unit
    return playerState.itemZone.some(c => c && c.equipTargetId === instance.gamecardId);
  },
  execute: (instance: Card, gameState: GameState, playerState: PlayerState) => {
    const equippedItems = playerState.itemZone.filter(c => c && c.equipTargetId === instance.gamecardId) as Card[];

    // Select from equipped items
    gameState.pendingQuery = {
      id: Math.random().toString(36).substring(7),
      type: 'SELECT_CARD',
      playerUid: playerState.uid,
      options: equippedItems.map(c => ({ card: c, source: 'ITEM' as any })),
      title: '选择要破坏的装备',
      description: '选择这张卡装备的一个道具卡并将其破坏',
      minSelections: 1,
      maxSelections: 1,
      callbackKey: 'EFFECT_RESOLVE',
      context: {
        sourceCardId: instance.gamecardId,
        effectId: 'beitian_activate_1',
        step: 1
      }
    };
  },
  onQueryResolve: (instance: Card, gameState: GameState, playerState: PlayerState, selections: string[], context: any) => {
    if (context.step === 1) {
      const targetCardId = selections[0];
      const targetCard = playerState.itemZone.find(c => c?.gamecardId === targetCardId);
      if (targetCard) {
        const damageAmount = targetCard.acValue || 0;
        gameState.logs.push(`[北冥] 效果：破坏了装备卡 ${targetCard.fullName}，造成 ${damageAmount} 点效果伤害。`);

        // 1. Destroy the card
        AtomicEffectExecutor.execute(gameState, playerState.uid, {
          type: 'DESTROY_CARD',
          targetFilter: { gamecardId: targetCardId }
        }, instance);

        // 2. Deal damage to player
        AtomicEffectExecutor.execute(gameState, playerState.uid, {
          type: 'DEAL_EFFECT_DAMAGE',
          value: damageAmount
        }, instance);
      }
    }
  }
};

const activation_10401008_2: CardEffect = {
  id: 'beitian_activate_2',
  type: 'ACTIVATE',
  description: '【启动】[手牌] 侵蚀区存在1-4张卡牌时，我方场上有2个蓝色单位，支付0费用，弃掉1张名称中包含「剑仙」的卡牌：将此卡从手牌纵向放置在战场上。',
  triggerLocation: ['HAND'],
  condition: (gameState: GameState, playerState: PlayerState) => {
    // 1-4 cards in erosion zone
    const erosionCount = [...playerState.erosionFront, ...playerState.erosionBack].filter(c => c !== null).length;
    if (erosionCount < 1 || erosionCount > 4) return false;

    // EXACTLY 2 blue units on field
    const blueUnitsCount = playerState.unitZone.filter(u => u && u.color === 'BLUE' && u.type === 'UNIT').length;
    return blueUnitsCount >= 2;
  },
  cost: (gameState: GameState, playerState: PlayerState, instance: Card) => {
    // Search for '剑仙' card in hand (using fullName)
    const discardOptions = playerState.hand.filter(c => c.gamecardId !== instance.gamecardId && c.fullName.includes('剑仙'));
    if (discardOptions.length === 0) return false;

    gameState.pendingQuery = {
      id: Math.random().toString(36).substring(7),
      type: 'SELECT_CARD',
      playerUid: playerState.uid,
      options: discardOptions.map(c => ({ card: c, source: 'HAND' as any })),
      title: '选择弃掉的卡牌',
      description: '请选择一张全名包含「剑仙」的卡牌丢弃以发动效果',
      minSelections: 1,
      maxSelections: 1,
      callbackKey: 'EFFECT_RESOLVE',
      context: {
        sourceCardId: instance.gamecardId,
        effectId: 'beitian_activate_2',
        step: 1
      }
    };

    return true;
  },
  onQueryResolve: (instance: Card, gameState: GameState, playerState: PlayerState, selections: string[], context: any) => {
    if (context.step === 1) {
      const discardId = selections[0];
      const discardCard = playerState.hand.find(c => c.gamecardId === discardId);
      if (discardCard) {
        gameState.logs.push(`[北冥] 效果发动：丢弃了 ${discardCard.fullName}`);
        AtomicEffectExecutor.execute(gameState, playerState.uid, {
          type: 'DISCARD_CARD',
          targetFilter: { gamecardId: discardId }
        }, instance);
      }

      // Final part: Place self on field
      gameState.logs.push(`[北冥] 特殊进入战场`);
      AtomicEffectExecutor.execute(gameState, playerState.uid, {
        type: 'MOVE_FROM_HAND',
        targetFilter: { gamecardId: instance.gamecardId },
        destinationZone: 'UNIT'
      }, instance);

      // Ensure it is vertical
      instance.displayState = 'FRONT_UPRIGHT';
      instance.isExhausted = false;
    }
  }
};

const card: Card = {
  id: '10401008',
  gamecardId: null as any,
  fullName: '四方剑仙 「北冥」',
  specialName: '北冥',
  type: 'UNIT',
  color: 'BLUE',
  colorReq: { 'BLUE': 2 },
  faction: '百濑之水城',
  acValue: 4,
  power: 3000,
  basePower: 3000,
  damage: 3,
  baseDamage: 3,
  godMark: true,
  displayState: 'FRONT_UPRIGHT',
  isExhausted: false,
  isrush: false,
  canAttack: true,
  feijingMark: false,
  canResetCount: 0,
  effects: [
    activation_10401008_1,
    activation_10401008_2
  ],
  rarity: 'SER',
  availableRarities: ['SER'],
  uniqueId: null,
};

export default card;
