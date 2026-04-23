import { Card, CardEffect, GameEvent } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';
import { createSelectCardQuery, getOpponentUid } from './_bt02YellowUtils';

const effect_105120165_forced_attack: CardEffect = {
  id: '105120165_forced_attack',
  type: 'TRIGGER',
  triggerLocation: ['UNIT'],
  triggerEvent: 'CARD_ENTERED_ZONE',
  limitCount: 1,
  limitNameType: true,
  description: 'If this unit enters from deck by an alchemy effect, choose an opponent unit. Until the end of that player next turn, it must attack when able.',
  condition: (_gameState, _playerState, instance, event?: GameEvent) =>
    instance.cardlocation === 'UNIT' &&
    event?.type === 'CARD_ENTERED_ZONE' &&
    event.sourceCardId === instance.gamecardId &&
    event.data?.zone === 'UNIT' &&
    (instance as any).data?.enteredFromDeckByAlchemyTurn !== undefined &&
    (instance as any).data?.lastMovedFromZone === 'DECK' &&
    (instance as any).data?.lastMovedToZone === 'UNIT',
  execute: async (instance, gameState, playerState) => {
    const opponent = gameState.players[getOpponentUid(gameState, playerState.uid)];
    const targets = opponent.unitZone.filter((card): card is Card => !!card);
    if (targets.length === 0) return;

    createSelectCardQuery(
      gameState,
      playerState.uid,
      targets,
      'Choose An Opponent Unit',
      'Choose 1 opponent unit that will be forced to attack next turn.',
      1,
      1,
      { sourceCardId: instance.gamecardId, effectId: '105120165_forced_attack' }
    );
  },
  onQueryResolve: async (instance, gameState, _playerState, selections) => {
    const target = AtomicEffectExecutor.findCardById(gameState, selections[0]);
    if (!target) return;

    (target as any).data = {
      ...((target as any).data || {}),
      forcedAttackTurn: gameState.turnCount + 1,
      forcedAttackSourceName: instance.fullName
    };
  }
};

const card: Card = {
  id: '105120165',
  fullName: '炼金兽 丽人花',
  specialName: '',
  type: 'UNIT',
  color: 'YELLOW',
  gamecardId: null as any,
  colorReq: {},
  faction: '永生之乡',
  acValue: 2,
  power: 2000,
  basePower: 2000,
  damage: 1,
  baseDamage: 1,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  isExhausted: false,
  isrush: false,
  canAttack: true,
  feijingMark: false,
  canResetCount: 0,
  effects: [effect_105120165_forced_attack],
  rarity: 'C',
  availableRarities: ['C'],
  cardPackage: 'BT02,ST04',
  uniqueId: null as any,
};

export default card;
