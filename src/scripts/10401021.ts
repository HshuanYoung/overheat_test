import { Card, GameState, PlayerState, CardEffect, TriggerLocation, GameEvent } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';

const effect_10401021_continuous: CardEffect = {
  id: 'fuka_restriction',
  type: 'CONTINUOUS',
  description: '【持续】你的单位区只能存在一个神蚀单位。',
  limitGodmarkCount: 1
};

const effect_10401021_trigger: CardEffect = {
  id: 'fuka_end_turn_bounce',
  type: 'TRIGGER',
  triggerEvent: 'TURN_END',
  description: '【诱】在你的回合结束时，如果你的战场上只有蓝色单位，你可以选择发动：选择对手战场上一个AC<=2且非神迹的卡牌返回持有者手牌。',
  condition: (gameState: GameState, playerState: PlayerState, instance: Card) => {
    if (!playerState.isTurn) return false;
    const units = playerState.unitZone.filter(u => u !== null) as Card[];
    if (units.length === 0 || !units.every(u => AtomicEffectExecutor.matchesColor(u, 'BLUE'))) return false;

    // Target Check: Opponent must have a valid card to bounce
    const opponentId = gameState.playerIds.find(id => id !== playerState.uid)!;
    const opponent = gameState.players[opponentId];
    const maxAc = 2;
    const targets = [...opponent.unitZone, ...opponent.itemZone].filter(c =>
      c && !c.godMark && (c.acValue || 0) <= maxAc
    );
    return targets.length > 0;
  },
  execute: async (instance: Card, gameState: GameState, playerState: PlayerState) => {
    const opponentId = gameState.playerIds.find(id => id !== playerState.uid)!;
    const opponent = gameState.players[opponentId];
    const maxAc = 2;

    const targets = [...opponent.unitZone, ...opponent.itemZone].filter(c =>
      c && !c.godMark && (c.acValue || 0) <= maxAc
    ) as Card[];

    if (targets.length > 0) {
      gameState.pendingQuery = {
        id: Math.random().toString(36).substring(7),
        type: 'SELECT_CARD',
        playerUid: playerState.uid,
        options: AtomicEffectExecutor.enrichQueryOptions(gameState, playerState.uid, targets.map(c => ({
          card: c,
          source: opponent.unitZone.includes(c) ? 'UNIT' : 'ITEM'
        }))),
        title: '选择回场目标',
        description: `【浪漫歌月】诱发效果：选择一个AC ${maxAc} 以下的非神迹卡牌返回手牌。`,
        minSelections: 0,
        maxSelections: 1,
        callbackKey: 'EFFECT_RESOLVE',
        context: {
          effectId: 'fuka_end_turn_bounce',
          sourceCardId: instance.gamecardId
        }
      };
    }
  },
  onQueryResolve: async (instance: Card, gameState: GameState, playerState: PlayerState, selections: string[]) => {
    if (selections.length > 0) {
      const targetId = selections[0];
      const target = AtomicEffectExecutor.findCardById(gameState, targetId);
      if (target) {
        const ownerUid = AtomicEffectExecutor.findCardOwnerKey(gameState, targetId)!;
        await AtomicEffectExecutor.execute(gameState, ownerUid, {
          type: 'MOVE_FROM_FIELD',
          targetFilter: { gamecardId: targetId },
          destinationZone: 'HAND'
        }, instance);
        gameState.logs.push(`[${instance.fullName}] 诱发效果：使对手的 [${target.fullName}] 返回了手牌。`);
      }
    }
  }
};

const effect_10401021_activate: CardEffect = {
  id: 'fuka_exile_bounce',
  type: 'ACTIVATE',
  triggerLocation: ['UNIT'],
  description: '【启】每回合此卡名限一次，从你的手牌、卡组或墓地中将两张“风花”神迹卡牌移出对战，且仅在你的主要阶段可以发动：选择一张横置状态的单位或道具卡牌（不包括该单位本身）返回其持有者手牌。',
  limitCount: 1,
  limitNameType: true,
  condition: (gameState: GameState, playerState: PlayerState, instance: Card) => {
    if (!playerState.isTurn || gameState.phase !== 'MAIN') return false;

    // Search for '风花' godmark cards in Hand, Deck, Grave (excluding this one)
    const zones = [playerState.hand, playerState.deck, playerState.grave];
    let count = 0;
    zones.forEach(zone => {
      zone.forEach(c => {
        if (c && c.fullName.includes('风花') && c.godMark && c.gamecardId !== instance.gamecardId) {
          count++;
        }
      });
    });

    return count >= 2;
  },
  execute: async (instance: Card, gameState: GameState, playerState: PlayerState) => {
    // Search for '风花' godmark cards in Hand, Deck, Grave (excluding this one)
    const zones: { zone: (Card | null)[], name: TriggerLocation }[] = [
      { zone: playerState.hand, name: 'HAND' },
      { zone: playerState.deck, name: 'DECK' },
      { zone: playerState.grave, name: 'GRAVE' }
    ];
    const options: { card: Card; source: TriggerLocation }[] = [];
    zones.forEach(z => {
      z.zone.forEach(c => {
        if (c && c.fullName.includes('风花') && c.godMark && c.gamecardId !== instance.gamecardId) {
          options.push({ card: c, source: z.name });
        }
      });
    });

    gameState.pendingQuery = {
      id: Math.random().toString(36).substring(7),
      type: 'SELECT_CARD',
      playerUid: playerState.uid,
      options: AtomicEffectExecutor.enrichQueryOptions(gameState, playerState.uid, options),
      title: '选择移出对战的卡牌',
      description: '选择两张“风花”神迹卡移出对战作为代价。',
      minSelections: 2,
      maxSelections: 2,
      callbackKey: 'EFFECT_RESOLVE',
      context: {
        effectId: 'fuka_exile_bounce',
        sourceCardId: instance.gamecardId,
        step: 'COST'
      }
    };
  },
  onQueryResolve: async (instance: Card, gameState: GameState, playerState: PlayerState, selections: string[], context: any) => {
    if (context.step === 'COST' && selections.length === 2) {
      // Execute Cost: Exile
      for (const id of selections) {
        const owner = AtomicEffectExecutor.findCardOwnerKey(gameState, id)!;
        await AtomicEffectExecutor.execute(gameState, owner, {
          type: 'BANISH_CARD',
          targetFilter: { gamecardId: id }
        }, instance);
      }
      gameState.logs.push(`[${instance.fullName}] 支付发动代价：将两张“风花”卡牌移出对战。`);

      // Effect: select horizontal unit/item (not self)
      const allUnitsItems: { card: Card; source: TriggerLocation }[] = [];
      Object.values(gameState.players).forEach(p => {
        p.unitZone.forEach(u => {
          if (u && u.isExhausted && u.gamecardId !== instance.gamecardId) {
            allUnitsItems.push({ card: u, source: 'UNIT' });
          }
        });
        p.itemZone.forEach(i => {
          if (i && i.isExhausted) {
            allUnitsItems.push({ card: i, source: 'ITEM' });
          }
        });
      });

      if (allUnitsItems.length > 0) {
        gameState.pendingQuery = {
          id: Math.random().toString(36).substring(7),
          type: 'SELECT_CARD',
          playerUid: playerState.uid,
          options: AtomicEffectExecutor.enrichQueryOptions(gameState, playerState.uid, allUnitsItems),
          title: '选择回场目标',
          description: '选择一张横置的单位或道具返回持有者手牌。',
          minSelections: 1,
          maxSelections: 1,
          callbackKey: 'EFFECT_RESOLVE',
          context: {
            effectId: 'fuka_exile_bounce',
            sourceCardId: instance.gamecardId,
            step: 'BOUNCE'
          }
        };
      } else {
        gameState.logs.push(`[${instance.fullName}] 未发现可选择的横置目标。`);
      }
    } else if (context.step === 'BOUNCE' && selections.length > 0) {
      const targetId = selections[0];
      const owner = AtomicEffectExecutor.findCardOwnerKey(gameState, targetId)!;
      const target = AtomicEffectExecutor.findCardById(gameState, targetId)!;
      await AtomicEffectExecutor.execute(gameState, owner, {
        type: 'MOVE_FROM_FIELD',
        targetFilter: { gamecardId: targetId },
        destinationZone: 'HAND'
      }, instance);
      gameState.logs.push(`[${instance.fullName}] 激活效果：使 [${target.fullName}] 返回了手牌。`);
    }

    if (context.step === 'BOUNCE' || (context.step === 'COST' && selections.length === 2)) {
      // Shuffle if cost from deck? The search logic spans multiple zones.
      // However, searching typically requires shuffling.
      await AtomicEffectExecutor.execute(gameState, playerState.uid, { type: 'SHUFFLE_DECK' }, instance);
    }
  }
};

const card: Card = {
  id: '10401021',
  gamecardId: null as any,
  fullName: '浪漫歌月【风花】',
  specialName: '风花',
  type: 'UNIT',
  color: 'BLUE',
  colorReq: { 'BLUE': 2 },
  faction: '百濑之水城',
  acValue: 5,
  power: 3500,
  basePower: 3500,
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
    effect_10401021_continuous,
    effect_10401021_trigger,
    effect_10401021_activate
  ],
  rarity: 'SER',
  availableRarities: ['SER'],
  uniqueId: null,
};

export default card;
