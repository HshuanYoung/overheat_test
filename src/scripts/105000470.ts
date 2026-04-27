import { Card, CardEffect, GameEvent } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';
import { createSelectCardQuery, getBattlefieldUnits, isVirtualGodMarkReveal, shuffleAndRevealTopCards } from './BaseUtil';

const effect_105000470_enter: CardEffect = {
  id: '105000470_enter',
  type: 'TRIGGER',
  triggerLocation: ['UNIT'],
  triggerEvent: 'CARD_ENTERED_ZONE',
  limitCount: 1,
  limitNameType: true,
  isMandatory: true,
  description: 'When this unit enters the battlefield, shuffle your deck and reveal the top card. If it is a god-mark card, return 1 unit on the battlefield to its owner hand.',
  condition: (_gameState, _playerState, instance, event?: GameEvent) =>
    instance.cardlocation === 'UNIT' &&
    event?.type === 'CARD_ENTERED_ZONE' &&
    event.sourceCardId === instance.gamecardId &&
    event.data?.zone === 'UNIT',
  execute: async (instance, gameState, playerState) => {
    const revealedCard = (await shuffleAndRevealTopCards(gameState, playerState.uid, 1, instance))[0];
    if (!isVirtualGodMarkReveal(gameState, revealedCard)) return;

    const targets = getBattlefieldUnits(gameState);
    if (targets.length === 0) return;

    createSelectCardQuery(
      gameState,
      playerState.uid,
      targets,
      'Choose A Unit',
      'Choose 1 unit on the battlefield to return to hand.',
      1,
      1,
      { sourceCardId: instance.gamecardId, effectId: '105000470_enter' }
    );
  },
  onQueryResolve: async (instance, gameState, playerState, selections) => {
    await AtomicEffectExecutor.execute(gameState, playerState.uid, {
      type: 'MOVE_FROM_FIELD',
      targetFilter: { gamecardId: selections[0], type: 'UNIT' },
      destinationZone: 'HAND'
    }, instance);
  }
};

const card: Card = {
  id: '105000470',
  fullName: '食人魔偶',
  specialName: '',
  type: 'UNIT',
  color: 'YELLOW',
  gamecardId: null as any,
  colorReq: { YELLOW: 1 },
  faction: '无',
  acValue: 2,
  power: 2000,
  basePower: 2000,
  damage: 1,
  baseDamage: 1,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  isExhausted: false,
  isrush: false,
  baseIsrush: false,
  canAttack: true,
  feijingMark: false,
  canResetCount: 0,
  effects: [effect_105000470_enter],
  rarity: 'C',
  availableRarities: ['C'],
  cardPackage: 'BT03',
  uniqueId: null as any,
};

export default card;
