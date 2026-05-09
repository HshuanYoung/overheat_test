import { Card, CardEffect, GameEvent } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';
import { createChoiceQuery, createSelectCardQuery, getOpponentUid } from './BaseUtil';

const effect_105000471_enter: CardEffect = {
  id: '105000471_enter',
  type: 'TRIGGER',
  triggerLocation: ['UNIT'],
  triggerEvent: 'CARD_ENTERED_ZONE',
  isMandatory: true,
  description: '这个单位进入战场时，对手可以舍弃2张手牌。若如此做，破坏这个单位，并对你造成2点效果伤害。',
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
      '舍弃2张手牌？',
      '你可以舍弃2张手牌。',
      [
        { id: 'YES', label: '舍弃2张' },
        { id: 'NO', label: '不舍弃' }
      ],
      {
        sourceCardId: instance.gamecardId,
        effectId: '105000471_enter',
        step: 'ASK_DISCARD',
        controllerUid: playerState.uid,
        discardPlayerUid: opponentUid
      }
    );
  },
  onQueryResolve: async (instance, gameState, playerState, selections, context) => {
    const controllerUid = context?.controllerUid || playerState.uid;
    const discardPlayerUid = context?.discardPlayerUid || getOpponentUid(gameState, controllerUid);
    const discardPlayer = gameState.players[discardPlayerUid];

    if (context.step === 'ASK_DISCARD') {
      if (selections[0] !== 'YES' || discardPlayer.hand.length < 2) return;

      createSelectCardQuery(
        gameState,
        discardPlayerUid,
        [...discardPlayer.hand],
        '选择2张卡',
        '选择2张卡舍弃。',
        2,
        2,
        {
          sourceCardId: instance.gamecardId,
          effectId: '105000471_enter',
          step: 'DISCARD_TWO',
          controllerUid,
          discardPlayerUid
        },
        () => 'HAND'
      );
      return;
    }

    if (context.step !== 'DISCARD_TWO') return;

    for (const selectedId of selections) {
      await AtomicEffectExecutor.execute(gameState, discardPlayerUid, {
        type: 'DISCARD_CARD',
        targetFilter: { gamecardId: selectedId }
      }, instance);
    }

    await AtomicEffectExecutor.execute(gameState, controllerUid, {
      type: 'DESTROY_CARD',
      targetFilter: { gamecardId: instance.gamecardId }
    }, instance);
    await AtomicEffectExecutor.execute(gameState, controllerUid, {
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
