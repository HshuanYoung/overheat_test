import { Card, GameState, PlayerState, CardEffect, TriggerLocation, GameEvent } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';

const effect_10400009_counter: CardEffect = {
  id: 'gensou_counter',
  type: 'ACTIVATE',
  triggerLocation: ['HAND'],
  description: '【起】手牌中：在此卡在手牌且在对手打出卡牌的对应对抗阶段，若我方战场上有两张或更多蓝色单位卡，支付4点费用：将此卡放置在战场，使那次发动无效，并使那张卡返回其持有者手牌。本回合对手不能使用那张卡或同名卡。',
  condition: (gameState: GameState, playerState: PlayerState, instance: Card) => {
    // Check phase and blue unit condition
    if (gameState.phase !== 'COUNTERING') return false;
    const blueUnitCount = playerState.unitZone.filter(u => u && u.color === 'BLUE').length;
    if (blueUnitCount < 2) return false;

    // Check if there is an opponent's card play to counter
    const opponentId = gameState.playerIds.find(id => id !== playerState.uid)!;
    return gameState.counterStack.some(item => item.type === 'PLAY' && item.ownerUid === opponentId && !item.isNegated);
  },
  execute: async (instance: Card, gameState: GameState, playerState: PlayerState) => {
    // 1. Pay Cost (4 fees)
    gameState.pendingQuery = {
      id: Math.random().toString(36).substring(7),
      type: 'SELECT_PAYMENT',
      playerUid: playerState.uid,
      options: [],
      title: '支付发动费用',
      description: '支付4点费用以发动「幻想吞噬龙」。',
      minSelections: 1,
      maxSelections: 1,
      callbackKey: 'EFFECT_RESOLVE',
      paymentCost: 4,
      paymentColor: 'BLUE',
      context: {
        effectId: 'gensou_counter',
        sourceCardId: instance.gamecardId,
        step: 'PAYMENT'
      }
    };
  },
  onQueryResolve: async (instance: Card, gameState: GameState, playerState: PlayerState, selections: string[], context: any) => {
    if (context.step === 'PAYMENT') {
       // Payment successful (handled by engine check before callback)
       
       // check field space
       const emptyIdx = playerState.unitZone.findIndex(s => s === null);
       if (emptyIdx === -1) {
         gameState.logs.push(`[${instance.fullName}] 发动：单位区已满，无法上场。`);
         // We still proceed with negation even if summon fails? 
         // Request says "place card... invalid... return...", usually these are sequential.
       }

       // 2. Summon self
       const handIdx = playerState.hand.findIndex(c => c?.gamecardId === instance.gamecardId);
       if (handIdx !== -1) {
         const card = playerState.hand.splice(handIdx, 1)[0]!;
         card.cardlocation = 'UNIT';
         card.playedTurn = gameState.turnCount;
         if (emptyIdx !== -1) {
           playerState.unitZone[emptyIdx] = card;
         } else {
           playerState.unitZone.push(card);
         }
         gameState.logs.push(`[${instance.fullName}] 因效果进入战场！`);
       }

       // 3. Negate and Return to hand
       const opponentId = gameState.playerIds.find(id => id !== playerState.uid)!;
       const opponent = gameState.players[opponentId];
       
       // Find the most recent opponent PLAY item
       for (let i = gameState.counterStack.length - 1; i >= 0; i--) {
         const item = gameState.counterStack[i];
         if (item.type === 'PLAY' && item.ownerUid === opponentId && !item.isNegated) {
           item.isNegated = true;
           const targetCard = item.card;
           if (targetCard) {
             // Move from PLAY to HAND
             const playIdx = opponent.playZone.findIndex(c => c?.gamecardId === targetCard.gamecardId);
             if (playIdx !== -1) {
               opponent.playZone.splice(playIdx, 1);
               targetCard.cardlocation = 'HAND';
               opponent.hand.push(targetCard);
               
               // 4. Lockdown
               if (!opponent.negatedNames) opponent.negatedNames = [];
               if (!opponent.negatedNames.includes(targetCard.fullName)) {
                 opponent.negatedNames.push(targetCard.fullName);
               }
               
               gameState.logs.push(`[${instance.fullName}] 使 [${targetCard.fullName}] 发动无效并将其返回对手手牌。本回合对手无法再次使用同名卡！`);
             }
           }
           break;
         }
       }
    }
  }
};

const card: Card = {
  id: '10400009',
  gamecardId: null as any,
  fullName: '「幻想吞噬龙」',
  specialName: '',
  type: 'UNIT',
  color: 'BLUE',
  colorReq: { 'BLUE': 2 },
  faction: '无',
  acValue: 4,
  power: 3500,
  basePower: 3500,
  damage: 2,
  baseDamage: 2,
  godMark: true,
  displayState: 'FRONT_UPRIGHT',
  isExhausted: false,
  isrush: false,
  canAttack: true,
  feijingMark: false,
  canResetCount: 0,
  effects: [
    effect_10400009_counter
  ],
  rarity: 'SR',
  availableRarities: ['SR'],
  uniqueId: null,
};

export default card;
