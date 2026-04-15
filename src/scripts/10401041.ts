import { Card, GameState, PlayerState, CardEffect } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';

const continuous_10401041: CardEffect = {
  id: 'daowuzhe_continuous',
  type: 'CONTINUOUS',
  description: '【永】当侵蚀区存在1-4张卡牌且战场上有1个或更多蓝色单位时，我方卡牌的效果使此卡移动到手牌、卡组或侵蚀区时，改为将其放置在战场上。',
  condition: (gameState: GameState, playerState: PlayerState, instance: Card) => {
    // 1-4 erosion zones
    const erosionCount = playerState.erosionFront.filter(c => c !== null).length +
      playerState.erosionBack.filter(c => c !== null).length;
    if (erosionCount < 1 || erosionCount > 4) return false;

    // one or more blue units on the field
    const blueUnitsCount = playerState.unitZone.filter(u => u && AtomicEffectExecutor.matchesColor(u, 'BLUE')).length;
    return blueUnitsCount >= 1;
  },
  movementReplacementDestination: 'UNIT'
};

const card: Card = {
  id: '10401041',
  gamecardId: null as any,
  fullName: '水城的刀舞者',
  specialName: '',
  type: 'UNIT',
  color: 'BLUE',
  colorReq: { 'BLUE': 1 },
  faction: '百濑之水城',
  acValue: 4,
  power: 3000,
  basePower: 3000,
  damage: 2,
  baseDamage: 2,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  isExhausted: false,
  isrush: false,
  canAttack: true,
  feijingMark: false,
  canResetCount: 0,
  effects: [
    continuous_10401041
  ],
  rarity: 'PR',
  availableRarities: ['PR'],
  uniqueId: null,
};

export default card;
