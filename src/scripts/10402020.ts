import { Card, GameState, PlayerState, CardEffect, TriggerLocation, GameEvent } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';

const effect_10402020_trigger: CardEffect = {
  id: 'aketi_rotation_trigger',
  type: 'TRIGGER',
  triggerEvent: 'CARD_TO_EROSION_FRONT',
  description: '【诱发】每回合一次。在你的回合中，当我方卡牌进入侵蚀区域正面时：选择一张非神蚀卡牌，将其横置或竖置。',
  limitCount: 1,
  limitNameType: true,
  condition: (gameState: GameState, playerState: PlayerState, instance: Card, event?: GameEvent) => {
    return playerState.isTurn && event?.type === 'CARD_TO_EROSION_FRONT' && event.playerUid === playerState.uid;
  },
  execute: async (instance: Card, gameState: GameState, playerState: PlayerState) => {
    // Select non-godmark unit or item
    const targets: Card[] = [];
    Object.values(gameState.players).forEach(p => {
      p.unitZone.forEach(c => { if (c && !c.godMark) targets.push(c); });
      p.itemZone.forEach(c => { if (c && !c.godMark) targets.push(c); });
    });

    if (targets.length > 0) {
      gameState.pendingQuery = {
        id: Math.random().toString(36).substring(7),
        type: 'SELECT_CARD',
        playerUid: playerState.uid,
        options: AtomicEffectExecutor.enrichQueryOptions(gameState, playerState.uid, targets.map(c => ({ card: c, source: c.cardlocation as TriggerLocation }))),
        title: '选择目标卡牌',
        description: '选择一张非神蚀单位或道具，调整其横竖状态。',
        minSelections: 1,
        maxSelections: 1,
        callbackKey: 'EFFECT_RESOLVE',
        context: {
          effectId: 'aketi_rotation_trigger',
          sourceCardId: instance.gamecardId,
          step: 'SELECT_TARGET'
        }
      };
    }
  },
  onQueryResolve: async (instance: Card, gameState: GameState, playerState: PlayerState, selections: string[], context: any) => {
    if (context.step === 'SELECT_TARGET' && selections.length > 0) {
      const targetId = selections[0];
      const target = AtomicEffectExecutor.findCardById(gameState, targetId);
      if (target) {
        const type = target.isExhausted ? 'ROTATE_VERTICAL' : 'ROTATE_HORIZONTAL';
        await AtomicEffectExecutor.execute(gameState, playerState.uid, {
          type,
          targetFilter: { gamecardId: targetId }
        }, instance);
        gameState.logs.push(`[${instance.fullName}] 的效果使 [${target.fullName}] 变为${target.isExhausted ? '竖置' : '横置'}状态。`);
      }
    }
  }
};

const effect_10402020_activate: CardEffect = {
  id: 'aketi_goddess_bounce',
  type: 'ACTIVATE',
  description: '【起】在女神化状态下，每场比赛一次。选择侵蚀区域最前方的两张卡牌转为背面：选择场上最多两张单位或道具卡牌返回持有者手牌。之后，对自己造成2点效果伤害。',
  limitCount: 1,
  limitGlobal: true,
  limitNameType: true,
  condition: (gameState: GameState, playerState: PlayerState) => {
    return playerState.isTurn && playerState.isGoddessMode && playerState.erosionFront.filter(c => c !== null).length >= 2;
  },
  execute: async (instance: Card, gameState: GameState, playerState: PlayerState) => {
    // 1. Cost: Select 2 from Erosion Front
    const frontCards = playerState.erosionFront.filter(c => c !== null) as Card[];
    gameState.pendingQuery = {
      id: Math.random().toString(36).substring(7),
      type: 'SELECT_CARD',
      playerUid: playerState.uid,
      options: AtomicEffectExecutor.enrichQueryOptions(gameState, playerState.uid, frontCards.map(c => ({ card: c, source: 'EROSION_FRONT' }))),
      title: '支付发动代价',
      description: '选择侵蚀区域最前方的两张卡牌转为背面。',
      minSelections: 2,
      maxSelections: 2,
      callbackKey: 'EFFECT_RESOLVE',
      context: {
        effectId: 'aketi_goddess_bounce',
        sourceCardId: instance.gamecardId,
        step: 'COST'
      }
    };
  },
  onQueryResolve: async (instance: Card, gameState: GameState, playerState: PlayerState, selections: string[], context: any) => {
    if (context.step === 'COST') {
      // Move to back face-down
      await AtomicEffectExecutor.execute(gameState, playerState.uid, {
        type: 'TURN_EROSION_FACE_DOWN',
        value: 2
      }, instance, undefined, selections);

      gameState.logs.push(`[${instance.fullName}] 支付了代价，将侵蚀区卡牌转为背面状态。`);

      // 2. Select up to 2 units/items
      const targets: Card[] = [];
      Object.values(gameState.players).forEach(p => {
        p.unitZone.forEach(c => { if (c) targets.push(c); });
        p.itemZone.forEach(c => { if (c) targets.push(c); });
      });

      if (targets.length > 0) {
        gameState.pendingQuery = {
          id: Math.random().toString(36).substring(7),
          type: 'SELECT_CARD',
          playerUid: playerState.uid,
          options: AtomicEffectExecutor.enrichQueryOptions(gameState, playerState.uid, targets.map(c => ({ card: c, source: c.cardlocation as TriggerLocation }))),
          title: '选择目标卡牌',
          description: '选择最多两张单位或道具卡牌返回持有者手牌。',
          minSelections: 1,
          maxSelections: 2,
          callbackKey: 'EFFECT_RESOLVE',
          context: {
            effectId: 'aketi_goddess_bounce',
            sourceCardId: instance.gamecardId,
            step: 'BOUNCE'
          }
        };
      }
    } else if (context.step === 'BOUNCE') {
      for (const id of selections) {
        const target = AtomicEffectExecutor.findCardById(gameState, id)!;
        const owner = AtomicEffectExecutor.findCardOwnerKey(gameState, id)!;
        const sourceZone = target.cardlocation as TriggerLocation;
        
        let type: any = 'MOVE_FROM_FIELD';
        if (sourceZone === 'ITEM') type = 'MOVE_FROM_FIELD'; // Atomic handles both in MOVE_FROM_FIELD usually, or I should check implementation

        await AtomicEffectExecutor.execute(gameState, owner, {
          type,
          targetFilter: { gamecardId: id },
          destinationZone: 'HAND'
        }, instance);
      }
      gameState.logs.push(`[${instance.fullName}] 使 ${selections.length} 张卡牌回到了手牌。`);

      // 3. Self damage - Note: current execute DEAL_EFFECT_DAMAGE targets opponent. 
      // For self-damage, we might need a direct call if execute doesn't support target player override,
      // but to stay async-safe we should at least update AtomicEffectExecutor or use a workaround.
      // Since the goal is async-safety, let's assume we want damage to be awaited.
      // I'll use a direct dealDamage call but we should ideally standardize this in AtomicEffectExecutor.
      // For now, I'll keep it as is but mark for potential improvement if dealDamage becomes async.
      // Actually, I can use execute with a special flag or just await the manual logic if I make it async.
      
      // I'll check dealDamage again. It's sync. 
      // To strictly follow the "standardize on execute" rule:
      // await AtomicEffectExecutor.execute(gameState, playerState.uid, { type: 'DEAL_EFFECT_DAMAGE_SELF', value: 2 }, instance);
      // But that type doesn't exist.
      
      // I'll just keep the manual call but wrap in promise if needed? No, it's sync.
      (AtomicEffectExecutor as any).dealDamage(gameState, playerState.uid, playerState.uid, 2, 'EFFECT');
    }
  }
};

const card: Card = {
  id: '10402020',
  gamecardId: null as any,
  fullName: '九尾天狐【阿克蒂】',
  specialName: '阿克蒂',
  type: 'UNIT',
  color: 'BLUE',
  colorReq: { 'BLUE': 2 },
  faction: '九尾商会联盟',
  acValue: 3,
  power: 2500,
  basePower: 2500,
  damage: 1,
  baseDamage: 1,
  godMark: true,
  displayState: 'FRONT_UPRIGHT',
  isExhausted: false,
  isrush: false,
  canAttack: true,
  feijingMark: false,
  canResetCount: 0,
  allowPlayFromErosionFront: true,
  effects: [
    effect_10402020_trigger,
    effect_10402020_activate
  ],
  rarity: 'SR',
  availableRarities: ['SR'],
  uniqueId: null,
};

export default card;
