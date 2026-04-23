import { Card, CardEffect } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';
import { canPutUnitOntoBattlefield, createSelectCardQuery } from './_bt03YellowUtils';

const effect_205000136_substitute: CardEffect = {
  id: '205000136_substitute',
  type: 'CONTINUOUS',
  description: 'You may banish this card from your hand as a payment substitute when paying for yellow cards with AC 3 or less.'
};

const effect_205000136_activate: CardEffect = {
  id: '205000136_activate',
  type: 'ACTIVATE',
  triggerLocation: ['PLAY'],
  erosionBackLimit: [1, 10],
  description: 'Scratch 1. Main phase only. Put 1 unit from your deck onto the battlefield, deal yourself damage equal to its AC, then end this turn.',
  condition: (gameState, playerState) =>
    gameState.phase === 'MAIN' &&
    playerState.deck.some(card => card.type === 'UNIT' && canPutUnitOntoBattlefield(playerState, card)),
  execute: async (instance, gameState, playerState) => {
    const candidates = playerState.deck.filter(card => card.type === 'UNIT' && canPutUnitOntoBattlefield(playerState, card));
    createSelectCardQuery(
      gameState,
      playerState.uid,
      candidates,
      'Choose A Unit',
      'Choose 1 unit from your deck to put onto the battlefield.',
      1,
      1,
      { sourceCardId: instance.gamecardId, effectId: '205000136_activate' },
      () => 'DECK'
    );
  },
  onQueryResolve: async (instance, gameState, playerState, selections) => {
    const target = AtomicEffectExecutor.findCardById(gameState, selections[0]);
    if (!target) return;

    const damage = target.baseAcValue ?? target.acValue;
    await AtomicEffectExecutor.execute(gameState, playerState.uid, {
      type: 'MOVE_FROM_DECK',
      targetFilter: { gamecardId: target.gamecardId },
      destinationZone: 'UNIT'
    }, instance);
    await AtomicEffectExecutor.execute(gameState, playerState.uid, {
      type: 'DEAL_EFFECT_DAMAGE_SELF',
      value: damage
    }, instance);
    (playerState as any).forceEndTurnRequested = gameState.turnCount;
  }
};

const card: Card = {
  id: '205000136',
  fullName: '神灵的炼金',
  specialName: '',
  type: 'STORY',
  color: 'YELLOW',
  gamecardId: null as any,
  colorReq: { YELLOW: 2 },
  faction: '无',
  acValue: 3,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  feijingMark: false,
  canResetCount: 0,
  effects: [effect_205000136_substitute, effect_205000136_activate],
  rarity: 'C',
  availableRarities: ['C'],
  cardPackage: 'BT04',
  uniqueId: null as any,
};

export default card;
