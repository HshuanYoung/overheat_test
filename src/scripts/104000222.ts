import { Card, CardEffect, GameEvent, GameState, PlayerState } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';
import { EventEngine } from '../services/EventEngine';
import { canActivateDefaultTiming } from './BaseUtil';

const trigger_104000222_enter: CardEffect = {
  id: '104000222_enter_combat_guard',
  type: 'TRIGGER',
  triggerLocation: ['UNIT'],
  triggerEvent: 'CARD_ENTERED_ZONE',
  isMandatory: true,
  description: '【诱发】这个单位进入单位区时：直到对手回合结束时，这张卡获得如下效果：『【永续】这个单位不会被战斗破坏』。',
  condition: (_gameState: GameState, _playerState: PlayerState, instance: Card, event?: GameEvent) => {
    if (!event) return instance.cardlocation === 'UNIT';

    const isSelf = event.type === 'CARD_ENTERED_ZONE' &&
      (event.sourceCardId === instance.gamecardId || event.sourceCard === instance);
    const isTargetZone = event.data?.zone === 'UNIT';

    return isSelf && isTargetZone && instance.cardlocation === 'UNIT';
  },
  execute: async (instance: Card, gameState: GameState, playerState: PlayerState) => {
    (instance as any).data = {
      ...((instance as any).data || {}),
      combatImmuneUntilOwnNextTurnStartUid: playerState.uid,
      combatImmuneSourceName: instance.fullName
    };

    EventEngine.recalculateContinuousEffects(gameState);
    gameState.logs.push(`[${instance.fullName}] 获得了“直到对手回合结束时不会被战斗破坏”的效果。`);
  }
};

const activate_104000222_from_erosion: CardEffect = {
  id: '104000222_play_from_erosion',
  type: 'ACTIVATE',
  triggerLocation: ['EROSION_FRONT'],
  limitCount: 1,
  limitNameType: true,
  description: '【启动】【卡名一回合一次】这张卡在侵蚀区正面时，支付3费，舍弃手牌1张带有菲晶的卡：将这张卡放置到战场上。',
  condition: (gameState: GameState, playerState: PlayerState, instance: Card) => {
    if (instance.cardlocation !== 'EROSION_FRONT' || instance.displayState !== 'FRONT_UPRIGHT') return false;
    if (!playerState.unitZone.some(u => u === null)) return false;
    if (!canActivateDefaultTiming(gameState, playerState)) return false;

    return playerState.hand.some(card => card.feijingMark);
  },
  execute: async (instance: Card, gameState: GameState, playerState: PlayerState) => {
    const feijingCards = playerState.hand.filter(card => card.feijingMark);

    if (feijingCards.length === 0) {
      gameState.logs.push(`[${instance.fullName}] 手牌中没有可舍弃的菲晶卡。`);
      return;
    }

    gameState.pendingQuery = {
      id: Math.random().toString(36).substring(7),
      type: 'SELECT_CARD',
      playerUid: playerState.uid,
      options: AtomicEffectExecutor.enrichQueryOptions(
        gameState,
        playerState.uid,
        feijingCards.map(card => ({ card, source: 'HAND' as any }))
      ),
      title: '选择要舍弃的菲晶卡',
      description: '请选择1张带有菲晶的手牌舍弃，随后支付3费并将这张卡放置到战场上。',
      minSelections: 1,
      maxSelections: 1,
      callbackKey: 'EFFECT_RESOLVE',
      context: {
        sourceCardId: instance.gamecardId,
        effectIndex: 1,
        step: 'DISCARD_FEIJING'
      }
    };
  },
  onQueryResolve: async (instance: Card, gameState: GameState, playerState: PlayerState, selections: string[], context: any) => {
    if (context.step === 'DISCARD_FEIJING') {
      const discardId = selections[0];
      const target = playerState.hand.find(card => card.gamecardId === discardId && card.feijingMark);

      if (!target) {
        gameState.logs.push(`[${instance.fullName}] 选择的菲晶手牌已不合法，效果中止。`);
        return;
      }

      await AtomicEffectExecutor.execute(gameState, playerState.uid, {
        type: 'DISCARD_CARD',
        targetFilter: { gamecardId: discardId }
      }, instance);

      gameState.pendingQuery = {
        id: Math.random().toString(36).substring(7),
        type: 'SELECT_PAYMENT',
        playerUid: playerState.uid,
        options: [],
        title: `支付 [${instance.fullName}] 的费用`,
        description: '请支付3点费用以将这张卡从侵蚀区放置到战场上。',
        minSelections: 1,
        maxSelections: 1,
        callbackKey: 'EFFECT_RESOLVE',
        paymentCost: 3,
        paymentColor: instance.color,
        context: {
          sourceCardId: instance.gamecardId,
          effectIndex: 1,
          step: 'PAYMENT'
        }
      };
      return;
    }

    if (context.step === 'PAYMENT') {
      if (!playerState.unitZone.some(u => u === null)) {
        gameState.logs.push(`[${instance.fullName}] 单位区已满，无法放置到战场上。`);
        return;
      }

      await AtomicEffectExecutor.execute(gameState, playerState.uid, {
        type: 'MOVE_FROM_EROSION',
        targetFilter: { gamecardId: instance.gamecardId },
        destinationZone: 'UNIT'
      }, instance);

      const moved = AtomicEffectExecutor.findCardById(gameState, instance.gamecardId);
      if (moved && moved.cardlocation === 'UNIT') {
        moved.displayState = 'FRONT_UPRIGHT';
        moved.isExhausted = false;
        moved.playedTurn = gameState.turnCount;
      }

      EventEngine.recalculateContinuousEffects(gameState);
      gameState.logs.push(`[${instance.fullName}] 从侵蚀区进入了战场。`);
    }
  }
};

const card: Card = {
  id: '104000222',
  gamecardId: null as any,
  fullName: '阴影盾卫',
  specialName: '',
  type: 'UNIT',
  color: 'BLUE',
  colorReq: { 'BLUE': 1 },
  faction: '冒险家公会',
  acValue: 3,
  power: 2500,
  basePower: 2500,
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
    trigger_104000222_enter,
    activate_104000222_from_erosion
  ],
  rarity: 'U',
  availableRarities: ['U'],
  cardPackage: 'BT05',
  uniqueId: null,
};

export default card;
