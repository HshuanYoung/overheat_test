import { Card, CardEffect } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';
import { EventEngine } from '../services/EventEngine';
import { createSelectCardQuery, isAlchemyCard, moveCardsToBottom } from './_bt02YellowUtils';

const effect_105120167_activate: CardEffect = {
  id: '105120167_activate',
  type: 'ACTIVATE',
  triggerLocation: ['UNIT'],
  limitCount: 1,
  limitNameType: true,
  description: 'Exhaust this unit, send 2 other allied battlefield cards to grave, then put an alchemy unit from your deck onto the battlefield.',
  condition: (_gameState, playerState, instance) => {
    const ownField = [...playerState.unitZone, ...playerState.itemZone].filter(
      (card): card is Card => !!card && card.gamecardId !== instance.gamecardId
    );
    return !instance.isExhausted && ownField.length >= 2 && playerState.deck.some(card => card.type === 'UNIT' && isAlchemyCard(card));
  },
  execute: async (instance, gameState, playerState) => {
    await AtomicEffectExecutor.execute(gameState, playerState.uid, {
      type: 'ROTATE_HORIZONTAL',
      targetFilter: { gamecardId: instance.gamecardId }
    }, instance);

    const ownField = [...playerState.unitZone, ...playerState.itemZone].filter(
      (card): card is Card => !!card && card.gamecardId !== instance.gamecardId
    );
    createSelectCardQuery(
      gameState,
      playerState.uid,
      ownField,
      'Choose 2 Cards',
      'Send 2 other allied battlefield cards to grave.',
      2,
      2,
      { sourceCardId: instance.gamecardId, effectId: '105120167_activate', step: 'SEND_FIELD' }
    );
  },
  onQueryResolve: async (instance, gameState, playerState, selections, context) => {
    if (context.step === 'SEND_FIELD') {
      for (const selectedId of selections) {
        const target = AtomicEffectExecutor.findCardById(gameState, selectedId);
        const ownerUid = target ? AtomicEffectExecutor.findCardOwnerKey(gameState, target.gamecardId) : undefined;
        if (target && ownerUid) {
          AtomicEffectExecutor.moveCard(gameState, ownerUid, target.cardlocation as any, ownerUid, 'GRAVE', target.gamecardId, true, {
            effectSourcePlayerUid: playerState.uid,
            effectSourceCardId: instance.gamecardId
          });
        }
      }

      const candidates = playerState.deck.filter(card => card.type === 'UNIT' && isAlchemyCard(card));
      if (candidates.length === 0) return;

      createSelectCardQuery(
        gameState,
        playerState.uid,
        candidates,
        'Choose A Unit',
        'Choose 1 alchemy unit from your deck.',
        1,
        1,
        { sourceCardId: instance.gamecardId, effectId: '105120167_activate', step: 'PUT_UNIT' },
        () => 'DECK'
      );
      return;
    }

    if (context.step === 'PUT_UNIT') {
      await AtomicEffectExecutor.execute(gameState, playerState.uid, {
        type: 'MOVE_FROM_DECK',
        targetFilter: { gamecardId: selections[0] },
        destinationZone: 'UNIT'
      }, instance);
    }
  }
};

const effect_105120167_last_resort: CardEffect = {
  id: '105120167_last_resort',
  type: 'ACTIVATE',
  triggerLocation: ['UNIT'],
  limitCount: 1,
  limitGlobal: true,
  limitNameType: true,
  erosionTotalLimit: [10, 20],
  description: 'Goddess mode only. Put all cards in your grave on the bottom of your deck. You lose the game at end of turn.',
  condition: (_gameState, playerState) => !!playerState.isGoddessMode,
  execute: async (instance, gameState, playerState) => {
    const graveCards = [...playerState.grave];
    moveCardsToBottom(gameState, playerState.uid, graveCards, instance);
    (playerState as any).loseAtEndOfTurn = gameState.turnCount;
    (playerState as any).loseAtEndOfTurnSourceName = instance.fullName;
    EventEngine.recalculateContinuousEffects(gameState);
  }
};

const card: Card = {
  id: '105120167',
  fullName: '大炼金术士「伊丽瑟薇」',
  specialName: '伊丽瑟薇',
  type: 'UNIT',
  color: 'YELLOW',
  gamecardId: null as any,
  colorReq: { YELLOW: 2 },
  faction: '永生之乡',
  acValue: 3,
  power: 2000,
  basePower: 2000,
  damage: 1,
  baseDamage: 1,
  godMark: true,
  displayState: 'FRONT_UPRIGHT',
  isExhausted: false,
  isrush: false,
  canAttack: true,
  feijingMark: false,
  canResetCount: 0,
  effects: [effect_105120167_activate, effect_105120167_last_resort],
  rarity: 'SR',
  availableRarities: ['SR', 'SER'],
  cardPackage: 'BT02',
  uniqueId: null as any,
};

export default card;
