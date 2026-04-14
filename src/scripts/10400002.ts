import { Card, GameState, PlayerState } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';



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
      condition: (gameState, playerState) => {
        const blueUnits = playerState.unitZone.filter(c => c && AtomicEffectExecutor.matchesColor(c, 'BLUE'));
        const isNotCountering = gameState.phase !== 'COUNTERING';
        return blueUnits.length >= 2 && isNotCountering && playerState.hand.length >= 1;
      },
      cost: async (gameState, playerState, card) => {
        gameState.pendingQuery = {
          id: Math.random().toString(36).substring(7),
          type: 'SELECT_CARD',
          playerUid: playerState.uid,
          options: playerState.hand.map(h => ({ card: { ...h }, source: 'HAND' as any })),
          title: '舍弃一张手牌',
          description: '请选择一张手牌作为发动的代价舍弃到墓地。',
          minSelections: 1,
          maxSelections: 1,
          callbackKey: 'ACTIVATE_COST_RESOLVE',
          context: { sourceCardId: card.gamecardId }
        };
        return true;
      },
      onQueryResolve: async (card, gameState, playerState, selections) => {
        const cardId = selections[0];
        const sourcePlayer = gameState.players[playerState.uid];
        const cardInHand = sourcePlayer.hand.find(c => c.gamecardId === cardId);
        if (cardInHand) {
          sourcePlayer.hand = sourcePlayer.hand.filter(c => c.gamecardId !== cardId);
          cardInHand.cardlocation = 'GRAVE';
          sourcePlayer.grave.push(cardInHand);
          gameState.logs.push(`${playerState.displayName} 舍弃了 ${cardInHand.fullName}。`);
        }
      },
      execute: async (card, gameState, playerState) => {
        // Move from erosion to unit zone
        const emptyIndex = playerState.unitZone.findIndex(c => c === null);
        if (emptyIndex !== -1) {
          await AtomicEffectExecutor.execute(gameState, playerState.uid, {
            type: 'MOVE_FROM_EROSION',
            targetFilter: { gamecardId: card.gamecardId },
            destinationZone: 'UNIT'
          }, card);
          
          card.displayState = 'FRONT_UPRIGHT';
          card.isExhausted = false;
          gameState.logs.push(`${card.fullName} 已放置到单位区（重置状态）。`);
        }
      }
    }
  ],
  rarity: 'U',
  availableRarities: ['U'],
  uniqueId: null,
};


export default card;
