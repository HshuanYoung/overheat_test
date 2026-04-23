import { Card, CardEffect } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';

const effect_205110043_activate: CardEffect = {
  id: '205110043_activate',
  type: 'ACTIVATE',
  triggerLocation: ['HAND', 'PLAY'],
  erosionBackLimit: [3, 10],
  description: 'Scar 3. Choose your unit. This turn it is treated as meeting 10+ requirements and loses activated abilities.',
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
      title: 'Choose A Unit',
      description: 'Choose 1 allied unit.',
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

    if (!(target as any).data) {
      (target as any).data = {};
    }

    (target as any).data.pseudoGoddessTenPlusTurn = gameState.turnCount;
    (target as any).data.pseudoGoddessDisableActivatedTurn = gameState.turnCount;
    gameState.logs.push(`[${instance.id}] granted pseudo-goddess mode to [${target.fullName}] for this turn.`);
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
