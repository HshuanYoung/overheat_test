import { Card, GameState, PlayerState } from '../types/game';



const card: Card = {
  id: '10400002',
  fullName: '翡翠水蜥',
  specialName: '',
  type: 'UNIT',
  color: 'BLUE',
  gamecardId: null,
  colorReq: {},
  faction: '无',
  acValue: 0,
  power: 0,
  damage: 0,
  baseDamage: 0,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  isExhausted: false,
  isrush: false,
  canAttack: true,
  feijingMark: false,
  canResetCount: 0,
  effects: [
    {
      id: '10400002_activate',
      type: 'ACTIVATE',
      description: '【计略发动】[侵蚀区正面限定] 若你的战场上已有2张或以上的蓝色单位，且当前非对抗阶段：支付0费并舍弃一张手牌，将这张卡以重置状态放置到战场上。',
      playCost: 0,
      triggerLocation: ['EROSION_FRONT'],
      condition: (gameState: GameState, playerState: PlayerState) => {
        const blueUnits = playerState.unitZone.filter(c => c && c.color === 'BLUE');
        const isNotCountering = gameState.phase !== 'COUNTERING';
        return blueUnits.length >= 2 && isNotCountering;
      },
      execute: (card: Card, gameState: GameState, playerState: PlayerState) => {
        if (playerState.hand.length === 0) {
          gameState.logs.push(`[翡翠水蜥] 手牌不足，无法发动效果。`);
          return;
        }

        gameState.pendingQuery = {
          id: Math.random().toString(36).substring(7),
          type: 'SELECT_CARD',
          playerUid: playerState.uid,
          options: playerState.hand.map(h => ({ card: { ...h }, source: 'HAND' as any })),
          title: '舍弃一张手牌',
          description: '请选择一张手牌作为发动的代价舍弃到墓地。',
          minSelections: 1,
          maxSelections: 1,
          callbackKey: 'GENERIC_RESOLVE',
          context: { sourceCardId: card.gamecardId },
          afterSelectionEffects: [
            {
              type: 'DISCARD_CARD',
              targetFilter: { querySelection: true }
            },
            {
              type: 'MOVE_FROM_EROSION',
              targetFilter: { gamecardId: card.gamecardId },
              destinationZone: 'UNIT'
            },
            {
              type: 'ROTATE_VERTICAL',
              targetFilter: { gamecardId: card.gamecardId }
            }
          ],
          executionMode: 'IMMEDIATE'
        };
      }
    }
  ],
  rarity: 'U',
  availableRarities: ['U'],
  uniqueId: null,
};


export default card;
