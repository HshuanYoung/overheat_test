import { Card, GameState, PlayerState, CardEffect, TriggerLocation, GameEvent } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';

const effect_10403051_trigger: CardEffect = {
  id: 'sodo_entry_bounce',
  type: 'TRIGGER',
  triggerType: 'CARD_EROSION_TO_FIELD',
  description: '【诱发】每回合一次。当此单位从侵蚀区域进入战场时：将此单位转为横置，并选择对手的一张单位卡牌返回持有者手牌。',
  limitCount: 1,
  limitNameType: true,
  condition: (gameState: GameState, playerState: PlayerState, instance: Card, event?: GameEvent) => {
    return event?.type === 'CARD_EROSION_TO_FIELD' && event.sourceCardId === instance.gamecardId;
  },
  execute: async (gameState: GameState, playerState: PlayerState, instance: Card) => {
    // 1. Ask if player wants to activate (Choice)
    gameState.pendingQuery = {
      id: Math.random().toString(36).substring(7),
      type: 'SELECT_CHOICE',
      playerUid: playerState.uid,
      options: [
        { id: 'YES', label: '发起 (横置此单位并回场)' },
        { id: 'NO', label: '不发起' }
      ],
      title: '效果发动确认',
      description: `是否发动 [${instance.fullName}] 的效果？发动后此单位将转为横置，并使对手单位返回手牌。`,
      callbackKey: 'EFFECT_RESOLVE',
      context: {
        effectId: 'sodo_entry_bounce',
        sourceCardId: instance.gamecardId,
        step: 'ACTIVATE_CHOICE'
      }
    };
  },
  onQueryResolve: (instance: Card, gameState: GameState, playerState: PlayerState, selections: string[], context: any) => {
    if (context.step === 'ACTIVATE_CHOICE') {
      if (selections[0] === 'YES') {
        // 1. Exhaust self
        instance.isExhausted = true;
        gameState.logs.push(`[${instance.fullName}] 进入战场并发动效果，转为横置状态。`);

        // 2. Select opponent unit to bounce
        const opponentId = gameState.playerIds.find(id => id !== playerState.uid)!;
        const opponent = gameState.players[opponentId];
        const unitTargets = opponent.unitZone.filter(u => u !== null) as Card[];

        if (unitTargets.length > 0) {
          gameState.pendingQuery = {
            id: Math.random().toString(36).substring(7),
            type: 'SELECT_CARD',
            playerUid: playerState.uid,
            options: AtomicEffectExecutor.enrichQueryOptions(gameState, playerState.uid, unitTargets.map(c => ({ card: c, source: 'UNIT' }))),
            title: '选择回场目标',
            description: '选择一张对手的单位卡牌返回持有者手牌。',
            minSelections: 1,
            maxSelections: 1,
            callbackKey: 'EFFECT_RESOLVE',
            context: {
              effectId: 'sodo_entry_bounce',
              sourceCardId: instance.gamecardId,
              step: 'BOUNCE_TARGET'
            }
          };
        } else {
          gameState.logs.push(`[${instance.fullName}] 未发现对手单位，仅转为横置。`);
        }
      } else {
        gameState.logs.push(`[${instance.fullName}] 选择了不发动效果。`);
      }
    } else if (context.step === 'BOUNCE_TARGET' && selections.length > 0) {
      const targetId = selections[0];
      const target = AtomicEffectExecutor.findCardById(gameState, targetId)!;
      const owner = AtomicEffectExecutor.findCardOwnerKey(gameState, targetId)!;
      AtomicEffectExecutor.moveCard(gameState, owner, 'UNIT', owner, 'HAND', targetId, true);
      gameState.logs.push(`[${instance.fullName}] 诱发效果：使对手的 [${target.fullName}] 返回了手牌。`);
    }
  }
};

const effect_10403051_activate: CardEffect = {
  id: 'sodo_to_erosion',
  type: 'ACTIVATE',
  triggerLocation: ['HAND'],
  description: '【起】若场上存在蓝色单位且侵蚀区域正面没有“索德”卡牌，支付0费用：将此卡从手牌放置在侵蚀区域正面，并抽一张牌。',
  condition: (gameState: GameState, playerState: PlayerState) => {
    if (!playerState.isTurn || gameState.phase !== 'MAIN') return false;

    // 1. Blue unit on field
    const hasBlueUnit = playerState.unitZone.some(u => u && u.color === 'BLUE');
    if (!hasBlueUnit) return false;

    // 2. No "索德" on erosion front
    const hasSodoOnErosion = playerState.erosionFront.some(c => c && c.fullName.includes('索德'));
    if (hasSodoOnErosion) return false;

    // 3. Erosion Front space check
    const emptyIdx = playerState.erosionFront.findIndex(s => s === null);
    return emptyIdx !== -1;
  },
  execute: async (gameState: GameState, playerState: PlayerState, instance: Card) => {
    const pUid = playerState.uid;
    // 1. Move to Erosion Front
    AtomicEffectExecutor.moveCard(gameState, pUid, 'HAND', pUid, 'EROSION_FRONT' as TriggerLocation, instance.gamecardId, true);
    
    // 2. Draw 1
    await AtomicEffectExecutor.execute(gameState, pUid, { type: 'DRAW_CARD', targetCount: 1 } as any);
    gameState.logs.push(`[${instance.fullName}] 进入侵蚀区域，并抽了一张牌。`);
  }
};

const card: Card = {
  id: '10403051',
  gamecardId: null as any,
  fullName: '一级冒险家【索德】',
  specialName: '索德',
  type: 'UNIT',
  color: 'BLUE',
  colorReq: { 'BLUE': 2 },
  faction: '冒险家公会',
  acValue: 5,
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
    effect_10403051_trigger,
    effect_10403051_activate
  ],
  rarity: 'SR',
  availableRarities: ['SR'],
  uniqueId: null,
};

export default card;
