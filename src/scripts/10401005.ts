import { Card, GameState, PlayerState } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';

const card: Card = {
  id: '10401005',
  fullName: '晶剑仙郎',
  specialName: '',
  type: 'UNIT',
  color: 'BLUE',
  gamecardId: null as any,
  colorReq: {},
  faction: '百濑之水城',
  acValue: 3,
  power: 3500,
  basePower: 3500,
  damage: 1,
  baseDamage: 1,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  isExhausted: false,
  isrush: false,
  canAttack: true,
  feijingMark: true,
  canResetCount: 0,
  effects: [],
  rarity: 'C',
  availableRarities: ['C'],
  uniqueId: null,
};

export default card;
