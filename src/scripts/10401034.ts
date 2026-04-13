import { Card, GameState, PlayerState, CardEffect, TriggerLocation, GameEvent } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';

const effect_10401034_front: CardEffect = {
  id: 'seii_from_erosion',
  type: 'ACTIVATE',
  triggerLocation: ['EROSION_FRONT'],
  description: '【起】每回合一次。在你的主要阶段，此卡在侵蚀区域正面时：将此卡放置在战场。',
  limitCount: 1,
  limitNameType: true,
  condition: (gameState: GameState, playerState: PlayerState) => {
    return playerState.isTurn && gameState.phase === 'MAIN' && playerState.unitZone.some(s => s === null);
  },
  execute: async (gameState: GameState, playerState: PlayerState, instance: Card) => {
    const pUid = playerState.uid;
    AtomicEffectExecutor.moveCard(gameState, pUid, 'EROSION_FRONT' as TriggerLocation, pUid, 'UNIT', instance.gamecardId, true);
    gameState.logs.push(`[${instance.fullName}] 从侵蚀区域回到了战场！`);
  }
};

const effect_10401034_hand: CardEffect = {
  id: 'seii_to_erosion',
  type: 'ACTIVATE',
  triggerLocation: ['HAND'],
  description: '【起】侵蚀区域在1-4张时，每回合一次。在你的主要阶段，此卡在手牌中：将此卡放置在侵蚀区域正面，并从卡组抽一张牌。',
  limitCount: 1,
  limitNameType: true,
  condition: (gameState: GameState, playerState: PlayerState) => {
    if (!playerState.isTurn || gameState.phase !== 'MAIN') return false;
    
    // Check total erosion count 1-4
    const totalErosion = playerState.erosionFront.filter(c => c !== null).length + 
                       playerState.erosionBack.filter(c => c !== null).length;
    if (totalErosion < 1 || totalErosion > 4) return false;

    // Check erosion front space (usually 10 total limit rule applies to checkEffectLimitsAndReqs, here we check array space)
    const emptyIdx = playerState.erosionFront.findIndex(s => s === null);
    return emptyIdx !== -1;
  },
  execute: async (gameState: GameState, playerState: PlayerState, instance: Card) => {
    const pUid = playerState.uid;
    // 1. Move to Erosion Front
    AtomicEffectExecutor.moveCard(gameState, pUid, 'HAND', pUid, 'EROSION_FRONT' as TriggerLocation, instance.gamecardId, true);
    
    // 2. Draw a card
    await AtomicEffectExecutor.execute(gameState, pUid, { type: 'DRAW_CARD', targetCount: 1 } as any);
    gameState.logs.push(`[${instance.fullName}] 进入了侵蚀区域，并从卡组抽了一张牌。`);
  }
};

const card: Card = {
  id: '10401034',
  gamecardId: null as any,
  fullName: '青衣断魂',
  specialName: '',
  type: 'UNIT',
  color: 'BLUE',
  colorReq: { 'BLUE': 1 },
  faction: '百濑之水城',
  acValue: 4,
  power: 3000,
  basePower: 3000,
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
    effect_10401034_front,
    effect_10401034_hand
  ],
  rarity: 'SR',
  availableRarities: ['SR'],
  uniqueId: null,
};

export default card;
