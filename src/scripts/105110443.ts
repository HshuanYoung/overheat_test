import { Card, CardEffect } from '../types/game';
import { isBattlingGodMarkUnit } from './BaseUtil';

const effect_105110443_continuous: CardEffect = {
  id: '105110443_continuous',
  type: 'CONTINUOUS',
  description: '这个单位与神蚀单位战斗时，本次战斗中其力量+2000。',
  applyContinuous: (gameState, instance) => {
    if (!isBattlingGodMarkUnit(gameState, instance)) return;
    instance.power = (instance.power || 0) + 2000;
  }
};

const card: Card = {
  id: '105110443',
  fullName: '铁甲钢兵',
  specialName: '',
  type: 'UNIT',
  color: 'YELLOW',
  gamecardId: null as any,
  colorReq: {},
  faction: '学院要塞',
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
  effects: [effect_105110443_continuous],
  rarity: 'C',
  availableRarities: ['C'],
  cardPackage: 'BT04',
  uniqueId: null as any,
};

export default card;
