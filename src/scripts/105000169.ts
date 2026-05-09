import { Card, CardEffect, GameEvent } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';
import { createSelectCardQuery, getOpponentUid } from './BaseUtil';

const effect_105000169_trigger: CardEffect = {
  id: '105000169_trigger',
  type: 'TRIGGER',
  triggerLocation: ['GRAVE'],
  triggerEvent: 'CARD_DESTROYED_BATTLE',
  limitCount: 1,
  limitNameType: true,
  description: '这个单位被战斗破坏时，你可以支付1点费用。若如此做，对手选择自己的1张手牌舍弃。',
  condition: (gameState, playerState, instance, event?: GameEvent) => {
    if (event?.type !== 'CARD_DESTROYED_BATTLE' || event.targetCardId !== instance.gamecardId) return false;
    const opponentUid = getOpponentUid(gameState, playerState.uid);
    return gameState.players[opponentUid].hand.length > 0;
  },
  cost: async (gameState, playerState, instance) => {
    gameState.pendingQuery = {
      id: Math.random().toString(36).substring(7),
      type: 'SELECT_PAYMENT',
      playerUid: playerState.uid,
      options: [],
      title: '支付费用',
      description: '支付1点费用以结算这个诱发效果。',
      minSelections: 1,
      maxSelections: 1,
      callbackKey: 'ACTIVATE_COST_RESOLVE',
      paymentCost: 1,
      context: {
        sourceCardId: instance.gamecardId,
        effectIndex: 0
      },
      paymentColor: 'YELLOW'
    };
    return true;
  },
  execute: async (instance, gameState, playerState) => {
    const opponentUid = getOpponentUid(gameState, playerState.uid);
    const opponent = gameState.players[opponentUid];
    if (opponent.hand.length === 0) return;

    createSelectCardQuery(
      gameState,
      opponentUid,
      [...opponent.hand],
      '选择要舍弃的卡',
      '选择1张手牌舍弃。',
      1,
      1,
      { sourceCardId: instance.gamecardId, effectId: '105000169_trigger', targetUid: opponentUid },
      () => 'HAND'
    );
  },
  onQueryResolve: async (instance, gameState, _playerState, selections, context) => {
    if (!context?.targetUid) return;
    await AtomicEffectExecutor.execute(gameState, context.targetUid, {
      type: 'DISCARD_CARD',
      targetFilter: { gamecardId: selections[0] }
    }, instance);
  }
};

const card: Card = {
  id: '105000169',
  fullName: '乞讨的少女',
  specialName: '',
  type: 'UNIT',
  color: 'YELLOW',
  gamecardId: null as any,
  colorReq: {},
  faction: '无',
  acValue: 1,
  power: 0,
  basePower: 0,
  damage: 0,
  baseDamage: 0,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  isExhausted: false,
  isrush: false,
  canAttack: true,
  feijingMark: false,
  canResetCount: 0,
  effects: [effect_105000169_trigger],
  rarity: 'C',
  availableRarities: ['C'],
  cardPackage: 'BT02',
  uniqueId: null as any,
};

export default card;
