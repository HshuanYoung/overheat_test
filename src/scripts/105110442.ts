import { Card, CardEffect, GameEvent } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';
import { createSelectCardQuery, getOnlyGodMarkUnit, getTopDeckCards } from './BaseUtil';
import { wasPlayedFromHand } from './BaseUtil';

const effect_105110442_continuous: CardEffect = {
  id: '105110442_continuous',
  type: 'CONTINUOUS',
  description: 'If you control only 1 god-mark unit and its AC is 5 or more, that unit gets +1 damage and +500 power.',
  applyContinuous: (_gameState, instance) => {
    const ownerUid = AtomicEffectExecutor.findCardOwnerKey(_gameState, instance.gamecardId);
    if (!ownerUid) return;
    const loneGodmark = getOnlyGodMarkUnit(_gameState.players[ownerUid]);
    if (!loneGodmark) return;
    if ((loneGodmark.baseAcValue ?? loneGodmark.acValue) < 5) return;

    loneGodmark.power = (loneGodmark.power || 0) + 500;
    loneGodmark.damage = (loneGodmark.damage || 0) + 1;
  }
};

const effect_105110442_enter: CardEffect = {
  id: '105110442_enter',
  type: 'TRIGGER',
  triggerLocation: ['UNIT'],
  triggerEvent: 'CARD_ENTERED_ZONE',
  isMandatory: true,
  description: 'When this unit enters the battlefield from hand, if you control only 1 god-mark unit, look at the top 3 cards of your deck and add 1 to your hand, then shuffle.',
  condition: (_gameState, playerState, instance, event?: GameEvent) =>
    instance.cardlocation === 'UNIT' &&
    event?.type === 'CARD_ENTERED_ZONE' &&
    event.sourceCardId === instance.gamecardId &&
    event.data?.zone === 'UNIT' &&
    wasPlayedFromHand(instance) &&
    getOnlyGodMarkUnit(playerState)?.gamecardId === instance.gamecardId,
  execute: async (instance, gameState, playerState) => {
    const topCards = getTopDeckCards(playerState, 3);
    if (topCards.length === 0) return;

    createSelectCardQuery(
      gameState,
      playerState.uid,
      topCards,
      'Choose A Card',
      'Choose 1 of the top 3 cards of your deck to add to your hand.',
      1,
      1,
      { sourceCardId: instance.gamecardId, effectId: '105110442_enter' },
      () => 'DECK'
    );
  },
  onQueryResolve: async (instance, gameState, playerState, selections) => {
    await AtomicEffectExecutor.execute(gameState, playerState.uid, {
      type: 'MOVE_FROM_DECK',
      targetFilter: { gamecardId: selections[0] },
      destinationZone: 'HAND'
    }, instance);
    await AtomicEffectExecutor.execute(gameState, playerState.uid, { type: 'SHUFFLE_DECK' }, instance);
  }
};

const card: Card = {
  id: '105110442',
  fullName: '水晶占卜师「史黛拉」',
  specialName: '史黛拉',
  type: 'UNIT',
  color: 'YELLOW',
  gamecardId: null as any,
  colorReq: { YELLOW: 1 },
  faction: '学院要塞',
  acValue: 2,
  power: 1000,
  basePower: 1000,
  damage: 1,
  baseDamage: 1,
  godMark: true,
  displayState: 'FRONT_UPRIGHT',
  isExhausted: false,
  isrush: false,
  baseIsrush: false,
  canAttack: true,
  feijingMark: false,
  canResetCount: 0,
  effects: [effect_105110442_continuous, effect_105110442_enter],
  rarity: 'SR',
  availableRarities: ['SR'],
  cardPackage: 'BT04',
  uniqueId: null as any,
};

export default card;
