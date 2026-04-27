import { Card, CardEffect, GameEvent } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';
import { createSelectCardQuery, getOpponentUid } from './BaseUtil';

const effect_105000475_temp: CardEffect = {
  id: '105000475_temp',
  type: 'CONTINUOUS',
  description: 'This unit gains Shenyi this turn if its enter effect discarded a unit.',
  applyContinuous: (gameState, instance) => {
    if ((instance as any).data?.bt03Y09BuffTurn !== gameState.turnCount) return;
    instance.isShenyi = true;
  }
};

const effect_105000475_enter: CardEffect = {
  id: '105000475_enter',
  type: 'TRIGGER',
  triggerLocation: ['UNIT'],
  triggerEvent: 'CARD_ENTERED_ZONE',
  isMandatory: true,
  description: 'When this unit enters the battlefield, you may destroy your item. Then the opponent discards 1 card. If it was a unit, this unit gains Rush and Shenyi this turn. Otherwise all players take 1 damage.',
  condition: (_gameState, _playerState, instance, event?: GameEvent) =>
    instance.cardlocation === 'UNIT' &&
    event?.type === 'CARD_ENTERED_ZONE' &&
    event.sourceCardId === instance.gamecardId &&
    event.data?.zone === 'UNIT',
  execute: async (instance, gameState, playerState) => {
    const ownItems = playerState.itemZone.filter((card): card is Card => !!card);
    if (ownItems.length > 0) {
      createSelectCardQuery(
        gameState,
        playerState.uid,
        ownItems,
        'Choose Up To 1 Item',
        'You may choose 1 of your items to destroy.',
        0,
        1,
        { sourceCardId: instance.gamecardId, effectId: '105000475_enter', step: 'DESTROY_ITEM' }
      );
      return;
    }

    const opponentUid = getOpponentUid(gameState, playerState.uid);
    const opponent = gameState.players[opponentUid];
    if (opponent.hand.length === 0) return;

    createSelectCardQuery(
      gameState,
      opponentUid,
      [...opponent.hand],
      'Discard A Card',
      'Choose 1 card from your hand to discard.',
      1,
      1,
      { sourceCardId: instance.gamecardId, effectId: '105000475_enter', step: 'OPPONENT_DISCARD' },
      () => 'HAND'
    );
  },
  onQueryResolve: async (instance, gameState, playerState, selections, context) => {
    if (context.step === 'DESTROY_ITEM') {
      if (selections.length === 1) {
        await AtomicEffectExecutor.execute(gameState, playerState.uid, {
          type: 'DESTROY_CARD',
          targetFilter: { gamecardId: selections[0], type: 'ITEM' }
        }, instance);
      }

      const opponentUid = getOpponentUid(gameState, playerState.uid);
      const opponent = gameState.players[opponentUid];
      if (opponent.hand.length === 0) return;

      createSelectCardQuery(
        gameState,
        opponentUid,
        [...opponent.hand],
        'Discard A Card',
        'Choose 1 card from your hand to discard.',
        1,
        1,
        { sourceCardId: instance.gamecardId, effectId: '105000475_enter', step: 'OPPONENT_DISCARD' },
        () => 'HAND'
      );
      return;
    }

    if (context.step !== 'OPPONENT_DISCARD' || selections.length === 0) return;

    const opponentUid = getOpponentUid(gameState, playerState.uid);
    const discardedCard = AtomicEffectExecutor.findCardById(gameState, selections[0]);
    const wasUnit = discardedCard?.type === 'UNIT';

    await AtomicEffectExecutor.execute(gameState, opponentUid, {
      type: 'DISCARD_CARD',
      targetFilter: { gamecardId: selections[0] }
    }, instance);

    if (wasUnit) {
      await AtomicEffectExecutor.execute(gameState, playerState.uid, {
        type: 'GAIN_KEYWORD',
        params: { keyword: 'RUSH' },
        turnDuration: 1,
        targetFilter: { gamecardId: instance.gamecardId }
      }, instance);
      (instance as any).data = {
        ...((instance as any).data || {}),
        bt03Y09BuffTurn: gameState.turnCount
      };
      return;
    }

    await AtomicEffectExecutor.execute(gameState, playerState.uid, { type: 'DEAL_EFFECT_DAMAGE', value: 1 }, instance);
    await AtomicEffectExecutor.execute(gameState, playerState.uid, { type: 'DEAL_EFFECT_DAMAGE_SELF', value: 1 }, instance);
  }
};

const card: Card = {
  id: '105000475',
  fullName: '幻想舞台的易形师',
  specialName: '',
  type: 'UNIT',
  color: 'YELLOW',
  gamecardId: null as any,
  colorReq: { YELLOW: 1 },
  faction: '无',
  acValue: 3,
  power: 2500,
  basePower: 2500,
  damage: 2,
  baseDamage: 2,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  isExhausted: false,
  isrush: false,
  baseIsrush: false,
  isShenyi: false,
  baseShenyi: false,
  canAttack: true,
  feijingMark: false,
  canResetCount: 0,
  effects: [effect_105000475_temp, effect_105000475_enter],
  rarity: 'R',
  availableRarities: ['R'],
  cardPackage: 'BT03',
  uniqueId: null as any,
};

export default card;
