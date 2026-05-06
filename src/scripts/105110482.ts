import { Card, CardEffect } from '../types/game';
import { AtomicEffectExecutor, addContinuousDamage, addContinuousPower, canActivateDuringYourTurn, canPutItemOntoBattlefield, createChoiceQuery, createSelectCardQuery, moveCard, ownItems, revealDeckCards } from './BaseUtil';

const cardEffects: CardEffect[] = [{
  id: '105110482_item_boost',
  type: 'CONTINUOUS',
  triggerLocation: ['UNIT'],
  description: '若你的战场上的道具卡有2张以上，这个单位伤害+1、力量+1000。',
  applyContinuous: (gameState, instance) => {
    const owner = Object.values(gameState.players).find(player => player.unitZone.some(unit => unit?.gamecardId === instance.gamecardId));
    if (owner && ownItems(owner).length >= 2) {
      addContinuousDamage(instance, instance, 1);
      addContinuousPower(instance, instance, 1000);
    }
  }
}, {
  id: '105110482_play_erosion_item',
  type: 'ACTIVATE',
  triggerLocation: ['UNIT'],
  limitCount: 1,
  description: '1回合1次：主要阶段，支付ACCESS值来使用你的侵蚀区中的1张道具卡。',
  condition: (gameState, playerState) =>
    playerState.isTurn &&
    gameState.phase === 'MAIN' &&
    [...playerState.erosionFront, ...playerState.erosionBack]
      .some(card => card?.type === 'ITEM' && canPutItemOntoBattlefield(playerState, card)),
  execute: async (instance, gameState, playerState) => {
    const candidates = [...playerState.erosionFront, ...playerState.erosionBack]
      .filter((card): card is Card => !!card && card.type === 'ITEM' && canPutItemOntoBattlefield(playerState, card));
    createSelectCardQuery(gameState, playerState.uid, candidates, '选择使用的侵蚀区道具', '选择你的侵蚀区中的1张道具卡，支付其ACCESS值并放置到战场。', 1, 1, {
      sourceCardId: instance.gamecardId,
      effectId: '105110482_play_erosion_item',
      step: 'TARGET'
    }, card => card.cardlocation as any);
  },
  onQueryResolve: async (instance, gameState, playerState, selections, context) => {
    if (context?.step === 'TARGET') {
      const target = selections[0] ? AtomicEffectExecutor.findCardById(gameState, selections[0]) : undefined;
      if (!target || target.type !== 'ITEM') return;
      gameState.pendingQuery = {
        id: Math.random().toString(36).substring(7),
        type: 'SELECT_PAYMENT',
        playerUid: playerState.uid,
        options: [],
        title: '支付道具费用',
        description: `支付 ${target.acValue || 0} 费以使用 [${target.fullName}]。`,
        minSelections: 1,
        maxSelections: 1,
        callbackKey: 'EFFECT_RESOLVE',
        paymentCost: target.acValue || 0,
        paymentColor: target.color,
        context: {
          sourceCardId: instance.gamecardId,
          effectId: '105110482_play_erosion_item',
          step: 'PAYMENT',
          targetId: target.gamecardId,
          useEffectiveCardCost: false
        }
      };
      return;
    }
    if (context?.step === 'PAYMENT') {
      const target = context.targetId ? AtomicEffectExecutor.findCardById(gameState, context.targetId) : undefined;
      if (target && (target.cardlocation === 'EROSION_FRONT' || target.cardlocation === 'EROSION_BACK') && target.type === 'ITEM') {
        moveCard(gameState, playerState.uid, target, 'ITEM', instance);
      }
    }
  }
}, {
  id: '105110482_reveal_top',
  type: 'ACTIVATE',
  triggerLocation: ['UNIT'],
  limitCount: 1,
  description: '1回合1次：你的回合，公开卡组顶1张卡，将那张卡放置到卡组顶或卡组底。',
  condition: (gameState, playerState) =>
    canActivateDuringYourTurn(gameState, playerState) &&
    playerState.deck.length > 0,
  execute: async (instance, gameState, playerState) => {
    revealDeckCards(gameState, playerState.uid, 1, instance);
    createChoiceQuery(
      gameState,
      playerState.uid,
      '选择放置位置',
      '将公开的卡牌放置到卡组顶或卡组底。',
      [
        { id: 'TOP', label: '卡组顶' },
        { id: 'BOTTOM', label: '卡组底' }
      ],
      { sourceCardId: instance.gamecardId, effectId: '105110482_reveal_top' }
    );
  },
  onQueryResolve: async (instance, gameState, playerState, selections) => {
    if (selections[0] !== 'BOTTOM') return;
    const top = playerState.deck[playerState.deck.length - 1];
    if (top) moveCard(gameState, playerState.uid, top, 'DECK', instance, { insertAtBottom: true });
  }
}];

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 105110482
 * Card2 Row: 270
 * Card Row: 626
 * Source CardNo: PR01-02Y
 * Package: 特殊(PR)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 【永】:若你的战场上的道具卡有2张以上的话，这个单位〖伤害+1〗〖力量+1000〗。
 * 【启】〖1回合1次〗:你的主要阶段中才可以发动，且不能用于对抗。支付ACCESS值来使用你的侵蚀区中的1张道具卡。
 * 【启】〖1回合1次〗:你的回合中才可以发动。公开你的卡组顶的1张卡，将那张卡放置到卡组顶或卡组底。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '105110482',
  fullName: '辅助官「希克」pr',
  specialName: '希克',
  type: 'UNIT',
  color: 'YELLOW',
  gamecardId: null as any,
  colorReq: { YELLOW: 2 },
  faction: '学院要塞',
  acValue: 3,
  power: 2500,
  basePower: 2500,
  damage: 2,
  baseDamage: 2,
  godMark: true,
  displayState: 'FRONT_UPRIGHT',
  isExhausted: false,
  isrush: false,
  canAttack: true,
  feijingMark: false,
  canResetCount: 0,
  effects: cardEffects,
  rarity: 'PR',
  availableRarities: ['PR'],
  cardPackage: 'BT04',
  uniqueId: null as any,
};

export default card;
