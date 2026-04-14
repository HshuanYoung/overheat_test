import { Card, GameState, PlayerState, CardEffect } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';

const activation_10401035: CardEffect = {
  id: 'ranjian_activate',
  type: 'ACTIVATE',
  description: '【启动】[卡名一回合一次][手牌] 此卡在我方手牌中的我方回合。若我方单位区有2个或更多蓝色单位，选择我方单位区一个名称中包含「剑仙」的【神性】单位，支付0费用：将所选单位返回持有者手牌。之后，将此卡放置在战场上。',
  triggerLocation: ['HAND'],
  limitCount: 1,
  limitNameType: true,
  condition: (gameState: GameState, playerState: PlayerState, instance: Card) => {
    // 1. Must be the player's turn
    if (!playerState.isTurn) return false;

    // 2. Must have two or more blue units on the unit zone
    const blueUnitsCount = playerState.unitZone.filter(u => u && u.color === 'BLUE' && u.type === 'UNIT').length;
    if (blueUnitsCount < 2) return false;

    // 3. Must have a 'godmark' unit with name '剑仙' to target
    const targetOptions = playerState.unitZone.filter(u =>
      u && u.godMark && u.fullName.includes('剑仙')
    );
    return targetOptions.length > 0;
  },
  cost: async (gameState: GameState, playerState: PlayerState, instance: Card) => {
    // 0 fee implies no cost or cost function returns true directly. 
    // In this game, if there were a resource cost, we would handle it here.
    return true;
  },
  execute: async (instance: Card, gameState: GameState, playerState: PlayerState) => {
    const targetOptions = playerState.unitZone.filter(u =>
      u && u.godMark && u.fullName.includes('剑仙')
    ) as Card[];

    // Selection query for the target unit
    gameState.pendingQuery = {
      id: Math.random().toString(36).substring(7),
      type: 'SELECT_CARD',
      playerUid: playerState.uid,
      options: targetOptions.map(c => ({ card: c, source: 'UNIT' })),
      title: '选择「剑仙」单位',
      description: '选择我方单位区一个全称包含「剑仙」的【神蚀】单位返回手牌',
      minSelections: 1,
      maxSelections: 1,
      callbackKey: 'EFFECT_RESOLVE',
      context: {
        sourceCardId: instance.gamecardId,
        effectId: 'ranjian_activate',
        step: 1
      }
    };
  },
  onQueryResolve: async (instance: Card, gameState: GameState, playerState: PlayerState, selections: string[], context: any) => {
    if (context.step === 1) {
      const targetCardId = selections[0];
      const targetCard = playerState.unitZone.find(c => c?.gamecardId === targetCardId);

      if (targetCard) {
        gameState.logs.push(`[染剑仙灵] 效果发动：将 ${targetCard.fullName} 返回手牌`);

        // 1. Move target unit to hand
        await AtomicEffectExecutor.execute(gameState, playerState.uid, {
          type: 'MOVE_FROM_FIELD',
          targetFilter: { gamecardId: targetCardId },
          destinationZone: 'HAND'
        }, instance);

        // 2. Move this card (self) to the unit zone
        gameState.logs.push(`[染剑仙灵] 进入战场`);
        await AtomicEffectExecutor.execute(gameState, playerState.uid, {
          type: 'MOVE_FROM_HAND',
          targetFilter: { gamecardId: instance.gamecardId },
          destinationZone: 'UNIT'
        }, instance);

        // Ensure vertical state
        instance.displayState = 'FRONT_UPRIGHT';
        instance.isExhausted = false;
      }
    }
  }
};

const card: Card = {
  id: '10401035',
  gamecardId: null as any,
  fullName: '染剑仙灵',
  specialName: '',
  type: 'UNIT',
  color: 'BLUE',
  colorReq: { 'BLUE': 2 },
  faction: '百濑之水城',
  acValue: 4,
  power: 3000,
  basePower: 3000,
  damage: 3,
  baseDamage: 3,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  isExhausted: false,
  isrush: false,
  canAttack: true,
  feijingMark: false,
  canResetCount: 0,
  effects: [
    activation_10401035
  ],
  rarity: 'PR',
  availableRarities: ['PR'],
  uniqueId: null,
};

export default card;
