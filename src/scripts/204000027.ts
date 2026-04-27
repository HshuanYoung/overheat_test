import { Card, GameState, PlayerState, CardEffect } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';

const effect_204000027_activate: CardEffect = {
  id: '204000027_activate',
  type: 'ACTIVATE',
  triggerLocation: ['PLAY'],
  description: '每回合此卡名限一次，抽两张牌。',
  limitCount: 1,
  limitNameType: true,
  execute: async (instance: Card, gameState: GameState, playerState: PlayerState) => {
    await AtomicEffectExecutor.execute(gameState, playerState.uid, {
      type: 'DRAW',
      value: 2
    }, instance);
    gameState.logs.push(`[${instance.fullName}] 效果：抽了两张牌。`);
  }
};

const card: Card = {
  id: '204000027',
  fullName: '情报放出',
  specialName: '',
  type: 'STORY',
  color: 'BLUE',
  gamecardId: null as any,
  colorReq: { BLUE: 2 },
  faction: '无',
  acValue: 2,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  feijingMark: false,
  canResetCount: 0,
  effects: [effect_204000027_activate],
  rarity: 'R',
  availableRarities: ['R'],
  cardPackage: 'BT01,ST03',
  uniqueId: null,
};

export default card;
