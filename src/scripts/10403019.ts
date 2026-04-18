import { Card, GameState, PlayerState, CardEffect, GameEvent } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';

const getSwapTargets = (playerState: PlayerState, sourceCard: Card) => {
  const fieldSpecialNames = new Set(
    playerState.unitZone.filter((u): u is Card => !!u && !!u.specialName).map(u => u.specialName)
  );
  const itemSpecialNames = new Set(
    playerState.itemZone.filter((i): i is Card => !!i && !!i.specialName).map(i => i.specialName)
  );

  return playerState.erosionFront.filter((c): c is Card =>
    !!c &&
    c.displayState === 'FRONT_UPRIGHT' &&
    c.type === 'UNIT' &&
    c.faction === '冒险家公会' &&
    c.specialName !== sourceCard.specialName &&
    (!c.specialName || (!fieldSpecialNames.has(c.specialName) && !itemSpecialNames.has(c.specialName)))
  );
};

const trigger_10403019_buff: CardEffect = {
  id: '10403019_entry_buff',
  type: 'TRIGGER',
  description: '【诱发】当此卡从侵蚀位前区移动到单位区时：此卡获得+1/+1000并获得【速攻】。',
  triggerLocation: ['UNIT'],
  triggerEvent: 'CARD_EROSION_TO_FIELD',
  isMandatory: true,
  condition: (_gameState: GameState, _playerState: PlayerState, instance: Card, event?: GameEvent) => {
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
  applyContinuous: (_gameState: GameState, instance: Card) => {
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
  description: '【启】【名称一回合一次】侵蚀区数量为3-7且在你的回合时，支付1费：将此单位正面表示置入侵蚀位前区，之后选择你侵蚀位前区除「巴特拉」以外的一张正面表示的「冒险家公会」单位卡，放置在单位区。',
  limitCount: 1,
  limitNameType: true,
  triggerLocation: ['HAND'],
  erosionTotalLimit: [3, 7],
  condition: (_gameState: GameState, playerState: PlayerState, instance: Card) => {
    if (!playerState.isTurn || instance.cardlocation !== 'HAND') return false;
    return true;
  },
  execute: async (instance: Card, gameState: GameState, playerState: PlayerState) => {
    gameState.pendingQuery = {
      id: Math.random().toString(36).substring(7),
      type: 'SELECT_PAYMENT',
      playerUid: playerState.uid,
      options: [],
      title: `支付 [${instance.fullName}] 的费用`,
      description: '请支付1费以发动效果。',
      minSelections: 1,
      maxSelections: 1,
      callbackKey: 'EFFECT_RESOLVE',
      paymentCost: 1,
      paymentColor: instance.color,
      context: {
        sourceCardId: instance.gamecardId,
        effectId: '10403019_swap',
        step: 1
      }
    };
  },
  onQueryResolve: async (instance: Card, gameState: GameState, playerState: PlayerState, selections: string[], context: any) => {
    if (context.step === 1) {
      const cardInHand = playerState.hand.find(c => c.gamecardId === instance.gamecardId);
      if (!cardInHand) {
        gameState.logs.push(`[${instance.fullName}] 结算时已不在手牌，效果失败。`);
        return;
      }

      await AtomicEffectExecutor.execute(gameState, playerState.uid, {
        type: 'MOVE_FROM_HAND',
        targetFilter: { gamecardId: instance.gamecardId },
        destinationZone: 'EROSION_FRONT'
      }, instance);

      const movedSelf = playerState.erosionFront.find(c => c?.gamecardId === instance.gamecardId);
      if (movedSelf) {
        movedSelf.displayState = 'FRONT_UPRIGHT';
      }

      const targets = getSwapTargets(playerState, instance);
      if (targets.length === 0) {
        gameState.logs.push(`[${instance.fullName}] 已放置到侵蚀区，但当前没有可放置到单位区的合法「冒险家公会」单位。`);
        return;
      }

      gameState.pendingQuery = {
        id: Math.random().toString(36).substring(7),
        type: 'SELECT_CARD',
        playerUid: playerState.uid,
        options: AtomicEffectExecutor.enrichQueryOptions(
          gameState,
          playerState.uid,
          targets.map(c => ({ card: c, source: 'EROSION_FRONT' }))
        ),
        title: '选择进入单位区的单位',
        description: '请选择一张侵蚀位前区的「冒险家公会」单位放置到单位区。',
        minSelections: 1,
        maxSelections: 1,
        callbackKey: 'EFFECT_RESOLVE',
        context: {
          sourceCardId: instance.gamecardId,
          effectId: '10403019_swap',
          step: 2
        }
      };
      return;
    }

    if (context.step === 2) {
      const targetId = selections[0];
      const targetCard = playerState.erosionFront.find(c => c?.gamecardId === targetId);
      if (!targetCard) {
        gameState.logs.push(`[${instance.fullName}] 结算时目标已不合法，效果失败。`);
        return;
      }

      await AtomicEffectExecutor.execute(gameState, playerState.uid, {
        type: 'MOVE_FROM_EROSION',
        targetFilter: { gamecardId: targetId },
        destinationZone: 'UNIT'
      }, instance);
      gameState.logs.push(`[${instance.fullName}] 效果：将 [${targetCard.fullName}] 放置到了单位区。`);
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
  colorReq: { BLUE: 1 },
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
