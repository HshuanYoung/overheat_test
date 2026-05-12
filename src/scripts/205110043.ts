import { Card, CardEffect } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';
import { EventEngine } from '../services/EventEngine';

const effect_205110043_activate: CardEffect = {
  id: '205110043_activate',
  type: 'ACTIVATE',
  triggerLocation: ['HAND', 'PLAY'],
  erosionBackLimit: [3, 10],
  description: '创痕3。选择你的1个单位。本回合中，其视为满足10+条件，且失去启动能力。',
  execute: async (instance, gameState, playerState) => {
    const ownUnits = playerState.unitZone.filter((unit): unit is Card => !!unit);
    if (ownUnits.length === 0) {
      gameState.logs.push(`[${instance.id}] had no valid allied unit target.`);
      return;
    }

    gameState.pendingQuery = {
      id: Math.random().toString(36).substring(7),
      type: 'SELECT_CARD',
      playerUid: playerState.uid,
      options: AtomicEffectExecutor.enrichQueryOptions(
        gameState,
        playerState.uid,
        ownUnits.map(unit => ({ card: unit, source: 'UNIT' as const }))
      ),
      title: '选择单位',
      description: '选择我方1个单位。',
      minSelections: 1,
      maxSelections: 1,
      callbackKey: 'EFFECT_RESOLVE',
      context: {
        sourceCardId: instance.gamecardId,
        effectId: '205110043_activate'
      }
    };
  },
  onQueryResolve: async (instance, gameState, _playerState, selections) => {
    const target = AtomicEffectExecutor.findCardById(gameState, selections[0]);
    if (!target) return;
    const ownerUid = AtomicEffectExecutor.findCardOwnerKey(gameState, target.gamecardId);
    const owner = ownerUid ? gameState.players[ownerUid] : undefined;

    if (!(target as any).data) {
      (target as any).data = {};
    }

    (target as any).data.pseudoGoddessTenPlusTurn = gameState.turnCount;
    (target as any).data.pseudoGoddessDisableActivatedTurn = gameState.turnCount;
    EventEngine.recalculateContinuousEffects(gameState);
    gameState.logs.push(`[${instance.id}] granted pseudo-goddess mode to [${target.fullName}] for this turn.`);

    if (ownerUid && owner && !owner.isGoddessMode) {
      EventEngine.dispatchEvent(gameState, {
        type: 'GODDESS_TRANSFORMATION',
        playerUid: ownerUid,
        sourceCard: target,
        sourceCardId: target.gamecardId,
        targetCardId: target.gamecardId,
        data: {
          pseudoTenPlusTargetCardId: target.gamecardId,
          sourceCardId: instance.gamecardId
        }
      });
    }
  },
  targetSpec: {
    title: '选择单位',
    description: '选择我方1个单位。',
    minSelections: 1,
    maxSelections: 1,
    zones: ['UNIT'],
    getCandidates: (_gameState, playerState) => playerState.unitZone
      .filter((unit): unit is Card => !!unit)
      .map(card => ({ card, source: 'UNIT' as any }))
  }
};

const card: Card = {
  id: '205110043',
  fullName: '伪神化',
  specialName: '',
  type: 'STORY',
  color: 'YELLOW',
  gamecardId: null as any,
  colorReq: { YELLOW: 1 },
  faction: '学院要塞',
  acValue: 2,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  feijingMark: false,
  canResetCount: 0,
  effects: [effect_205110043_activate],
  rarity: 'U',
  availableRarities: ['U'],
  cardPackage: 'BT01',
  uniqueId: null as any,
};

export default card;
