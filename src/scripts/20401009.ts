import { Card, GameState, PlayerState } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';

const card: Card = {
  id: '20401009',
  fullName: '百濑的剑舞',
  specialName: '',
  type: 'STORY',
  color: 'BLUE',
  gamecardId: null as any,
  colorReq: { BLUE: 1 },
  faction: '无',
  acValue: 3,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  feijingMark: false,
  canResetCount: 0,
  effects: [
    {
      id: 'sword_dance_activate',
      type: 'ACTIVATE',
      description: '【对付】：只能在有从战场返回的单位的回合发动。将战场上所有AC2及以下的单位返回持有者手牌。',
      condition: (gameState, playerState) => {
        return !!playerState.hasUnitReturnedThisTurn;
      },
      execute: async (card, gameState, playerState) => {
        await AtomicEffectExecutor.execute(gameState, playerState.uid, {
          type: 'MOVE_FROM_FIELD',
          targetFilter: {
            type: 'UNIT',
            maxAc: 2,
            onField: true
          },
          destinationZone: 'HAND'
        }, card);

        gameState.logs.push(`[百濑的剑舞] 效果发动，将所有 AC 2 及以下的单位返回手牌。`);
      }
    }
  ],
  rarity: 'C',
  availableRarities: ['C'],
  uniqueId: null as any,
};

export default card;
