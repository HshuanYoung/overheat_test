import { Card, CardEffect, GameEvent } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';
import { createChoiceQuery, createSelectCardQuery, getOpponentUid } from './BaseUtil';

const effect_105000471_enter: CardEffect = {
  id: '105000471_enter',
  type: 'TRIGGER',
  triggerLocation: ['UNIT'],
  triggerEvent: 'CARD_ENTERED_ZONE',
  isMandatory: true,
  description: 'When this unit enters the battlefield, the opponent may discard 2 cards. If they do, destroy this unit and deal 2 effect damage to you.',
  condition: (_gameState, _playerState, instance, event?: GameEvent) =>
    instance.cardlocation === 'UNIT' &&
    event?.type === 'CARD_ENTERED_ZONE' &&
    event.sourceCardId === instance.gamecardId &&
    event.data?.zone === 'UNIT',
  execute: async (instance, gameState, playerState) => {
    const opponentUid = getOpponentUid(gameState, playerState.uid);
    const opponent = gameState.players[opponentUid];
    if (opponent.hand.length < 2) return;

    createChoiceQuery(
      gameState,
      opponentUid,
      'Discard 2 Cards?',
      'You may discard 2 cards from your hand.',
      [
        { id: 'YES', label: 'Discard 2' },
        { id: 'NO', label: 'Do Not Discard' }
      ],
      { sourceCardId: instance.gamecardId, effectId: '105000471_enter', step: 'ASK_DISCARD' }
    );
  },
  onQueryResolve: async (instance, gameState, playerState, selections, context) => {
    const opponentUid = getOpponentUid(gameState, playerState.uid);
    const opponent = gameState.players[opponentUid];

    if (context.step === 'ASK_DISCARD') {
      if (selections[0] !== 'YES' || opponent.hand.length < 2) return;

      createSelectCardQuery(
        gameState,
        opponentUid,
        [...opponent.hand],
        'Choose 2 Cards',
        'Choose 2 cards to discard.',
        2,
        2,
        { sourceCardId: instance.gamecardId, effectId: '105000471_enter', step: 'DISCARD_TWO' },
        () => 'HAND'
      );
      return;
    }

    if (context.step !== 'DISCARD_TWO') return;

    for (const selectedId of selections) {
      await AtomicEffectExecutor.execute(gameState, opponentUid, {
        type: 'DISCARD_CARD',
        targetFilter: { gamecardId: selectedId }
      }, instance);
    }

    await AtomicEffectExecutor.execute(gameState, playerState.uid, {
      type: 'DESTROY_CARD',
      targetFilter: { gamecardId: instance.gamecardId }
    }, instance);
    await AtomicEffectExecutor.execute(gameState, playerState.uid, {
      type: 'DEAL_EFFECT_DAMAGE_SELF',
      value: 2
    }, instance);
  }
};

const card: Card = {
  id: '105000471',
  fullName: '暗市交易师',
  specialName: '',
  type: 'UNIT',
  color: 'YELLOW',
  gamecardId: null as any,
  colorReq: { YELLOW: 1 },
  faction: '无',
  acValue: 2,
  power: 3000,
  basePower: 3000,
  damage: 2,
  baseDamage: 2,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  isExhausted: false,
  isrush: false,
  baseIsrush: false,
  canAttack: true,
  feijingMark: false,
  canResetCount: 0,
  effects: [effect_105000471_enter],
  rarity: 'U',
  availableRarities: ['U'],
  cardPackage: 'BT03',
  uniqueId: null as any,
};

export default card;
