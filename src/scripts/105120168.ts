import { Card, CardEffect, GameEvent } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';
import { EventEngine } from '../services/EventEngine';
import { createSelectCardQuery, getTopDeckCards, isAlchemyCard, isNonGodAccessLe3UnitOrItem, moveCardsToBottom } from './_bt02YellowUtils';

const effect_105120168_enter: CardEffect = {
  id: '105120168_enter',
  type: 'TRIGGER',
  triggerLocation: ['UNIT'],
  triggerEvent: 'CARD_ENTERED_ZONE',
  isMandatory: true,
  description: 'When this unit enters the battlefield, put up to 2 alchemy cards other than Elmont from your grave on the bottom of your deck, then draw 1.',
  condition: (_gameState, _playerState, instance, event?: GameEvent) =>
    instance.cardlocation === 'UNIT' &&
    event?.type === 'CARD_ENTERED_ZONE' &&
    event.sourceCardId === instance.gamecardId &&
    event.data?.zone === 'UNIT',
  execute: async (instance, gameState, playerState) => {
    const candidates = playerState.grave.filter(card => isAlchemyCard(card) && card.specialName !== '艾尔蒙特');
    if (candidates.length === 0) {
      await AtomicEffectExecutor.execute(gameState, playerState.uid, { type: 'DRAW', value: 1 }, instance);
      return;
    }

    createSelectCardQuery(
      gameState,
      playerState.uid,
      candidates,
      'Choose Grave Cards',
      'Choose up to 2 alchemy cards from your grave to place on the bottom of your deck.',
      0,
      Math.min(2, candidates.length),
      { sourceCardId: instance.gamecardId, effectId: '105120168_enter' }
    );
  },
  onQueryResolve: async (instance, gameState, playerState, selections) => {
    const cards = selections
      .map(id => AtomicEffectExecutor.findCardById(gameState, id))
      .filter((card): card is Card => !!card);
    moveCardsToBottom(gameState, playerState.uid, cards, instance);
    await AtomicEffectExecutor.execute(gameState, playerState.uid, { type: 'DRAW', value: 1 }, instance);
  }
};

const effect_105120168_activate: CardEffect = {
  id: '105120168_activate',
  type: 'ACTIVATE',
  triggerLocation: ['UNIT'],
  limitCount: 1,
  limitNameType: true,
  erosionTotalLimit: [3, 5],
  description: 'Main phase only. Discard 1 hand card, reveal the top card of your deck, and if it is a non-god unit or item with AC 3 or less, put it onto the battlefield.',
  condition: (gameState, playerState) => gameState.phase === 'MAIN' && playerState.hand.length > 0,
  execute: async (instance, gameState, playerState) => {
    createSelectCardQuery(
      gameState,
      playerState.uid,
      [...playerState.hand],
      'Discard A Card',
      'Discard 1 hand card.',
      1,
      1,
      { sourceCardId: instance.gamecardId, effectId: '105120168_activate', step: 'DISCARD' },
      () => 'HAND'
    );
  },
  onQueryResolve: async (instance, gameState, playerState, selections, context) => {
    if (context.step !== 'DISCARD') return;

    await AtomicEffectExecutor.execute(gameState, playerState.uid, {
      type: 'DISCARD_CARD',
      targetFilter: { gamecardId: selections[0] }
    }, instance);

    const topCard = getTopDeckCards(playerState, 1)[0];
    if (!topCard) return;

    EventEngine.dispatchEvent(gameState, {
      type: 'REVEAL_DECK',
      playerUid: playerState.uid,
      data: { cards: [topCard] }
    });
    gameState.logs.push(`[${instance.fullName}] 揭开了卡组顶的 [${topCard.fullName}]。`);

    if (!isNonGodAccessLe3UnitOrItem(topCard)) return;

    if (topCard.type === 'UNIT') {
      if (!playerState.unitZone.some(card => card === null)) return;
      if (topCard.specialName && playerState.unitZone.some(card => card?.specialName === topCard.specialName)) return;
    }

    if (topCard.type === 'ITEM') {
      if (topCard.specialName && playerState.itemZone.some(card => card?.specialName === topCard.specialName)) return;
    }

    await AtomicEffectExecutor.execute(gameState, playerState.uid, {
      type: 'MOVE_FROM_DECK',
      targetFilter: { gamecardId: topCard.gamecardId },
      destinationZone: topCard.type === 'UNIT' ? 'UNIT' : 'ITEM'
    }, instance);
  }
};

const card: Card = {
  id: '105120168',
  fullName: '炼金骑士「艾尔蒙特」',
  specialName: '艾尔蒙特',
  type: 'UNIT',
  color: 'YELLOW',
  gamecardId: null as any,
  colorReq: { YELLOW: 2 },
  faction: '永生之乡',
  acValue: 3,
  power: 2500,
  basePower: 2500,
  damage: 2,
  baseDamage: 2,
  godMark: true,
  displayState: 'FRONT_UPRIGHT',
  isExhausted: false,
  isrush: false,
  canAttack: true,
  feijingMark: false,
  canResetCount: 0,
  effects: [effect_105120168_enter, effect_105120168_activate],
  rarity: 'SR',
  availableRarities: ['SR'],
  cardPackage: 'BT02',
  uniqueId: null as any,
};

export default card;
