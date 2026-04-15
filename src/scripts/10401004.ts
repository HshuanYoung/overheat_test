import { Card, GameState, PlayerState } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';

const card: Card = {
  id: '10401004',
  fullName: '剑仙子',
  specialName: '',
  type: 'UNIT',
  color: 'BLUE',
  gamecardId: null as any,
  colorReq: {},
  acValue: 2,
  power: 500,
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
      id: 'jianxianzi_activate',
      type: 'ACTIVATE',
      description: '【启】[名称一回合一次] 我方场上存在3个蓝色单位时，将此卡返回持有者手牌。之后，选择我方侵蚀区前排一张正面向上的卡牌，返回持有者卡组并洗牌。',
      triggerLocation: ['UNIT'],
      limitCount: 1,
      limitNameType: true,
      condition: (gameState, playerState) => {
        const blueUnits = playerState.unitZone.filter(c => c && AtomicEffectExecutor.matchesColor(c, 'BLUE') && c.type === 'UNIT');
        const hasFrontErosion = playerState.erosionFront.some(c => c !== null && c.displayState === 'FRONT_UPRIGHT');
        return blueUnits.length >= 3 && hasFrontErosion;
      },
      cost: async (gameState, playerState, card) => {
        const sourcePlayer = gameState.players[playerState.uid];
        const isOnField = sourcePlayer.unitZone.some(c => c?.gamecardId === card.gamecardId);
        if (isOnField) {
          await AtomicEffectExecutor.execute(gameState, playerState.uid, {
            type: 'MOVE_FROM_FIELD',
            destinationZone: 'HAND',
            targetFilter: { gamecardId: card.gamecardId }
          }, card);
          gameState.logs.push(`${card.fullName} 已返回手牌 (作为发动代价)。`);
          return true;
        }
        return false;
      },
      execute: async (card, gameState, playerState) => {
        const frontalCards = playerState.erosionFront.filter(c => c && c.displayState === 'FRONT_UPRIGHT') as Card[];
        gameState.pendingQuery = {
          id: Math.random().toString(36).substring(7),
          type: 'SELECT_CARD',
          playerUid: playerState.uid,
          options: AtomicEffectExecutor.enrichQueryOptions(gameState, playerState.uid, frontalCards.map(c => ({ card: c, source: 'EROSION_FRONT' as any }))),
          title: '选择侵蚀区前排卡牌',
          description: '选择一张前排正面向上的卡牌返回卡组并洗牌。',
          minSelections: 1,
          maxSelections: 1,
          callbackKey: 'EFFECT_RESOLVE',
          context: { sourceCardId: card.gamecardId, effectIndex: 0 }
        };
      },
      onQueryResolve: async (card, gameState, playerState, selections) => {
        const selectedId = selections[0];
        const sourcePlayer = gameState.players[playerState.uid];
        const target = AtomicEffectExecutor.findCardById(gameState, selectedId);

        if (target) {
          await AtomicEffectExecutor.execute(gameState, playerState.uid, {
            type: 'MOVE_FROM_EROSION',
            targetFilter: { gamecardId: selectedId },
            destinationZone: 'DECK'
          }, card);

          await AtomicEffectExecutor.execute(gameState, playerState.uid, {
            type: 'SHUFFLE_DECK'
          }, card);

          gameState.logs.push(`[剑仙子] 已将 ${target.fullName} 返回卡组并洗牌。`);
        }
      }
    }
  ],
  rarity: 'SR',
  availableRarities: ['SR'],
  uniqueId: null,
  faction: '百濑之水城',
};

export default card;
