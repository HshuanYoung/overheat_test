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
      description: '【启动】[名称一回合一次] 我方场上存在3个蓝色单位时，0费：此卡在单位区时可以启动（对抗阶段亦可），将此卡返回持有者手牌。之后，选择我方侵蚀区前排一张正面向上的卡牌，返回持有者卡组并洗牌。',
      triggerLocation: ['UNIT'],
      limitCount: 1,
      limitNameType: true,
      condition: (gameState, playerState) => {
        const blueUnits = playerState.unitZone.filter(c => c && c.color === 'BLUE' && c.type === 'UNIT');
        const hasFrontErosion = playerState.erosionFront.some(c => c !== null && c.displayState === 'FRONT_UPRIGHT');
        return blueUnits.length >= 3 && hasFrontErosion;
      },
      cost: (gameState, playerState, card) => {
        const sourcePlayer = gameState.players[playerState.uid];
        const isOnField = sourcePlayer.unitZone.some(c => c?.gamecardId === card.gamecardId);
        if (isOnField) {
          AtomicEffectExecutor.execute(gameState, playerState.uid, {
            type: 'MOVE_FROM_FIELD',
            destinationZone: 'HAND',
            targetFilter: { gamecardId: card.gamecardId }
          }, card);
          gameState.logs.push(`${card.fullName} 已返回手牌 (作为发动代价)。`);
          return true;
        }
        return false;
      },
      execute: (card, gameState, playerState) => {
        const frontalCards = playerState.erosionFront.filter(c => c && c.displayState === 'FRONT_UPRIGHT') as Card[];
        gameState.pendingQuery = {
          id: Math.random().toString(36).substring(7),
          type: 'SELECT_CARD',
          playerUid: playerState.uid,
          options: frontalCards.map(c => ({ card: { ...c }, source: 'EROSION_FRONT' as any })),
          title: '选择侵蚀区前排卡牌',
          description: '选择一张前排正面向上的卡牌返回卡组并洗牌。',
          minSelections: 1,
          maxSelections: 1,
          callbackKey: 'EFFECT_RESOLVE',
          context: { sourceCardId: card.gamecardId, effectIndex: 0 }
        };
      },
      onQueryResolve: (card, gameState, playerState, selections) => {
        const selectedId = selections[0];
        const sourcePlayer = gameState.players[playerState.uid];
        gameState.logs.push(`[剑仙子-DEBUG] 正在处理选择: ${selectedId}`);
        const idx = sourcePlayer.erosionFront.findIndex(c => c?.gamecardId === selectedId);
        if (idx !== -1) {
          const selected = sourcePlayer.erosionFront[idx]!;
          sourcePlayer.erosionFront[idx] = null;
          selected.cardlocation = 'DECK';
          sourcePlayer.deck.push(selected);
          
          // Fisher-Yates shuffle
          for (let i = sourcePlayer.deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [sourcePlayer.deck[i], sourcePlayer.deck[j]] = [sourcePlayer.deck[j], sourcePlayer.deck[i]];
          }
          gameState.logs.push(`[剑仙子] 已将 ${selected.fullName} 返回卡组并洗牌。`);
        } else {
          gameState.logs.push(`[剑仙子-ERR] 找不到选择的卡牌 ID: ${selectedId}`);
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
