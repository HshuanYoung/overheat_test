import { Card, CardEffect, GameEvent } from '../types/game';
import { createSelectCardQuery, isFaction, moveCardAsCost, moveRandomGraveToDeckBottom } from './BaseUtil';

const cardEffects: CardEffect[] = [{
  id: '303090043_turn_end_recover',
  type: 'TRIGGER',
  triggerEvent: 'TURN_END' as any,
  triggerLocation: ['ITEM'],
  description: '你的回合结束时，可以横置这张卡并丢弃1张<瑟诺布>手牌，随机将墓地中的2张卡放置到卡组底。',
  condition: (_gameState, playerState, instance, event?: GameEvent) =>
    event?.playerUid === playerState.uid &&
    !instance.isExhausted &&
    playerState.hand.some(card => isFaction(card, '瑟诺布')) &&
    playerState.grave.length >= 2,
  cost: async (gameState, playerState, instance) => {
    if (instance.isExhausted) return false;
    const candidates = playerState.hand.filter(card => isFaction(card, '瑟诺布'));
    if (candidates.length === 0 || playerState.grave.length < 2) return false;
    createSelectCardQuery(
      gameState,
      playerState.uid,
      candidates,
      '选择丢弃手牌',
      '选择手牌中的1张<瑟诺布>卡丢弃，并横置这张卡作为费用。',
      1,
      1,
      { sourceCardId: instance.gamecardId, effectId: '303090043_turn_end_recover', step: 'COST' },
      () => 'HAND'
    );
    return true;
  },
  execute: async (instance, gameState, playerState) => {
    moveRandomGraveToDeckBottom(gameState, playerState.uid, 2, instance);
  },
  onQueryResolve: async (instance, gameState, playerState, selections, context) => {
    if (context?.step !== 'COST') return;
    const selected = playerState.hand.find(card => card.gamecardId === selections[0]);
    if (!selected) return;
    instance.isExhausted = true;
    moveCardAsCost(gameState, playerState.uid, selected, 'GRAVE', instance);
  }
}];

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 303090043
 * Card2 Row: 366
 * Card Row: 297
 * Source CardNo: ST02-G05
 * Package: ST02(TD)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 诱发效果，你的回合结束时可以选择是否发动，横置该卡，丢弃手牌中的一张‘瑟诺布’的卡：随机将你墓地中的2张卡，将其放置到你的卡组底
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '303090043',
  fullName: '银乐器竖琴',
  specialName: '',
  type: 'ITEM',
  color: 'GREEN',
  gamecardId: null as any,
  colorReq: { GREEN: 1 },
  faction: '瑟诺布',
  acValue: 1,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  feijingMark: false,
  canResetCount: 0,
  effects: cardEffects,
  rarity: 'U',
  availableRarities: ['U'],
  cardPackage: 'BT02',
  uniqueId: null as any,
};

export default card;
