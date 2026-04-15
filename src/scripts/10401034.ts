import { Card, GameState, PlayerState, CardEffect, TriggerLocation, GameEvent } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';

const effect_10401034_front: CardEffect = {
  id: 'seii_from_erosion',
  type: 'ACTIVATE',
  triggerLocation: ['EROSION_FRONT'],
  description: '【启】每回合一次。在你的主要阶段，此卡在侵蚀区域正面时：将此卡放置在战场。',
  limitCount: 1,
  limitNameType: true,
  condition: (gameState: GameState, playerState: PlayerState, instance: Card) => {
    // 1. Basic Turn/Phase/Space check
    if (!playerState.isTurn || gameState.phase !== 'MAIN' || !playerState.unitZone.some(s => s === null)) return false;

    // 2. Godmark Limit Check (e.g. from 10401021 fuka_restriction)
    const currentGodmarkCount = playerState.unitZone.filter(u => u && u.godMark).length;

    // Find effective limit
    const fieldEffects = playerState.unitZone
      .filter((u: any) => u !== null)
      .flatMap((u: any) => u.effects || []);
    const limitEffect = fieldEffects.find((e: any) => e.limitGodmarkCount !== undefined);

    if (limitEffect !== undefined && currentGodmarkCount >= limitEffect.limitGodmarkCount) {
      return false;
    }

    return true;
  },
  cost: async (gameState: GameState, playerState: PlayerState, instance: Card) => {
    // 0 fee implies no cost or cost function returns true directly. 
    // In this game, if there were a resource cost, we would handle it here.
    return true;
  },
  execute: async (instance: Card, gameState: GameState, playerState: PlayerState) => {
    const pUid = playerState.uid;
    await AtomicEffectExecutor.execute(gameState, pUid, {
      type: 'MOVE_FROM_EROSION',
      targetFilter: { gamecardId: instance.gamecardId },
      destinationZone: 'UNIT'
    }, instance);
    gameState.logs.push(`[${instance.fullName}] 从侵蚀区域回到了战场！`);
  }
};

const effect_10401034_hand: CardEffect = {
  id: 'seii_to_erosion',
  type: 'ACTIVATE',
  triggerLocation: ['HAND'],
  description: '【启】侵蚀区域在1-4张时，每回合一次。在你的主要阶段，此卡在手牌中：将此卡放置在侵蚀区域正面，并从卡组抽一张牌。',
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
  execute: async (instance: Card, gameState: GameState, playerState: PlayerState) => {
    const pUid = playerState.uid;
    // 1. Move to Erosion Front
    await AtomicEffectExecutor.execute(gameState, pUid, {
      type: 'MOVE_FROM_HAND',
      targetFilter: { gamecardId: instance.gamecardId },
      destinationZone: 'EROSION_FRONT'
    }, instance);

    // 2. Draw a card
    await AtomicEffectExecutor.execute(gameState, pUid, { type: 'DRAW', value: 1 }, instance);
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
