import { Card, CardEffect, GameEvent, GameState, PlayerState } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';

const hasEnoughGuildUnits = (playerState: PlayerState) => {
  return playerState.unitZone.filter(
    (unit): unit is Card => !!unit && unit.faction === '九尾商会联盟'
  ).length >= 4;
};

const getValidTargets = (gameState: GameState, playerState: PlayerState) => {
  const opponentUid = gameState.playerIds.find(uid => uid !== playerState.uid);
  if (!opponentUid) return [] as Card[];

  return gameState.players[opponentUid].unitZone.filter(
    (unit): unit is Card => !!unit && !unit.godMark && unit.acValue <= 4
  );
};

const trigger_104020462_exhaust_targets: CardEffect = {
  id: '104020462_attack_trigger',
  type: 'TRIGGER',
  triggerLocation: ['UNIT'],
  triggerEvent: 'CARD_ATTACK_DECLARED',
  isMandatory: false,
  limitCount: 1,
  limitNameType: true,
  description: '【诱发】【卡名一回合一次】你的单位区有4个或者以上的“九尾商会联盟”的单位，这个单位攻击宣言时：你可以选择是否发动：选择对手的最多2个ACCESS+4以下的非神蚀单位，将他们横置。',
  condition: (gameState: GameState, playerState: PlayerState, instance: Card, event?: GameEvent) => {
    if (event?.type !== 'CARD_ATTACK_DECLARED') return false;
    if (event.sourceCardId !== instance.gamecardId) return false;
    if (!hasEnoughGuildUnits(playerState)) return false;
    return getValidTargets(gameState, playerState).length > 0;
  },
  execute: async (instance: Card, gameState: GameState, playerState: PlayerState) => {
    const targets = getValidTargets(gameState, playerState);
    if (targets.length === 0) return;

    if (targets.length === 1) {
      await AtomicEffectExecutor.execute(gameState, playerState.uid, {
        type: 'ROTATE_HORIZONTAL',
        targetFilter: { gamecardId: targets[0].gamecardId }
      }, instance);
      gameState.logs.push(`[${instance.fullName}] 将 [${targets[0].fullName}] 横置。`);
      return;
    }

    gameState.pendingQuery = {
      id: Math.random().toString(36).substring(7),
      type: 'SELECT_CARD',
      playerUid: playerState.uid,
      options: AtomicEffectExecutor.enrichQueryOptions(
        gameState,
        playerState.uid,
        targets.map(card => ({ card, source: 'UNIT' as any }))
      ),
      title: '选择横置目标',
      description: '请选择对手最多2个AC4以下的非神蚀单位，将它们横置。',
      minSelections: 1,
      maxSelections: Math.min(2, targets.length),
      callbackKey: 'EFFECT_RESOLVE',
      context: {
        sourceCardId: instance.gamecardId,
        effectIndex: 0,
        step: 'SELECT_TARGETS'
      }
    };
  },
  onQueryResolve: async (instance: Card, gameState: GameState, playerState: PlayerState, selections: string[], context: any) => {
    if (context?.step !== 'SELECT_TARGETS' || selections.length === 0) return;

    const validTargets = getValidTargets(gameState, playerState);
    const validTargetIds = new Set(validTargets.map(card => card.gamecardId));
    const resolvedSelections = selections.filter(targetId => validTargetIds.has(targetId)).slice(0, 2);

    if (resolvedSelections.length === 0) {
      gameState.logs.push(`[${instance.fullName}] 目标已不合法，效果结算失败。`);
      return;
    }

    for (const targetId of resolvedSelections) {
      await AtomicEffectExecutor.execute(gameState, playerState.uid, {
        type: 'ROTATE_HORIZONTAL',
        targetFilter: { gamecardId: targetId }
      }, instance);
    }

    const targetNames = resolvedSelections
      .map(targetId => AtomicEffectExecutor.findCardById(gameState, targetId)?.fullName)
      .filter((name): name is string => !!name);

    gameState.logs.push(`[${instance.fullName}] 将 ${targetNames.map(name => `[${name}]`).join('、')} 横置。`);
  }
};

const card: Card = {
  id: '104020462',
  gamecardId: null as any,
  fullName: '牛头人盟约将军【蒙】',
  specialName: '蒙',
  type: 'UNIT',
  color: 'BLUE',
  colorReq: { BLUE: 2 },
  faction: '九尾商会联盟',
  acValue: 3,
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
  effects: [trigger_104020462_exhaust_targets],
  rarity: 'R',
  availableRarities: ['R'],
  cardPackage: 'BT03',
  uniqueId: null,
};

export default card;
