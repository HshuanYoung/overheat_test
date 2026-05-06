import { Card, CardEffect } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';
import { addInfluence, createSelectCardQuery, getOpponentUid } from './BaseUtil';

const effect_105000476_continuous: CardEffect = {
  id: '105000476_continuous',
  type: 'CONTINUOUS',
  description: 'If the opponent has 2 or fewer hand cards, this unit gains Heroic and Shenyi.',
  applyContinuous: (gameState, instance) => {
    const ownerUid = AtomicEffectExecutor.findCardOwnerKey(gameState, instance.gamecardId);
    if (!ownerUid) return;

    const opponent = gameState.players[getOpponentUid(gameState, ownerUid)];
    if (!opponent || opponent.hand.length > 2) return;

    instance.isHeroic = true;
    instance.isShenyi = true;
    addInfluence(instance, instance, '获得【英勇】');
    addInfluence(instance, instance, '获得【神依】');
  }
};

const effect_105000476_activate: CardEffect = {
  id: '105000476_activate',
  type: 'ACTIVATE',
  triggerLocation: ['UNIT'],
  limitCount: 1,
  limitNameType: true,
  description: 'Main phase only. If the opponent has 3 or more hand cards, destroy 1 of your items. Then that opponent discards 1 card and takes 1 damage.',
  condition: (gameState, playerState) => {
    const opponent = gameState.players[getOpponentUid(gameState, playerState.uid)];
    return gameState.phase === 'MAIN' && !!opponent && opponent.hand.length >= 3 && playerState.itemZone.some(card => !!card);
  },
  execute: async (instance, gameState, playerState) => {
    const ownItems = playerState.itemZone.filter((card): card is Card => !!card);
    createSelectCardQuery(
      gameState,
      playerState.uid,
      ownItems,
      'Choose An Item',
      'Choose 1 of your items to destroy.',
      1,
      1,
      { sourceCardId: instance.gamecardId, effectId: '105000476_activate', step: 'DESTROY_ITEM' }
    );
  },
  onQueryResolve: async (instance, gameState, playerState, selections, context) => {
    if (context.step === 'DESTROY_ITEM') {
      await AtomicEffectExecutor.execute(gameState, playerState.uid, {
        type: 'DESTROY_CARD',
        targetFilter: { gamecardId: selections[0], type: 'ITEM' }
      }, instance);

      const opponentUid = getOpponentUid(gameState, playerState.uid);
      const opponent = gameState.players[opponentUid];
      if (opponent.hand.length === 0) {
        await AtomicEffectExecutor.execute(gameState, playerState.uid, {
          type: 'DEAL_EFFECT_DAMAGE',
          value: 1
        }, instance);
        return;
      }

      createSelectCardQuery(
        gameState,
        opponentUid,
        [...opponent.hand],
        'Discard A Card',
        'Choose 1 card from your hand to discard.',
        1,
        1,
        { sourceCardId: instance.gamecardId, effectId: '105000476_activate', step: 'OPPONENT_DISCARD' },
        () => 'HAND'
      );
      return;
    }

    if (context.step !== 'OPPONENT_DISCARD') return;

    const opponentUid = getOpponentUid(gameState, playerState.uid);
    await AtomicEffectExecutor.execute(gameState, opponentUid, {
      type: 'DISCARD_CARD',
      targetFilter: { gamecardId: selections[0] }
    }, instance);
    await AtomicEffectExecutor.execute(gameState, playerState.uid, {
      type: 'DEAL_EFFECT_DAMAGE',
      value: 1
    }, instance);
  }
};

const card: Card = {
  id: '105000476',
  fullName: '惊奇的魔术家「库因塔」',
  specialName: '库因塔',
  type: 'UNIT',
  color: 'YELLOW',
  gamecardId: null as any,
  colorReq: { YELLOW: 2 },
  faction: '无',
  acValue: 4,
  power: 3500,
  basePower: 3500,
  damage: 3,
  baseDamage: 3,
  godMark: true,
  displayState: 'FRONT_UPRIGHT',
  isExhausted: false,
  isrush: false,
  baseIsrush: false,
  isHeroic: false,
  baseHeroic: false,
  isShenyi: false,
  baseShenyi: false,
  canAttack: true,
  feijingMark: false,
  canResetCount: 0,
  effects: [effect_105000476_continuous, effect_105000476_activate],
  rarity: 'SR',
  availableRarities: ['SR'],
  cardPackage: 'BT03',
  uniqueId: null as any,
};

export default card;
