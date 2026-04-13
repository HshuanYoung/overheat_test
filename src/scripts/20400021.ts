import { Card, GameState, PlayerState, CardEffect, TriggerLocation, GameEvent } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';

const effect_20400021_counter: CardEffect = {
  id: 'gensou_swallow_counter',
  type: 'ACTIVATE',
  triggerLocation: ['HAND'],
  description: '【起】手牌中：若我侵蚀区域背面卡牌在2张或以上，对手使用故事卡时：使该故事卡发动无效并送入墓地。',
  condition: (gameState: GameState, playerState: PlayerState, instance: Card) => {
    // 1. Check phase
    if (gameState.phase !== 'COUNTERING') return false;

    // 2. Erosion Back requirement
    const backCount = playerState.erosionBack.filter(c => c !== null).length;
    if (backCount < 2) return false;

    // 3. Opponent has a STORY card on stack
    const opponentId = gameState.playerIds.find(id => id !== playerState.uid)!;
    return gameState.counterStack.some(item => 
      item.type === 'PLAY' && 
      item.ownerUid === opponentId && 
      item.card?.type === 'STORY' && 
      !item.isNegated
    );
  },
  execute: async (gameState: GameState, playerState: PlayerState, instance: Card) => {
    // Select payment (2 AC)
    gameState.pendingQuery = {
      id: Math.random().toString(36).substring(7),
      type: 'SELECT_PAYMENT',
      playerUid: playerState.uid,
      options: [],
      title: '支付发动费用',
      description: '支付2点费用以发动「吞噬幻想」。',
      minSelections: 1,
      maxSelections: 1,
      callbackKey: 'EFFECT_RESOLVE',
      paymentCost: 2,
      paymentColor: 'BLUE',
      context: {
        effectId: 'gensou_swallow_counter',
        sourceCardId: instance.gamecardId,
        step: 'PAYMENT'
      }
    };
  },
  onQueryResolve: (instance: Card, gameState: GameState, playerState: PlayerState, selections: string[], context: any) => {
    if (context.step === 'PAYMENT') {
      // 1. Move self to grave (consuming the story card)
      const handIdx = playerState.hand.findIndex(c => c?.gamecardId === instance.gamecardId);
      if (handIdx !== -1) {
        const card = playerState.hand.splice(handIdx, 1)[0]!;
        card.cardlocation = 'GRAVE';
        playerState.grave.push(card);
        gameState.logs.push(`[${instance.fullName}] 发动并送入了墓地。`);
      }

      // 2. Find and negate the opponent's STORY card
      const opponentId = gameState.playerIds.find(id => id !== playerState.uid)!;
      const opponent = gameState.players[opponentId];

      for (let i = gameState.counterStack.length - 1; i >= 0; i--) {
        const item = gameState.counterStack[i];
        if (item.type === 'PLAY' && item.ownerUid === opponentId && item.card?.type === 'STORY' && !item.isNegated) {
          item.isNegated = true;
          const targetCard = item.card;
          if (targetCard) {
            // Move from PLAY zone to Grave
            const playIdx = opponent.playZone.findIndex(c => c?.gamecardId === targetCard.gamecardId);
            if (playIdx !== -1) {
              opponent.playZone.splice(playIdx, 1);
              targetCard.cardlocation = 'GRAVE';
              opponent.grave.push(targetCard);
              gameState.logs.push(`[${instance.fullName}] 使对手的 [${targetCard.fullName}] 发动无效并送入了墓地。`);
            }
          }
          break;
        }
      }
    }
  }
};

const card: Card = {
  id: '20400021',
  gamecardId: null as any,
  fullName: '吞噬幻想',
  specialName: '',
  type: 'STORY',
  color: 'BLUE',
  colorReq: { 'BLUE': 1 },
  faction: '无',
  acValue: 2,
  power: 0,
  basePower: 0,
  damage: 0,
  baseDamage: 0,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  isExhausted: false,
  isrush: false,
  canAttack: false,
  feijingMark: false,
  canResetCount: 0,
  effects: [
    effect_20400021_counter
  ],
  rarity: 'U',
  availableRarities: ['U'],
  uniqueId: null,
};

export default card;
