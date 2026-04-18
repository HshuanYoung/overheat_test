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
  execute: async (instance: Card, gameState: GameState) => {
    (instance as any).data = {
      ...((instance as any).data || {}),
      erosionEntryBuffActive: true
    };

    gameState.logs.push(`[${instance.fullName}] 触发：从侵蚀区登场，获得+1/+1000与【速攻】。`);
  }
};

const continuous_10403019_buff: CardEffect = {
  id: '10403019_entry_buff_continuous',
  type: 'CONTINUOUS',
  description: '此卡若曾从侵蚀区进入单位区，则在场上持续获得+1/+1000与【速攻】。',
  applyContinuous: (gameState: GameState, instance: Card) => {
    if (instance.cardlocation !== 'UNIT' || !(instance as any).data?.erosionEntryBuffActive) {
      return;
    }

    instance.power = (instance.power || 0) + 1000;
    instance.damage = (instance.damage || 0) + 1;
    instance.isrush = true;

    if (!instance.influencingEffects) instance.influencingEffects = [];
    instance.influencingEffects.push({
      sourceCardName: instance.fullName,
      description: '从侵蚀区登场：+1/+1000，获得【速攻】'
    });
  }
};

const activate_10403019_swap: CardEffect = {
  id: '10403019_swap',
  type: 'ACTIVATE',
  description: '【启】[名称一回合一次] 侵蚀区数量为3-7张、且在你的回合时，支付1费：将此单位正面表示置入侵蚀位前区，之后选择你侵蚀位前区除「巴特拉」以外的一张正面表示的「冒险家公会」单位卡，放置在单位区。',
  limitCount: 1,
  limitNameType: true,
  triggerLocation: ['HAND'],
  erosionTotalLimit: [3, 7],
  condition: (gameState: GameState, playerState: PlayerState) => {
    return playerState.isTurn;
  },
  cost: async (gameState: GameState, playerState: PlayerState, instance: Card) => {
    if (instance.cardlocation !== 'HAND') return false;

    const available = playerState.erosionFront.filter(c => c !== null);
    if (available.length < 1) return false;

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

    return true;
  },
  execute: async (instance: Card, gameState: GameState, playerState: PlayerState) => {
    await AtomicEffectExecutor.execute(gameState, playerState.uid, {
      type: 'MOVE_FROM_HAND',
      targetFilter: { gamecardId: instance.gamecardId },
      destinationZone: 'EROSION_FRONT'
    }, instance);
    instance.displayState = 'FRONT_UPRIGHT';

    const fieldSpecialNames = new Set(playerState.unitZone.filter(u => u && u.specialName).map(u => u!.specialName));
    const itemSpecialNames = new Set(playerState.itemZone.filter(i => i && i.specialName).map(i => i!.specialName));

    const erosionChoices = playerState.erosionFront.filter(c =>
      c &&
      c.displayState === 'FRONT_UPRIGHT' &&
      c.type === 'UNIT' &&
      c.faction === '冒险家公会' &&
      !c.fullName.includes('巴特拉') &&
      (!c.specialName || (!fieldSpecialNames.has(c.specialName) && !itemSpecialNames.has(c.specialName)))
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
          effectId: '10403019_swap',
          step: 'SWAP_IN'
        }
      };
    } else {
      gameState.logs.push(`[${instance.fullName}] 侵蚀区没有符合条件的「冒险家公会」单位。`);
    }
  },
  onQueryResolve: async (instance: Card, gameState: GameState, playerState: PlayerState, selections: string[], context: any) => {
    if (context.step === 'SWAP_IN') {
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
    activate_10403019_swap,
    continuous_10403019_buff
  ],
  rarity: 'R',
  availableRarities: ['R'],
  uniqueId: null,
};

export default card;
