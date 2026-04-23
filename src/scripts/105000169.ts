import { Card, CardEffect, GameEvent } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';
import { createSelectCardQuery, getOpponentUid } from './_bt02YellowUtils';

const effect_105000169_trigger: CardEffect = {
  id: '105000169_trigger',
  type: 'TRIGGER',
  triggerLocation: ['UNIT'],
  triggerEvent: 'CARD_DESTROYED_BATTLE',
  limitCount: 1,
  limitNameType: true,
  description: 'When this unit is destroyed by battle, you may pay 1 with a yellow requirement. If you do, the opponent discards 1 hand card of their choice.',
  condition: (gameState, playerState, instance, event?: GameEvent) => {
    if (event?.type !== 'CARD_DESTROYED_BATTLE' || event.targetCardId !== instance.gamecardId) return false;
    const yellowUnits = playerState.unitZone.filter(card => card && card.color === 'YELLOW').length;
    const opponent = gameState.players[getOpponentUid(gameState, playerState.uid)];
    return yellowUnits >= 1 && opponent.hand.length > 0;
  },
  cost: async (gameState, playerState, instance) => {
    gameState.pendingQuery = {
      id: Math.random().toString(36).substring(7),
      type: 'SELECT_PAYMENT',
      playerUid: playerState.uid,
      options: [],
      title: 'Pay Cost',
      description: 'Pay 1 cost to resolve this trigger.',
      minSelections: 1,
      maxSelections: 1,
      callbackKey: 'ACTIVATE_COST_RESOLVE',
      paymentCost: 1,
      paymentColor: 'YELLOW',
      context: {
        sourceCardId: instance.gamecardId,
        effectIndex: 0
      }
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
      'Choose A Card To Discard',
      'Choose 1 hand card to discard.',
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
