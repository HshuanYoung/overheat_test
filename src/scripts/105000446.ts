import { Card, CardEffect, GameEvent } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';
import { canPutUnitOntoBattlefield } from './_bt03YellowUtils';

const effect_105000446_continuous: CardEffect = {
  id: '105000446_continuous',
  type: 'CONTINUOUS',
  description: 'Cards revealed by effects of your cards whose names contain 《魔偶》 are treated as god-mark cards.'
};

const effect_105000446_trigger: CardEffect = {
  id: '105000446_trigger',
  type: 'TRIGGER',
  triggerLocation: ['DECK'],
  triggerEvent: 'REVEAL_DECK',
  description: 'When this card is revealed from the top of your deck by an effect of your card whose name contains 《魔偶》, you may put it onto the battlefield.',
  condition: (_gameState, playerState, instance, event?: GameEvent) =>
    instance.cardlocation === 'DECK' &&
    event?.type === 'REVEAL_DECK' &&
    event.playerUid === playerState.uid &&
    event.data?.sourceCardName?.includes('魔偶') &&
    Array.isArray(event.data?.cards) &&
    event.data.cards.some((card: Card) => card.gamecardId === instance.gamecardId) &&
    canPutUnitOntoBattlefield(playerState, instance),
  execute: async (instance, gameState, playerState) => {
    await AtomicEffectExecutor.execute(gameState, playerState.uid, {
      type: 'MOVE_FROM_DECK',
      targetFilter: { gamecardId: instance.gamecardId },
      destinationZone: 'UNIT'
    }, instance);
  }
};

const card: Card = {
  id: '105000446',
  fullName: '天才魔偶师「优」',
  specialName: '优',
  type: 'UNIT',
  color: 'YELLOW',
  gamecardId: null as any,
  colorReq: { YELLOW: 2 },
  faction: '无',
  acValue: 3,
  power: 2000,
  basePower: 2000,
  damage: 2,
  baseDamage: 2,
  godMark: true,
  displayState: 'FRONT_UPRIGHT',
  isExhausted: false,
  isrush: false,
  baseIsrush: false,
  canAttack: true,
  feijingMark: false,
  canResetCount: 0,
  effects: [effect_105000446_continuous, effect_105000446_trigger],
  rarity: 'SR',
  availableRarities: ['SR'],
  cardPackage: 'BT04',
  uniqueId: null as any,
};

export default card;
