import { Card, CardEffect, GameEvent } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';
import { createChoiceQuery, createSelectCardQuery, getBattlefieldUnits, isVirtualGodMarkReveal, revealDeckCards } from './BaseUtil';

const readySelfIfNeeded = (instance: Card, gameState: any, revealedCardId?: string) => {
  const revealedCard = revealedCardId ? AtomicEffectExecutor.findCardById(gameState, revealedCardId) : undefined;
  if (!isVirtualGodMarkReveal(gameState, revealedCard)) return;
  instance.isExhausted = false;
};

const effect_105110467_attack: CardEffect = {
  id: '105110467_attack',
  type: 'TRIGGER',
  triggerLocation: ['UNIT'],
  triggerEvent: 'CARD_ATTACK_DECLARED',
  limitCount: 1,
  limitNameType: true,
  isMandatory: true,
  description: 'When this unit attacks, shuffle your deck and reveal the top card. Resolve its result, then if it is a god-mark card, ready this unit.',
  condition: (_gameState, _playerState, instance, event?: GameEvent) =>
    instance.cardlocation === 'UNIT' &&
    event?.type === 'CARD_ATTACK_DECLARED' &&
    Array.isArray(event.data?.attackerIds) &&
    event.data.attackerIds.includes(instance.gamecardId),
  execute: async (instance, gameState, playerState) => {
    await AtomicEffectExecutor.execute(gameState, playerState.uid, { type: 'SHUFFLE_DECK' }, instance);
    const revealedCard = revealDeckCards(gameState, playerState.uid, 1, instance)[0];
    if (!revealedCard) return;

    if (revealedCard.type !== 'UNIT') {
      const current = gameState.battleState?.defenseMaxPowerRestriction;
      gameState.battleState!.defenseMaxPowerRestriction = current === undefined ? 3000 : Math.min(current, 3000);
      readySelfIfNeeded(instance, gameState, revealedCard.gamecardId);
      return;
    }

    const targets = getBattlefieldUnits(gameState).filter(unit => unit.gamecardId !== instance.gamecardId);
    if (targets.length === 0) {
      readySelfIfNeeded(instance, gameState, revealedCard.gamecardId);
      return;
    }

    createSelectCardQuery(
      gameState,
      playerState.uid,
      targets,
      'Choose A Unit',
      'Choose another unit on the battlefield.',
      1,
      1,
      {
        sourceCardId: instance.gamecardId,
        effectId: '105110467_attack',
        step: 'SELECT_TARGET',
        revealedCardId: revealedCard.gamecardId
      }
    );
  },
  onQueryResolve: async (instance, gameState, _playerState, selections, context) => {
    if (context.step === 'SELECT_TARGET') {
      createChoiceQuery(
        gameState,
        _playerState.uid,
        'Choose Rotation',
        'Rotate the chosen unit horizontally or vertically.',
        [
          { id: 'HORIZONTAL', label: 'Rotate Horizontal' },
          { id: 'VERTICAL', label: 'Rotate Vertical' }
        ],
        {
          sourceCardId: instance.gamecardId,
          effectId: '105110467_attack',
          step: 'ROTATE_TARGET',
          targetId: selections[0],
          revealedCardId: context.revealedCardId
        }
      );
      return;
    }

    if (context.step !== 'ROTATE_TARGET') return;

    await AtomicEffectExecutor.execute(gameState, _playerState.uid, {
      type: selections[0] === 'HORIZONTAL' ? 'ROTATE_HORIZONTAL' : 'ROTATE_VERTICAL',
      targetFilter: { gamecardId: context.targetId }
    }, instance);

    readySelfIfNeeded(instance, gameState, context.revealedCardId);
  }
};

const card: Card = {
  id: '105110467',
  fullName: '魔偶姬「斯蒂芬妮」',
  specialName: '斯蒂芬妮',
  type: 'UNIT',
  color: 'YELLOW',
  gamecardId: null as any,
  colorReq: { YELLOW: 2 },
  faction: '学院要塞',
  acValue: 4,
  power: 3000,
  basePower: 3000,
  damage: 3,
  baseDamage: 3,
  godMark: true,
  displayState: 'FRONT_UPRIGHT',
  isExhausted: false,
  isrush: false,
  baseIsrush: false,
  canAttack: true,
  feijingMark: false,
  canResetCount: 0,
  effects: [effect_105110467_attack],
  rarity: 'SR',
  availableRarities: ['SR'],
  cardPackage: 'BT03',
  uniqueId: null as any,
};

export default card;
