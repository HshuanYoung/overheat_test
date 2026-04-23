import { Card, CardEffect, GameEvent } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';
import { createSelectCardQuery, getBattlefieldUnits } from './_bt03YellowUtils';

const effect_105000473_virtual_godmark: CardEffect = {
  id: '105000473_virtual_godmark',
  type: 'CONTINUOUS',
  description: 'In your deck, this card is also treated as a god-mark card.'
};

const effect_105000473_reveal: CardEffect = {
  id: '105000473_reveal',
  type: 'TRIGGER',
  triggerLocation: ['DECK'],
  triggerEvent: 'REVEAL_DECK',
  limitCount: 1,
  limitNameType: true,
  isMandatory: true,
  description: 'When this card is revealed from the top of your deck, choose up to 2 units. This turn they get +1 damage, +500 power, and Rush.',
  condition: (_gameState, playerState, instance, event?: GameEvent) =>
    instance.cardlocation === 'DECK' &&
    event?.type === 'REVEAL_DECK' &&
    event.playerUid === playerState.uid &&
    Array.isArray(event.data?.cards) &&
    event.data.cards.some((card: Card) => card.gamecardId === instance.gamecardId),
  execute: async (instance, gameState, playerState) => {
    const targets = getBattlefieldUnits(gameState);
    if (targets.length === 0) return;

    createSelectCardQuery(
      gameState,
      playerState.uid,
      targets,
      'Choose Up To 2 Units',
      'Choose up to 2 units to buff this turn.',
      0,
      Math.min(2, targets.length),
      { sourceCardId: instance.gamecardId, effectId: '105000473_reveal' }
    );
  },
  onQueryResolve: async (instance, gameState, playerState, selections) => {
    for (const targetId of selections) {
      await AtomicEffectExecutor.execute(gameState, playerState.uid, {
        type: 'CHANGE_DAMAGE',
        value: 1,
        turnDuration: 1,
        targetFilter: { gamecardId: targetId }
      }, instance);
      await AtomicEffectExecutor.execute(gameState, playerState.uid, {
        type: 'CHANGE_POWER',
        value: 500,
        turnDuration: 1,
        targetFilter: { gamecardId: targetId }
      }, instance);
      await AtomicEffectExecutor.execute(gameState, playerState.uid, {
        type: 'GAIN_KEYWORD',
        params: { keyword: 'RUSH' },
        turnDuration: 1,
        targetFilter: { gamecardId: targetId }
      }, instance);
    }
  }
};

const card: Card = {
  id: '105000473',
  fullName: '士兵魔偶',
  specialName: '',
  type: 'UNIT',
  color: 'YELLOW',
  gamecardId: null as any,
  colorReq: {},
  faction: '无',
  acValue: 3,
  power: 2000,
  basePower: 2000,
  damage: 2,
  baseDamage: 2,
  godMark: false,
  baseGodMark: false,
  displayState: 'FRONT_UPRIGHT',
  isExhausted: false,
  isrush: false,
  baseIsrush: false,
  canAttack: true,
  feijingMark: false,
  canResetCount: 0,
  effects: [effect_105000473_virtual_godmark, effect_105000473_reveal],
  rarity: 'R',
  availableRarities: ['R'],
  cardPackage: 'BT03',
  uniqueId: null as any,
};

export default card;
