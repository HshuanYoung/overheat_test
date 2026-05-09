import { Card, CardEffect } from '../types/game';
import { isBattlingGodMarkUnit } from './BaseUtil';

const effect_105110444_continuous: CardEffect = {
  id: '105110444_continuous',
  type: 'CONTINUOUS',
  description: '这个单位与神蚀单位战斗时，本次战斗中其不会被战斗破坏，伤害变为3，并获得【歼灭】。',
  applyContinuous: (gameState, instance) => {
    if (!isBattlingGodMarkUnit(gameState, instance)) return;
    instance.damage = 3;
    instance.isAnnihilation = true;
    (instance as any).battleImmuneByEffect = true;
  }
};

const card: Card = {
  id: '105110444',
  fullName: '钢兵的巨人',
  specialName: '',
  type: 'UNIT',
  color: 'YELLOW',
  gamecardId: null as any,
  colorReq: {},
  faction: '学院要塞',
  acValue: 3,
  power: 3500,
  basePower: 3500,
  damage: 2,
  baseDamage: 2,
  godMark: true,
  displayState: 'FRONT_UPRIGHT',
  isExhausted: false,
  isrush: false,
  baseIsrush: false,
  isAnnihilation: false,
  baseAnnihilation: false,
  canAttack: true,
  feijingMark: false,
  canResetCount: 0,
  effects: [effect_105110444_continuous],
  rarity: 'R',
  availableRarities: ['R'],
  cardPackage: 'BT04',
  uniqueId: null as any,
};

export default card;
