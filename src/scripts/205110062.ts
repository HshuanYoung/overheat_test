import { Card, CardEffect } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';
import { createSelectCardQuery, isTruthOrHickUnit, moveCard } from './_bt02YellowUtils';

const effect_205110062_activate: CardEffect = {
  id: '205110062_activate',
  type: 'ACTIVATE',
  triggerLocation: ['PLAY'],
  description: 'Choose 1 god-mark card on your battlefield and put it on the bottom of your deck. Then choose 1 Truth or Hick unit from your deck and put it onto the battlefield.',
  condition: (_gameState, playerState) =>
    [...playerState.unitZone, ...playerState.itemZone].some(card => card?.godMark) &&
    playerState.deck.some(isTruthOrHickUnit),
  execute: async (instance, gameState, playerState) => {
    const ownGodMarks = [...playerState.unitZone, ...playerState.itemZone].filter((card): card is Card => !!card && !!card.godMark);
    createSelectCardQuery(
      gameState,
      playerState.uid,
      ownGodMarks,
      'Choose A God-Mark Card',
      'Choose 1 allied god-mark card.',
      1,
      1,
      { sourceCardId: instance.gamecardId, effectId: '205110062_activate', step: 'BOTTOM_GODMARK' }
    );
  },
  onQueryResolve: async (instance, gameState, playerState, selections, context) => {
    if (context.step === 'BOTTOM_GODMARK') {
      const target = AtomicEffectExecutor.findCardById(gameState, selections[0]);
      if (!target) return;

      moveCard(gameState, playerState.uid, target, 'DECK', instance, { insertAtBottom: true });

      const candidates = playerState.deck.filter(card =>
        isTruthOrHickUnit(card) &&
        (!card.specialName || !playerState.unitZone.some(unit => unit?.specialName === card.specialName))
      );
      if (candidates.length === 0 || !playerState.unitZone.some(card => card === null)) return;

      createSelectCardQuery(
        gameState,
        playerState.uid,
        candidates,
        'Choose A Unit',
        'Choose 1 Truth or Hick unit from your deck.',
        1,
        1,
        { sourceCardId: instance.gamecardId, effectId: '205110062_activate', step: 'PUT_UNIT' },
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

const card: Card = {
  id: '205110062',
  fullName: '与教会的交涉',
  specialName: '',
  type: 'STORY',
  color: 'YELLOW',
  gamecardId: null as any,
  colorReq: { YELLOW: 1 },
  faction: '学院要塞',
  acValue: 2,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  feijingMark: false,
  canResetCount: 0,
  effects: [effect_205110062_activate],
  rarity: 'U',
  availableRarities: ['U'],
  cardPackage: 'BT02',
  uniqueId: null as any,
};

export default card;
