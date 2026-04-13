import { Card, GameState, PlayerState, CardEffect } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';

const activate_30402007: CardEffect = {
  id: '30402007_activate',
  type: 'ACTIVATE',
  description: '【名1】卡名每回合限一次。将此卡转为横置状态，支付1费用：选择一名玩家，该玩家抽一张牌。之后，该玩家选择一张手牌，并将其放置在侵蚀前区。',
  limitCount: 1,
  limitNameType: true,
  condition: (gameState: GameState, playerState: PlayerState, instance: Card) => {
    return !instance.isExhausted;
  },
  execute: (instance: Card, gameState: GameState, playerState: PlayerState) => {
    // 1. Cost: Payment loop
    gameState.pendingQuery = {
      id: Math.random().toString(36).substring(7),
      type: 'SELECT_PAYMENT',
      playerUid: playerState.uid,
      options: [],
      title: '支付费用：交易术天秤',
      description: '请支付 1 点费用以发动效果。',
      minSelections: 1,
      maxSelections: 1,
      callbackKey: 'EFFECT_RESOLVE',
      paymentCost: 1,
      paymentColor: instance.color,
      context: {
        sourceCardId: instance.gamecardId,
        effectId: '30402007_activate',
        step: 'PICK_PLAYER'
      }
    };
  },
  onQueryResolve: (instance: Card, gameState: GameState, playerState: PlayerState, selections: string[], context: any) => {
    if (context.step === 'PICK_PLAYER') {
      // After payment, exhaust the card
      instance.isExhausted = true;
      instance.displayState = 'FRONT_HORIZONTAL';

      // Select target player
      const options: any[] = Object.values(gameState.players).map(p => {
        const isMe = p.uid === playerState.uid;
        return {
          card: {
            gamecardId: isMe ? 'PLAYER_SELF' : 'PLAYER_OPPONENT',
            id: isMe ? 'PLAYER_SELF' : 'PLAYER_OPPONENT',
            fullName: isMe ? '我方玩家' : '对手玩家',
            type: 'UNIT',
            color: 'NONE',
            rarity: 'C'
          },
          source: 'HAND' as any
        };
      });

      gameState.pendingQuery = {
        id: Math.random().toString(36).substring(7),
        type: 'SELECT_CARD',
        playerUid: playerState.uid,
        options: options,
        title: '选择执行效果的玩家',
        description: '请选择一名玩家进行抽牌与充能。',
        minSelections: 1,
        maxSelections: 1,
        callbackKey: 'EFFECT_RESOLVE',
        context: {
          ...context,
          step: 'EXECUTE_EFFECT'
        }
      };
    } else if (context.step === 'EXECUTE_EFFECT') {
      const selectedGamecardId = selections[0];
      const targetUid = selectedGamecardId === 'PLAYER_SELF' ? playerState.uid : Object.keys(gameState.players).find(uid => uid !== playerState.uid)!;
      const targetPlayer = gameState.players[targetUid];

      gameState.logs.push(`[${instance.fullName}] 选择了玩家 ${targetPlayer.displayName} 执行效果。`);

      // Target Player: Draw 1
      AtomicEffectExecutor.execute(gameState, targetUid, {
          type: 'DRAW',
          value: 1
      }, instance);

      // Target Player: Select Hand to Erosion
      if (targetPlayer.hand.length > 0) {
        gameState.pendingQuery = {
          id: Math.random().toString(36).substring(7),
          type: 'SELECT_CARD',
          playerUid: targetUid, // Target player chooses their own hand
          options: targetPlayer.hand.map(c => ({ card: c, source: 'HAND' as any })),
          title: '选择手牌充能',
          description: '请选择一张手牌放置在侵蚀前区。',
          minSelections: 1,
          maxSelections: 1,
          callbackKey: 'EFFECT_RESOLVE',
          context: {
            ...context,
            targetUid,
            step: 'FINALIZE_RECHARGE'
          }
        };
      }
    } else if (context.step === 'FINALIZE_RECHARGE') {
      const targetUid = context.targetUid;
      const cardId = selections[0];
      const targetPlayer = gameState.players[targetUid];
      const RechargeCard = targetPlayer.hand.find(c => c.gamecardId === cardId);

      if (RechargeCard) {
        AtomicEffectExecutor.execute(gameState, targetUid, {
          type: 'MOVE_FROM_HAND',
          targetFilter: { gamecardId: cardId },
          destinationZone: 'EROSION_FRONT'
        }, instance);

        // Face up
        const cardInErosion = targetPlayer.erosionFront.find(c => c?.gamecardId === cardId);
        if (cardInErosion) cardInErosion.displayState = 'FRONT_UPRIGHT';

        gameState.logs.push(`[${instance.fullName}] 效果：${targetPlayer.displayName} 将 [${RechargeCard.fullName}] 进行了充能。`);
      }
    }
  }
};

const card: Card = {
  id: '30402007',
  fullName: '交易术天秤',
  specialName: '',
  type: 'ITEM',
  color: 'BLUE',
  gamecardId: null as any,
  colorReq: { BLUE: 1 },
  faction: '九尾商会联盟',
  acValue: 0,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  feijingMark: false,
  canResetCount: 0,
  effects: [activate_30402007],
  rarity: 'R',
  availableRarities: ['R'],
  uniqueId: null,
};

export default card;
