import { Card, GameState, PlayerState, CardEffect, GameEvent, TriggerLocation } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';

const trigger_10403019_buff: CardEffect = {
  id: '10403019_entry_buff',
  type: 'TRIGGER',
  description: '【诱发】当此卡从侵蚀位前区移动到单位区时：此卡获得+1/+1000且获得【速攻】。',
  triggerLocation: ['UNIT'],
  triggerEvent: 'CARD_EROSION_TO_FIELD',
  isMandatory: true,
  condition: (gameState: GameState, playerState: PlayerState, instance: Card, event?: GameEvent) => {
    return event?.sourceCardId === instance.gamecardId || event?.sourceCard === instance;
  },
  execute: async (instance: Card, gameState: GameState, playerState: PlayerState) => {
    await AtomicEffectExecutor.execute(gameState, playerState.uid, {
      type: 'CHANGE_POWER',
      targetFilter: { gamecardId: instance.gamecardId },
      value: 1000
    }, instance);
    await AtomicEffectExecutor.execute(gameState, playerState.uid, {
      type: 'CHANGE_DAMAGE',
      targetFilter: { gamecardId: instance.gamecardId },
      value: 1
    }, instance);

    instance.isrush = true; // Still manual for keywords as atomic might not have them yet
    gameState.logs.push(`[${instance.fullName}] 触发：从侵蚀区登场，获得+1/+1000与【速攻】。`);
  }
};

const activate_10403019_swap: CardEffect = {
  id: '10403019_swap',
  type: 'ACTIVATE',
  description: '【启】[名称一回合一次] 侵蚀区数量为3-7张、且在你的回合时，支付1费：将此单位正面表示置入侵蚀位前区，之后选择你侵蚀位前区除「巴特拉」以外的一张正面表示的「冒险家公会」单位卡，放置在单位区。',
  limitCount: 1,
  limitNameType: true,
  erosionTotalLimit: [3, 7],
  condition: (gameState: GameState, playerState: PlayerState) => {
    return playerState.isTurn;
  },
  cost: async (gameState: GameState, playerState: PlayerState, instance: Card) => {
    const available = playerState.erosionFront.filter(c => c !== null);
    if (available.length < 1) return false;

    // Trigger payment selection (1 fee)
    gameState.pendingQuery = {
      id: Math.random().toString(36).substring(7),
      type: 'SELECT_PAYMENT',
      playerUid: playerState.uid,
      paymentCost: 1,
      options: AtomicEffectExecutor.enrichQueryOptions(gameState, playerState.uid, available.map(c => ({ card: c, source: 'EROSION_FRONT' }))),
      title: '支付费用',
      description: '请选择一张侵蚀前区的卡牌作为费用以发动效果。',
      minSelections: 1,
      maxSelections: 1,
      callbackKey: 'ACTIVATE_COST_RESOLVE',
      context: {
        sourceCardId: instance.gamecardId,
        step: 'COST'
      }
    };

    return true; // Wait for selection
  },
  execute: async (instance: Card, gameState: GameState, playerState: PlayerState) => {
    // Handled in onQueryResolve
  },
  onQueryResolve: async (instance: Card, gameState: GameState, playerState: PlayerState, selections: string[], context: any) => {
    if (context.step === 'COST') {
      // 1. Move self to erosion front
      await AtomicEffectExecutor.execute(gameState, playerState.uid, {
        type: 'MOVE_FROM_FIELD',
        targetFilter: { gamecardId: instance.gamecardId },
        destinationZone: 'EROSION_FRONT'
      }, instance);
      instance.displayState = 'FRONT_UPRIGHT';

      // 2. Select replacement from erosion
      const erosionChoices = playerState.erosionFront.filter(c =>
        c &&
        c.displayState === 'FRONT_UPRIGHT' &&
        c.type === 'UNIT' &&
        c.faction === '冒险家公会' &&
        !c.fullName.includes('巴特拉')
      ) as Card[];

      if (erosionChoices.length > 0) {
        gameState.pendingQuery = {
          id: Math.random().toString(36).substring(7),
          type: 'SELECT_CARD',
          playerUid: playerState.uid,
          options: AtomicEffectExecutor.enrichQueryOptions(gameState, playerState.uid, erosionChoices.map(c => ({ card: c, source: 'EROSION_FRONT' }))),
          title: '选择入场的单位',
          description: '请选择一张侵蚀位前区的「冒险家公会」单位放置在战场上。',
          minSelections: 1,
          maxSelections: 1,
          callbackKey: 'EFFECT_RESOLVE',
          context: {
            sourceCardId: instance.gamecardId,
            step: 'SWAP_IN'
          }
        };
      } else {
        gameState.logs.push(`[${instance.fullName}] 侵蚀区没有符合条件的「冒险家公会」单位。`);
      }
    } else if (context.step === 'SWAP_IN') {
      const targetId = selections[0];
      const targetCard = playerState.erosionFront.find(c => c?.gamecardId === targetId);
      if (targetCard) {
        await AtomicEffectExecutor.execute(gameState, playerState.uid, {
          type: 'MOVE_FROM_EROSION',
          targetFilter: { gamecardId: targetId },
          destinationZone: 'UNIT'
        }, instance);
        gameState.logs.push(`[${instance.fullName}] 效果：交换了 [${targetCard.fullName}] 入场。`);
      }
    }
  }
};

const card: Card = {
  id: '10403019',
  fullName: '疾行剑使【巴特拉】',
  specialName: '巴特拉',
  type: 'UNIT',
  color: 'BLUE',
  gamecardId: null as any,
  colorReq: { 'BLUE': 1 },
  faction: '冒险家公会',
  acValue: 2,
  power: 2000,
  basePower: 2000,
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
    trigger_10403019_buff,
    activate_10403019_swap
  ],
  rarity: 'R',
  availableRarities: ['R'],
  uniqueId: null,
};

export default card;
