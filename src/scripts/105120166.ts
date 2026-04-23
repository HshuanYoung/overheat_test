import { Card, CardEffect } from '../types/game';

const effect_105120166_alchemy_buff: CardEffect = {
  id: '105120166_alchemy_buff',
  type: 'CONTINUOUS',
  description: 'If this unit entered from deck by an alchemy effect, it becomes 3500 power / 3 damage and gains Rush and Heroic.',
  applyContinuous: (_gameState, instance) => {
    if (
      (instance as any).data?.enteredFromDeckByAlchemyTurn === undefined ||
      (instance as any).data?.lastMovedFromZone !== 'DECK' ||
      (instance as any).data?.lastMovedToZone !== 'UNIT'
    ) {
      return;
    }
    instance.power = 3500;
    instance.damage = 3;
    instance.isrush = true;
    instance.isHeroic = true;
  }
};

const card: Card = {
  id: '105120166',
  fullName: '炼金兽 翼蛇',
  specialName: '',
  type: 'UNIT',
  color: 'YELLOW',
  gamecardId: null as any,
  colorReq: { YELLOW: 1 },
  faction: '永生之乡',
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
  isHeroic: false,
  baseHeroic: false,
  canAttack: true,
  feijingMark: false,
  canResetCount: 0,
  effects: [effect_105120166_alchemy_buff],
  rarity: 'R',
  availableRarities: ['R'],
  cardPackage: 'BT02',
  uniqueId: null as any,
};

export default card;
