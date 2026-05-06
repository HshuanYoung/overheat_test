import { Card, CardEffect, GameEvent, GameState, PlayerState } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';
import { EventEngine } from '../services/EventEngine';

const HOME_FACTION = '永生之乡';

const hasHomeGodmarkUnit = (playerState: PlayerState) =>
  playerState.unitZone.some(unit =>
    !!unit &&
    unit.godMark &&
    unit.faction === HOME_FACTION
  );

const getGuardianCandidates = (playerState: PlayerState) =>
  playerState.unitZone.filter((unit): unit is Card =>
    !!unit &&
    unit.id === '105120254' &&
    !unit.isExhausted
  );

const findCardOwner = (gameState: GameState, cardId: string) =>
  Object.values(gameState.players).find(player =>
    player.unitZone.some(unit => unit?.gamecardId === cardId)
  );

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

const continuous_105120254_power_fixed: CardEffect = {
  id: '105120254_power_fixed',
  type: 'CONTINUOUS',
  triggerLocation: ['UNIT'],
  description: '这个单位的力量值不会变动。',
  applyContinuous: (_gameState, instance) => {
    (instance as any).__lockPowerToBaseSourceName = instance.fullName;
  }
};

const trigger_105120254_guard: CardEffect = {
  id: '105120254_guard_trigger',
  type: 'TRIGGER',
  triggerLocation: ['UNIT'],
  triggerEvent: 'CARD_ATTACK_DECLARED',
  isGlobal: true,
  isMandatory: true,
  description: '你的单位区有“永生之乡”的神蚀单位，且这个单位为竖置状态时，对手的单位进行攻击时：对方必须攻击这张卡。这场战斗中，你其他的单位不能宣言防御。如果场上有多个单位有此效果，对方选择其中1张作为攻击对象。',
  condition: (_gameState, playerState, instance, event?: GameEvent) => {
    if (event?.type !== 'CARD_ATTACK_DECLARED' || event.playerUid === playerState.uid) return false;
    if (instance.cardlocation !== 'UNIT' || instance.isExhausted || !hasHomeGodmarkUnit(playerState)) return false;

    const candidates = getGuardianCandidates(playerState);
    return candidates.some(card => card.gamecardId === instance.gamecardId);
  },
  execute: async (instance, gameState, playerState, event?: GameEvent) => {
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
  onQueryResolve: async (instance, gameState, _playerState, selections, context) => {
    if (context?.step !== 'SELECT_GUARD_TARGET' || !gameState.battleState || selections.length === 0) return;

    const ownerState = findCardOwner(gameState, instance.gamecardId);
    if (!ownerState || !hasHomeGodmarkUnit(ownerState)) return;

    const validTargets = getGuardianCandidates(ownerState);
    const fallbackSelf = ownerState.unitZone.find(
      (unit): unit is Card => !!unit && unit.gamecardId === instance.gamecardId && !unit.isExhausted
    );
    const resolvedTargets = validTargets.length > 0 ? validTargets : (fallbackSelf ? [fallbackSelf] : []);
    const targetCard = resolvedTargets.find(card => card.gamecardId === selections[0]);

    if (!targetCard) {
      gameState.logs.push(`[${instance.fullName}] 选择的攻击对象已不合法，效果结算失败。`);
      return;
    }

    await applyForcedGuard(instance, targetCard, gameState, ownerState);
  }
};

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 105120254
 * Card2 Row: 363
 * Card Row: 294
 * Source CardNo: ST04-Y10
 * Package: ST04(TD)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 略
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '105120254',
  fullName: '炼金水晶菇',
  specialName: '',
  type: 'UNIT',
  color: 'YELLOW',
  gamecardId: null as any,
  colorReq: { YELLOW: 1 },
  faction: '永生之乡',
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
    continuous_105120254_power_fixed,
    trigger_105120254_guard
  ],
  rarity: 'U',
  availableRarities: ['U'],
  cardPackage: 'BT04',
  uniqueId: null as any,
};

export default card;
