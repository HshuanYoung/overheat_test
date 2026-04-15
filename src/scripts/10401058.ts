import { Card, GameState, PlayerState, CardEffect, GameEvent } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';

const trigger_10401058_battle: CardEffect = {
  id: '蜻蜓点击触发',
  type: 'TRIGGER',
  triggerEvent: ['CARD_ATTACK_DECLARED', 'CARD_DEFENSE_DECLARED'],
  triggerLocation: ['UNIT'],
  description: '【诱发】当此单位宣告攻击或防御时，可以选择发动：选择对手的一个非神位单位转为横置。',
  isMandatory: false,
  condition: (gameState: GameState, playerState: PlayerState, instance: Card, event?: GameEvent) => {
    // Check if this unit is the one attacking or defending
    const isSelf = event?.sourceCardId === instance.gamecardId || event?.sourceCard === instance || event?.targetCardId === instance.gamecardId;
    return isSelf === true;
  },
  execute: async (instance: Card, gameState: GameState, playerState: PlayerState) => {
    const opponentUid = Object.keys(gameState.players).find(uid => uid !== playerState.uid)!;
    const opponent = gameState.players[opponentUid];
    
    // Filter non-godmark units of opponent
    const targets = opponent.unitZone.filter(u => u && !u.godMark) as Card[];
    
    if (targets.length === 0) return;

    gameState.pendingQuery = {
      id: Math.random().toString(36).substring(7),
      type: 'SELECT_CARD',
      playerUid: playerState.uid,
      options: AtomicEffectExecutor.enrichQueryOptions(gameState, playerState.uid, targets.map(t => ({ card: t, source: 'UNIT' }))),
      title: '选择横置目标',
      description: '请选择对手的一个非神位单位转为横置。',
      minSelections: 1,
      maxSelections: 1,
      callbackKey: 'EFFECT_RESOLVE',
      context: {
        sourceCardId: instance.gamecardId,
        effectId: '蜻蜓点击触发'
      }
    };
  },
  onQueryResolve: async (instance: Card, gameState: GameState, playerState: PlayerState, selections: string[]) => {
    const targetId = selections[0];
    await AtomicEffectExecutor.execute(gameState, playerState.uid, {
      type: 'ROTATE_HORIZONTAL',
      targetFilter: { gamecardId: targetId }
    }, instance);

    const target = AtomicEffectExecutor.findCardById(gameState, targetId);
    gameState.logs.push(`[${instance.fullName}] 效果：将 [${target?.fullName}] 转为横置。`);
  }
};

const trigger_10401058_damage: CardEffect = {
  id: '云十三回场触发',
  type: 'TRIGGER',
  triggerEvent: 'COMBAT_DAMAGE_CAUSED',
  triggerLocation: ['UNIT'],
  description: '【诱发】[名称一回合一次] 当我方侵蚀区为1-4张且此卡对对手造成战斗伤害时，可以选择发动：选择我方战场上一个单位和对方战场上一个横置单位返回持有者手牌。',
  isMandatory: false,
  limitCount: 1,
  limitNameType: true,
  isGlobal: true, // Needed to check combat damage which often lacks individual source in this engine
  condition: (gameState: GameState, playerState: PlayerState, instance: Card, event?: GameEvent) => {
    // 1. Erosion count check (front + back)
    const erosionCount = playerState.erosionFront.filter(c => c !== null).length + 
                       playerState.erosionBack.filter(c => c !== null).length;
    if (erosionCount < 1 || erosionCount > 4) return false;

    // 2. Damage event check
    // Must be combat damage to opponent
    if (event?.type !== 'COMBAT_DAMAGE_CAUSED' || event.playerUid === playerState.uid) return false;

    // 3. This unit must be one of the attackers
    const isAttacking = gameState.battleState?.attackers.includes(instance.gamecardId);
    const isDirectAttack = !gameState.battleState?.defender; // Dealing damage to opponent typically means no defender

    return !!isAttacking && isDirectAttack;
  },
  execute: async (instance: Card, gameState: GameState, playerState: PlayerState) => {
    // Step 1: Select own unit
    const myUnits = playerState.unitZone.filter(u => u !== null) as Card[];
    if (myUnits.length === 0) return;

    gameState.pendingQuery = {
      id: Math.random().toString(36).substring(7),
      type: 'SELECT_CARD',
      playerUid: playerState.uid,
      options: AtomicEffectExecutor.enrichQueryOptions(gameState, playerState.uid, myUnits.map(u => ({ card: u, source: 'UNIT' }))),
      title: '选择回场单位 (我方)',
      description: '选择你战场上的一个单位返回手牌。',
      minSelections: 1,
      maxSelections: 1,
      callbackKey: 'EFFECT_RESOLVE',
      context: {
        sourceCardId: instance.gamecardId,
        effectId: '云十三回场触发',
        step: 1
      }
    };
  },
  onQueryResolve: async (instance: Card, gameState: GameState, playerState: PlayerState, selections: string[], context: any) => {
    if (context.step === 1) {
      const myTargetId = selections[0];
      
      // Step 2: Select opponent horizontal unit
      const opponentUid = Object.keys(gameState.players).find(uid => uid !== playerState.uid)!;
      const opponent = gameState.players[opponentUid];
      const oppUnits = opponent.unitZone.filter(u => u && u.isExhausted) as Card[];

      if (oppUnits.length > 0) {
        gameState.pendingQuery = {
          id: Math.random().toString(36).substring(7),
          type: 'SELECT_CARD',
          playerUid: playerState.uid,
          options: AtomicEffectExecutor.enrichQueryOptions(gameState, playerState.uid, oppUnits.map(u => ({ card: u, source: 'UNIT' }))),
          title: '选择回场单位 (对方)',
          description: '选择对手战场上的一个横置单位返回其手牌。',
          minSelections: 1,
          maxSelections: 1,
          callbackKey: 'EFFECT_RESOLVE',
          context: {
            ...context,
            myTargetId,
            step: 2
          }
        };
      } else {
        // If no opponent horizontal unit, still bounce own unit? 
        // Card says "Return one of your units AND one of the opponent's...", usually implies both must exist if it's optional choice.
        // But if user already chose to activate, let's just bounce mine. 
        // Re-reading: "Choose whether to activate: Return A and B". If B doesn't exist, can't fully fulfill A and B?
        // Usually in this game, if a part of a selection can't be made, the whole effect might fail.
        // I will make the opponent selection mandatory if the player chose to activate.
        // If no opp units, I'll just skip.
        gameState.logs.push(`[${instance.fullName}] 由于对手没有横置单位，无法完成回场动作。`);
      }
    } else if (context.step === 2) {
      const myTargetId = context.myTargetId;
      const oppTargetId = selections[0];

      // Execute both bounces
      await AtomicEffectExecutor.execute(gameState, playerState.uid, {
        type: 'MOVE_FROM_FIELD',
        targetFilter: { gamecardId: myTargetId },
        destinationZone: 'HAND'
      }, instance);

      await AtomicEffectExecutor.execute(gameState, playerState.uid, {
        type: 'MOVE_FROM_FIELD',
        targetFilter: { gamecardId: oppTargetId },
        destinationZone: 'HAND'
      }, instance);

      gameState.logs.push(`[${instance.fullName}] 效果：将双方选定的单位返回持有者手牌。`);
    }
  }
};

const card: Card = {
  id: '10401058',
  fullName: '蜻蜓点水【云十三】',
  specialName: '云十三',
  type: 'UNIT',
  color: 'BLUE',
  gamecardId: null as any,
  colorReq: { BLUE: 2 },
  faction: '百濑之水城',
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
  effects: [trigger_10401058_battle, trigger_10401058_damage],
  rarity: 'SR',
  availableRarities: ['SR'],
  uniqueId: null,
};

export default card;
