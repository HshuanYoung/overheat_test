import { Card, GameState, PlayerState, CardEffect } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';

const effect_20400018_activate: CardEffect = {
  id: '20400018_activate',
  type: 'ACTIVATE',
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
  id: '20400018',
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
  effects: [effect_20400018_activate],
  rarity: 'R',
  availableRarities: ['R'],
  uniqueId: null,
};

export default card;
