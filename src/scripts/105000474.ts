import { Card, CardEffect, GameEvent } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';
import { createChoiceQuery, getOpponentUid, isVirtualGodMarkReveal, shuffleAndRevealTopCards } from './_bt03YellowUtils';

const effect_105000474_enter: CardEffect = {
  id: '105000474_enter',
  type: 'TRIGGER',
  triggerLocation: ['UNIT'],
  triggerEvent: 'CARD_ENTERED_ZONE',
  limitCount: 1,
  limitNameType: true,
  isMandatory: true,
  description: 'When this unit enters the battlefield, shuffle your deck and reveal the top card. If it is a god-mark card, choose a player and discard a random card from that player hand.',
  condition: (_gameState, _playerState, instance, event?: GameEvent) =>
    instance.cardlocation === 'UNIT' &&
    event?.type === 'CARD_ENTERED_ZONE' &&
    event.sourceCardId === instance.gamecardId &&
    event.data?.zone === 'UNIT',
  execute: async (instance, gameState, playerState) => {
    const revealedCard = (await shuffleAndRevealTopCards(gameState, playerState.uid, 1, instance))[0];
    if (!isVirtualGodMarkReveal(gameState, revealedCard)) return;

    createChoiceQuery(
      gameState,
      playerState.uid,
      'Choose A Player',
      'Choose a player to discard a random hand card.',
      [
        { id: playerState.uid, label: 'Yourself' },
        { id: getOpponentUid(gameState, playerState.uid), label: 'Opponent' }
      ],
      { sourceCardId: instance.gamecardId, effectId: '105000474_enter' }
    );
  },
  onQueryResolve: async (instance, gameState, _playerState, selections) => {
    const chosenUid = selections[0];
    const chosenPlayer = gameState.players[chosenUid];
    if (!chosenPlayer || chosenPlayer.hand.length === 0) return;

    const randomCard = chosenPlayer.hand[Math.floor(Math.random() * chosenPlayer.hand.length)];
    await AtomicEffectExecutor.execute(gameState, chosenUid, {
      type: 'DISCARD_CARD',
      targetFilter: { gamecardId: randomCard.gamecardId }
    }, instance);
  }
};

const card: Card = {
  id: '105000474',
  fullName: '猫耳魔偶',
  specialName: '',
  type: 'UNIT',
  color: 'YELLOW',
  gamecardId: null as any,
  colorReq: { YELLOW: 1 },
  faction: '无',
  acValue: 3,
  power: 2500,
  basePower: 2500,
  damage: 2,
  baseDamage: 2,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  isExhausted: false,
  isrush: false,
  baseIsrush: false,
  canAttack: true,
  feijingMark: false,
  canResetCount: 0,
  effects: [effect_105000474_enter],
  rarity: 'C',
  availableRarities: ['C'],
  cardPackage: 'BT03',
  uniqueId: null as any,
};

export default card;
