import { Card, CardEffect } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';
import { createChoiceQuery, createSelectCardQuery, findUnitOnBattlefield, moveCard, revealDeckCards, universalEquipEffect } from './_bt03YellowUtils';

const effect_305000080_activate: CardEffect = {
  id: '305000080_activate',
  type: 'ACTIVATE',
  triggerLocation: ['ITEM'],
  description: 'Exhaust the equipped unit: reveal the top card of your deck. You may add it to your hand, then put 1 hand card on the bottom of your deck.',
  condition: (gameState, playerState, instance) => {
    const target = findUnitOnBattlefield(gameState, instance.equipTargetId);
    return instance.cardlocation === 'ITEM' && !!target && !target.isExhausted && playerState.deck.length > 0;
  },
  execute: async (instance, gameState, playerState) => {
    const target = findUnitOnBattlefield(gameState, instance.equipTargetId);
    if (!target) {
      instance.equipTargetId = undefined;
      return;
    }

    await AtomicEffectExecutor.execute(gameState, playerState.uid, {
      type: 'ROTATE_HORIZONTAL',
      targetFilter: { gamecardId: target.gamecardId }
    }, instance);

    const topCard = revealDeckCards(gameState, playerState.uid, 1)[0];
    if (!topCard) return;

    createChoiceQuery(
      gameState,
      playerState.uid,
      'Add The Revealed Card?',
      `Reveal ${topCard.fullName}. You may add it to your hand.`,
      [
        { id: 'YES', label: 'Add To Hand' },
        { id: 'NO', label: 'Leave It There' }
      ],
      {
        sourceCardId: instance.gamecardId,
        effectId: '305000080_activate',
        step: 'CHOOSE_ADD',
        revealedCardId: topCard.gamecardId
      }
    );
  },
  onQueryResolve: async (instance, gameState, playerState, selections, context) => {
    if (context.step === 'CHOOSE_ADD') {
      if (selections[0] !== 'YES') return;

      await AtomicEffectExecutor.execute(gameState, playerState.uid, {
        type: 'MOVE_FROM_DECK',
        targetFilter: { gamecardId: context.revealedCardId },
        destinationZone: 'HAND'
      }, instance);

      createSelectCardQuery(
        gameState,
        playerState.uid,
        [...playerState.hand],
        'Choose A Hand Card',
        'Choose 1 hand card to place on the bottom of your deck.',
        1,
        1,
        {
          sourceCardId: instance.gamecardId,
          effectId: '305000080_activate',
          step: 'PUT_TO_BOTTOM'
        },
        () => 'HAND'
      );
      return;
    }

    if (context.step !== 'PUT_TO_BOTTOM') return;

    const chosenCard = AtomicEffectExecutor.findCardById(gameState, selections[0]);
    if (!chosenCard) return;

    moveCard(gameState, playerState.uid, chosenCard, 'DECK', instance, { insertAtBottom: true });
  }
};

const card: Card = {
  id: '305000080',
  fullName: '索美琳童话集',
  specialName: '',
  type: 'ITEM',
  isEquip: true,
  color: 'YELLOW',
  gamecardId: null as any,
  colorReq: { YELLOW: 1 },
  faction: '无',
  acValue: 2,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  feijingMark: false,
  canResetCount: 0,
  effects: [universalEquipEffect, effect_305000080_activate],
  rarity: 'C',
  availableRarities: ['C'],
  cardPackage: 'BT03',
  uniqueId: null as any,
};

export default card;
