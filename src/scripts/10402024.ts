import { Card, CardEffect, GameEvent, GameState, PlayerState } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';
import { EventEngine } from '../services/EventEngine';

const GUILD_FACTION = '九尾商会联盟';

const hasGuildGodmarkUnit = (playerState: PlayerState) => {
  return playerState.unitZone.some(unit =>
    unit &&
    unit.godMark &&
    unit.faction === GUILD_FACTION
  );
};

const getGuardianCandidates = (playerState: PlayerState) => {
  return playerState.unitZone.filter((unit): unit is Card =>
    !!unit &&
    unit.id === '10402024' &&
    !unit.isExhausted
  );
};

const findCardOwner = (gameState: GameState, cardId: string) => {
  return Object.values(gameState.players).find(player =>
    player.unitZone.some(unit => unit?.gamecardId === cardId)
  );
};

const applyForcedGuard = async (instance: Card, target: Card, gameState: GameState, ownerState: PlayerState) => {
  if (!gameState.battleState) return;

  const liveTarget = ownerState.unitZone.find(
    (unit): unit is Card => !!unit && unit.gamecardId === target.gamecardId
  ) || target;

  await AtomicEffectExecutor.execute(gameState, ownerState.uid, {
    type: 'ROTATE_HORIZONTAL',
    targetFilter: { gamecardId: liveTarget.gamecardId }
  }, instance);

  liveTarget.isExhausted = true;

  gameState.battleState.unitTargetId = liveTarget.gamecardId;
  gameState.battleState.defender = liveTarget.gamecardId;
  gameState.battleState.defenseLockedToTargetId = liveTarget.gamecardId;
  gameState.battleState.forcedGuardTargetId = liveTarget.gamecardId;
  gameState.battleState.forcedGuardLogged = false;
  gameState.phase = 'BATTLE_FREE';
  gameState.phaseTimerStart = Date.now();

  EventEngine.recalculateContinuousEffects(gameState);
  gameState.logs.push(`[${instance.fullName}] 强制本次攻击与 [${liveTarget.fullName}] 进行战斗，跳过防御宣告。`);
};

const continuous_10402024_power_fixed: CardEffect = {
  id: '10402024_power_fixed',
  type: 'CONTINUOUS',
  triggerLocation: ['UNIT'],
  description: '【永续】这个单位的力量值不会变动。',
  applyContinuous: (_gameState: GameState, instance: Card) => {
    (instance as any).__lockPowerToBaseSourceName = instance.fullName;
  }
};

const trigger_10402024_guard: CardEffect = {
  id: '10402024_guard_trigger',
  type: 'TRIGGER',
  triggerLocation: ['UNIT'],
  triggerEvent: 'CARD_ATTACK_DECLARED',
  isGlobal: true,
  isMandatory: true,
  description: '【诱发】你的单位区有“九尾商会联盟”的神蚀单位，且这个单位为竖置状态时，对手的单位进行攻击时：对方必须攻击这张卡。这场战斗中，你其他的单位不能宣言防御。如果场上有多个单位有此效果，对方选择其中1张作为攻击对象。',
  condition: (_gameState: GameState, playerState: PlayerState, instance: Card, event?: GameEvent) => {
    if (event?.type !== 'CARD_ATTACK_DECLARED' || event.playerUid === playerState.uid) return false;
    if (instance.cardlocation !== 'UNIT' || instance.isExhausted) return false;

    const candidates = getGuardianCandidates(playerState);
    return candidates.some(card => card.gamecardId === instance.gamecardId);
  },
  execute: async (instance: Card, gameState: GameState, playerState: PlayerState, event?: GameEvent) => {
    if (!gameState.battleState || event?.playerUid === playerState.uid) return;

    const candidates = getGuardianCandidates(playerState);
    const selfOnField = playerState.unitZone.find(
      (unit): unit is Card => !!unit && unit.gamecardId === instance.gamecardId && !unit.isExhausted
    );
    const resolvedCandidates = candidates.length > 0 ? candidates : (selfOnField ? [selfOnField] : []);
    if (resolvedCandidates.length === 0) return;

    if (resolvedCandidates.length === 1) {
      await applyForcedGuard(instance, resolvedCandidates[0], gameState, playerState);
      return;
    }

    gameState.pendingQuery = {
      id: Math.random().toString(36).substring(7),
      type: 'SELECT_CARD',
      playerUid: event.playerUid!,
      options: AtomicEffectExecutor.enrichQueryOptions(
        gameState,
        event.playerUid!,
        resolvedCandidates.map(card => ({ card, source: 'UNIT' as any }))
      ),
      title: '选择攻击对象',
      description: '场上存在多个具有该效果的单位。请选择其中1张作为本次攻击对象。',
      minSelections: 1,
      maxSelections: 1,
      callbackKey: 'EFFECT_RESOLVE',
      context: {
        sourceCardId: instance.gamecardId,
        effectIndex: 1,
        step: 'SELECT_GUARD_TARGET'
      }
    };
  },
  onQueryResolve: async (instance: Card, gameState: GameState, _playerState: PlayerState, selections: string[], context: any) => {
    if (context?.step !== 'SELECT_GUARD_TARGET' || !gameState.battleState || selections.length === 0) return;

    const ownerState = findCardOwner(gameState, instance.gamecardId);
    if (!ownerState) return;

    const targetId = selections[0];
    const validTargets = getGuardianCandidates(ownerState);
    const fallbackSelf = ownerState.unitZone.find(
      (unit): unit is Card => !!unit && unit.gamecardId === instance.gamecardId && !unit.isExhausted
    );
    const resolvedTargets = validTargets.length > 0 ? validTargets : (fallbackSelf ? [fallbackSelf] : []);
    const targetCard = resolvedTargets.find(card => card.gamecardId === targetId);

    if (!targetCard) {
      gameState.logs.push(`[${instance.fullName}] 选择的攻击对象已不合法，效果结算失败。`);
      return;
    }

    await applyForcedGuard(instance, targetCard, gameState, ownerState);
  }
};

const card: Card = {
  id: '10402024',
  gamecardId: null as any,
  fullName: '牛头人盾战士',
  specialName: '',
  type: 'UNIT',
  color: 'BLUE',
  colorReq: { BLUE: 1 },
  faction: GUILD_FACTION,
  acValue: 3,
  power: 3500,
  basePower: 3500,
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
    continuous_10402024_power_fixed,
    trigger_10402024_guard
  ],
  rarity: 'R',
  availableRarities: ['R'],
  uniqueId: null,
};

export default card;
