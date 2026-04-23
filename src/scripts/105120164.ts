import { Card, CardEffect } from '../types/game';

const effect_105120164_alchemy_buff: CardEffect = {
  id: '105120164_alchemy_buff',
  type: 'CONTINUOUS',
  description: 'If this unit entered from deck by an alchemy effect, it becomes 3500 power / 2 damage and gains Rush and Annihilation.',
  applyContinuous: (_gameState, instance) => {
    if (
      (instance as any).data?.enteredFromDeckByAlchemyTurn === undefined ||
      (instance as any).data?.lastMovedFromZone !== 'DECK' ||
      (instance as any).data?.lastMovedToZone !== 'UNIT'
    ) {
      return;
    }
    instance.power = 3500;
    instance.damage = 2;
    instance.isrush = true;
    instance.isAnnihilation = true;
  }
};

const card: Card = {
  id: '105120164',
  fullName: '炼金兽 银刃狼',
  specialName: '',
  type: 'UNIT',
  color: 'YELLOW',
  gamecardId: null as any,
  colorReq: {},
  faction: '永生之乡',
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
  isAnnihilation: false,
  baseAnnihilation: false,
  canAttack: true,
  feijingMark: false,
  canResetCount: 0,
  effects: [effect_105120164_alchemy_buff],
  rarity: 'U',
  availableRarities: ['U'],
  cardPackage: 'BT02,ST04',
  uniqueId: null as any,
};

export default card;
