import { Card, GameState, PlayerState, CardEffect, TriggerLocation } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';

const effect_10403016_trigger: CardEffect = {
  id: 'cocola_main_phase_trigger',
  type: 'TRIGGER',
  triggerEvent: 'PHASE_CHANGED',
  description: '【诱发】在你的主要阶段开始时，选择对手的一个非神蚀单位，在本回合中，你的单位可以攻击该单位。',
  condition: (gameState: GameState, playerState: PlayerState) => {
    return gameState.phase === 'MAIN' && playerState.isTurn;
  },
  execute: async (instance: Card, gameState: GameState, playerState: PlayerState) => {
    const opponentId = gameState.playerIds.find(id => id !== playerState.uid)!;
    const opponent = gameState.players[opponentId];
    const choices = opponent.unitZone.filter(u => u && !u.godMark) as Card[];

    if (choices.length > 0) {
      gameState.pendingQuery = {
        id: Math.random().toString(36).substring(7),
        type: 'SELECT_CARD',
        playerUid: playerState.uid,
        options: AtomicEffectExecutor.enrichQueryOptions(gameState, playerState.uid, choices.map(c => ({ card: c, source: 'UNIT' }))),
        title: '选择攻击目标',
        description: '选择一个由于此效果在本回合可以被攻击的单位。',
        minSelections: 1,
        maxSelections: 1,
        callbackKey: 'EFFECT_RESOLVE',
        context: {
          effectId: 'cocola_main_phase_trigger',
          sourceCardId: instance.gamecardId
        }
      };
    }
  },
  onQueryResolve: async (instance: Card, gameState: GameState, playerState: PlayerState, selections: string[]) => {
    if (selections.length > 0) {
      playerState.markedUnitAttackTarget = selections[0];
      const targetUnit = AtomicEffectExecutor.findCardById(gameState, selections[0]);
      gameState.logs.push(`[${instance.fullName}] 效果：本回合攻击可以指向 [${targetUnit?.fullName}]。`);
    }
  }
};

const effect_10403016_activate: CardEffect = {
  id: 'cocola_summon_cocoa',
  type: 'ACTIVATE',
  description: '【起】在女神化状态下，每回合此卡名限一次，选择侵蚀区正面的一张卡转为背面：从手牌、卡组或墓地中选择一张“可可亚”单位卡放置在战场上。',
  limitCount: 1,
  limitNameType: true,
  condition: (gameState: GameState, playerState: PlayerState) => {
    return !!playerState.isGoddessMode;
  },
  execute: async (instance: Card, gameState: GameState, playerState: PlayerState) => {
    const frontCards = playerState.erosionFront.filter(c => c && c.displayState === 'FRONT_UPRIGHT') as Card[];
    if (frontCards.length === 0) return;

    gameState.pendingQuery = {
      id: Math.random().toString(36).substring(7),
      type: 'SELECT_CARD',
      playerUid: playerState.uid,
      options: AtomicEffectExecutor.enrichQueryOptions(gameState, playerState.uid, frontCards.map(c => ({ card: c, source: 'EROSION_FRONT' }))),
      title: '选择代价',
      description: '选择一张侵蚀区正面卡转为背面作为代价。',
      minSelections: 1,
      maxSelections: 1,
      callbackKey: 'EFFECT_RESOLVE',
      context: {
        effectId: 'cocola_summon_cocoa',
        sourceCardId: instance.gamecardId,
        step: 'COST'
      }
    };
  },
  onQueryResolve: async (instance: Card, gameState: GameState, playerState: PlayerState, selections: string[], context: any) => {
    if (context.step === 'COST' && selections.length > 0) {
      // Execute Cost: Turn face down
      await AtomicEffectExecutor.execute(gameState, playerState.uid, {
        type: 'TURN_EROSION_FACE_DOWN',
        value: 1
      }, instance, undefined, selections);

      // Effect: Search Cocoa
      const searchZones: { zone: (Card | null)[], name: TriggerLocation }[] = [
        { zone: playerState.hand, name: 'HAND' },
        { zone: playerState.deck, name: 'DECK' },
        { zone: playerState.grave, name: 'GRAVE' }
      ];
      const cocoaOptions: { card: Card; source: TriggerLocation }[] = [];

      searchZones.forEach(z => {
        z.zone.forEach(c => {
          if (c && c.type === 'UNIT' && c.fullName.includes('可可亚')) {
            cocoaOptions.push({ card: c, source: z.name });
          }
        });
      });

      if (cocoaOptions.length > 0) {
        gameState.pendingQuery = {
          id: Math.random().toString(36).substring(7),
          type: 'SELECT_CARD',
          playerUid: playerState.uid,
          options: AtomicEffectExecutor.enrichQueryOptions(gameState, playerState.uid, cocoaOptions),
          title: '选择出击的可可亚',
          description: '从手牌、卡组或墓地选择一个“可可亚”单位放置在战场上。',
          minSelections: 1,
          maxSelections: 1,
          callbackKey: 'EFFECT_RESOLVE',
          context: {
            effectId: 'cocola_summon_cocoa',
            sourceCardId: instance.gamecardId,
            step: 'SUMMON'
          }
        };
      } else {
        gameState.logs.push('未发现符合条件的“可可亚”卡牌。');
      }
    } else if (context.step === 'SUMMON' && selections.length > 0) {
      const cocoaId = selections[0];
      const targetCard = AtomicEffectExecutor.findCardById(gameState, cocoaId)!;
      const sourceZone = targetCard.cardlocation as TriggerLocation;

      let type: any = 'MOVE_FROM_HAND';
      if (sourceZone === 'DECK') type = 'MOVE_FROM_DECK'; // Note: Ensure MOVE_FROM_DECK exists or use specific logic
      else if (sourceZone === 'GRAVE') type = 'MOVE_FROM_GRAVE';

      // Fallback if specific MOVE_FROM_DECK/GRAVE doesn't exist in atomic:
      // We can use moveCard but await it if it's made async, or use execute if it supports it.
      // Based on AtomicEffectExecutor, MOVE_FROM_HAND is common. Let's see if MOVE_FROM_DECK exists.
      
      await AtomicEffectExecutor.execute(gameState, playerState.uid, {
        type: (sourceZone === 'DECK' ? 'MOVE_FROM_DECK' : (sourceZone === 'GRAVE' ? 'MOVE_FROM_GRAVE' : 'MOVE_FROM_HAND')) as any,
        targetFilter: { gamecardId: cocoaId },
        destinationZone: 'UNIT'
      }, instance);

      gameState.logs.push(`[${instance.fullName}] 的效果使 [${targetCard.fullName}] 从 ${sourceZone} 出击到战场！`);

      if (sourceZone === 'DECK') {
        await AtomicEffectExecutor.execute(gameState, playerState.uid, { type: 'SHUFFLE_DECK' }, instance);
      }
    }
  }
};

const card: Card = {
  id: '10403016',
  gamecardId: null as any,
  fullName: '公会的看板娘【可可拉】',
  specialName: '可可拉',
  type: 'UNIT',
  color: 'BLUE',
  colorReq: { 'BLUE': 2 },
  faction: '冒险家公会',
  acValue: 3,
  power: 2500,
  basePower: 2500,
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
    effect_10403016_trigger,
    effect_10403016_activate
  ],
  rarity: 'PR',
  availableRarities: ['PR', 'R'],
  uniqueId: null,
};

export default card;
