import { Card, CardEffect, GameEvent } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';
import { canPutUnitOntoBattlefield } from './BaseUtil';

const effect_105000446_continuous: CardEffect = {
  id: '105000446_continuous',
  type: 'CONTINUOUS',
  description: '由你的卡名含有《魔偶》的卡的效果展示的卡视为神蚀卡。'
};

const effect_105000446_trigger: CardEffect = {
  id: '105000446_trigger',
  type: 'TRIGGER',
  triggerLocation: ['DECK'],
  triggerEvent: 'REVEAL_DECK',
  description: '这张卡因你的卡名含有《魔偶》的卡的效果从卡组顶展示时，你可以将其放置到战场。',
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
