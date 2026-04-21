import { Card, CardEffect, GameState, PlayerState } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';

const activate_10402023_power_up: CardEffect = {
  id: '10402023_power_up',
  type: 'ACTIVATE',
  triggerLocation: ['UNIT'],
  limitCount: 1,
  limitNameType: true,
  description: '【启动】【卡名一回合一次】：你的单位区中每有1个卡名含有“牛头人”的单位，本回合中，这个单位力量值+500。',
  condition: (_gameState: GameState, playerState: PlayerState, instance: Card) => {
    return instance.cardlocation === 'UNIT';
  },
  execute: async (instance: Card, gameState: GameState, playerState: PlayerState) => {
    const minotaurCount = playerState.unitZone.filter(
      (unit): unit is Card => !!unit && unit.fullName.includes('牛头人')
    ).length;

    if (minotaurCount <= 0) {
      gameState.logs.push(`[${instance.fullName}] 当前没有“牛头人”单位，效果未生效。`);
      return;
    }

    const bonus = minotaurCount * 500;
    await AtomicEffectExecutor.execute(gameState, playerState.uid, {
      type: 'CHANGE_POWER',
      targetFilter: { gamecardId: instance.gamecardId },
      value: bonus,
      turnDuration: 1
    }, instance);

    gameState.logs.push(`[${instance.fullName}] 效果生效：因你的单位区有 ${minotaurCount} 个“牛头人”，本回合力量值+${bonus}。`);
  }
};

const card: Card = {
  id: '10402023',
  fullName: '牛头人的守城部队',
  specialName: '',
  type: 'UNIT',
  color: 'BLUE',
  gamecardId: null as any,
  colorReq: { BLUE: 1 },
  faction: '九尾商会联盟',
  acValue: 3,
  power: 2000,
  basePower: 2000,
  damage: 2,
  baseDamage: 2,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  isExhausted: false,
  isrush: false,
  canAttack: true,
  feijingMark: false,
  canResetCount: 0,
  effects: [activate_10402023_power_up],
  rarity: 'C',
  availableRarities: ['C'],
  uniqueId: null as any,
};

export default card;
