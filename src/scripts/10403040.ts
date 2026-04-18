import { Card, GameState, PlayerState, CardEffect, TriggerLocation, GameEvent } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';

const hasExistingCocolaOnField = (playerState: PlayerState) => {
  const fieldCards = [...playerState.unitZone, ...playerState.itemZone];
  return fieldCards.some(c => c && c.specialName === '可可拉');
};

const effect_10403040_kill_trigger: CardEffect = {
  id: 'cocoa_kill_trigger',
  type: 'TRIGGER',
  triggerEvent: 'CARD_DESTROYED_BATTLE',
  isGlobal: true,
  description: '【诱发】当此单位在战斗中破坏对手的单位时，选择对手的一个横置状态的非神迹单位并破坏。',
  condition: (gameState: GameState, playerState: PlayerState, instance: Card, event?: GameEvent) => {
    if (!event || !event.data || !gameState.battleState) return false;
    // Trigger if this unit was either the attacker or the defender in the battle that caused destruction
    const isParticipant = gameState.battleState.attackers.includes(instance.gamecardId) || 
                         gameState.battleState.defender === instance.gamecardId;
    // And verify the destruction target was an opponent's card
    const opponentId = gameState.playerIds.find(id => id !== playerState.uid)!;
    const isOpponentCard = event.playerUid === opponentId;

    return isParticipant && isOpponentCard;
  },
  execute: async (instance: Card, gameState: GameState, playerState: PlayerState) => {
    const opponentId = gameState.playerIds.find(id => id !== playerState.uid)!;
    const opponent = gameState.players[opponentId];

    const targets = opponent.unitZone.filter(u => u && u.isExhausted && !u.godMark) as Card[];

    if (targets.length > 0) {
      gameState.pendingQuery = {
        id: Math.random().toString(36).substring(7),
        type: 'SELECT_CARD',
        playerUid: playerState.uid,
        options: AtomicEffectExecutor.enrichQueryOptions(gameState, playerState.uid, targets.map(c => ({ card: c, source: 'UNIT' }))),
        title: '选择破坏目标',
        description: `可可亚破坏了单位，现在可以额外破坏一个横置的非神迹单位。`,
        minSelections: 1,
        maxSelections: 1,
        callbackKey: 'EFFECT_RESOLVE',
        context: {
          effectId: 'cocoa_kill_trigger',
          sourceCardId: instance.gamecardId
        }
      };
    }
  },
  onQueryResolve: async (instance: Card, gameState: GameState, playerState: PlayerState, selections: string[]) => {
    if (selections.length > 0) {
      const targetId = selections[0];

      await AtomicEffectExecutor.execute(gameState, playerState.uid, {
        type: 'DESTROY_CARD',
        targetFilter: { gamecardId: targetId }
      }, instance);

      gameState.logs.push(`[${instance.fullName}] 效果：额外的破坏了单位。`);
    }
  }
};

const effect_10403040_activate: CardEffect = {
  id: 'cocoa_summon_cocola',
  type: 'ACTIVATE',
  description: '【启】在女神化状态下，每回合此卡名限一次，选择侵蚀区正面的一张卡转为背面：从手牌、卡组或墓地中选择一张“可可拉”单位卡放置在战场上。',
  limitCount: 1,
  limitNameType: true,
  condition: (gameState: GameState, playerState: PlayerState) => {
    return !!playerState.isGoddessMode && !hasExistingCocolaOnField(playerState);
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
        effectId: 'cocoa_summon_cocola',
        sourceCardId: instance.gamecardId,
        step: 'COST'
      }
    };
  },
  onQueryResolve: async (instance: Card, gameState: GameState, playerState: PlayerState, selections: string[], context: any) => {
    if (context.step === 'COST' && selections.length > 0) {
      if (hasExistingCocolaOnField(playerState)) {
        gameState.logs.push('场上已有专用名为“可可拉”的卡牌，效果发动失败。');
        return;
      }

      await AtomicEffectExecutor.execute(gameState, playerState.uid, {
        type: 'TURN_EROSION_FACE_DOWN',
        value: 1
      }, instance, undefined, selections);

      const searchZones: { zone: (Card | null)[], name: TriggerLocation }[] = [
        { zone: playerState.hand, name: 'HAND' },
        { zone: playerState.deck, name: 'DECK' },
        { zone: playerState.grave, name: 'GRAVE' }
      ];
      const cocolaOptions: { card: Card; source: TriggerLocation }[] = [];

      searchZones.forEach(z => {
        z.zone.forEach(c => {
          if (c && c.type === 'UNIT' && c.fullName.includes('可可拉')) {
            cocolaOptions.push({ card: c, source: z.name });
          }
        });
      });

      if (cocolaOptions.length > 0) {
        gameState.pendingQuery = {
          id: Math.random().toString(36).substring(7),
          type: 'SELECT_CARD',
          playerUid: playerState.uid,
          options: AtomicEffectExecutor.enrichQueryOptions(gameState, playerState.uid, cocolaOptions),
          title: '选择出击的可可拉',
          description: '从手牌、卡组或墓地选择一个“可可拉”单位放置在战场上。',
          minSelections: 1,
          maxSelections: 1,
          callbackKey: 'EFFECT_RESOLVE',
          context: {
            effectId: 'cocoa_summon_cocola',
            sourceCardId: instance.gamecardId,
            step: 'SUMMON'
          }
        };
      } else {
        gameState.logs.push('未发现符合条件的“可可拉”卡牌。');
      }
    } else if (context.step === 'SUMMON' && selections.length > 0) {
      if (hasExistingCocolaOnField(playerState)) {
        gameState.logs.push('场上已有专用名为“可可拉”的卡牌，无法放置。');
        return;
      }

      const cocolaId = selections[0];
      // Resolve source from option context if available, otherwise fallback to find
      const sourceOption = gameState.pendingQuery?.options.find((o: any) => o.card.gamecardId === cocolaId);
      const sourceZone = (sourceOption?.source || AtomicEffectExecutor.findCardById(gameState, cocolaId)?.cardlocation) as TriggerLocation;

      await AtomicEffectExecutor.execute(gameState, playerState.uid, {
        type: (sourceZone === 'DECK' ? 'MOVE_FROM_DECK' : (sourceZone === 'GRAVE' ? 'MOVE_FROM_GRAVE' : 'MOVE_FROM_HAND')) as any,
        targetFilter: { gamecardId: cocolaId },
        destinationZone: 'UNIT'
      }, instance);

      gameState.logs.push(`[${instance.fullName}] 的效果使“可可拉”从 ${sourceZone} 出击到战场！`);

      if (sourceZone === 'DECK') {
        await AtomicEffectExecutor.execute(gameState, playerState.uid, { type: 'SHUFFLE_DECK' }, instance);
      }
    }
  }
};

const card: Card = {
  id: '10403040',
  gamecardId: null as any,
  fullName: '双子星【可可亚】',
  specialName: '可可亚',
  type: 'UNIT',
  color: 'BLUE',
  colorReq: { 'BLUE': 2 },
  faction: '冒险家公会',
  acValue: 4,
  power: 3000,
  basePower: 3000,
  damage: 3,
  baseDamage: 3,
  godMark: true,
  displayState: 'FRONT_UPRIGHT',
  isExhausted: false,
  isrush: false,
  canAttack: true,
  feijingMark: false,
  canResetCount: 0,
  effects: [
    effect_10403040_kill_trigger,
    effect_10403040_activate
  ],
  rarity: 'SR',
  availableRarities: ['SR'],
  uniqueId: null,
};

export default card;
