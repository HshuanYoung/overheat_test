import { Card, CardEffect, TriggerLocation } from '../types/game';
import { canPutUnitOntoBattlefield, ensureDeckHasCardsForMove, exhaustCost, getTopDeckCards, isNonGodUnit, moveCard } from './BaseUtil';

const cardEffects: CardEffect[] = [{
    id: '303090012_mill_play',
    type: 'ACTIVATE',
    triggerLocation: ['ITEM'],
    description: '横置：将卡组顶1张送入墓地。若其为力量2500以上非神蚀单位，可以放逐此卡并将其放置到战场。',
    condition: (_gameState, _playerState, instance) => !instance.isExhausted,
    cost: exhaustCost,
    execute: async (instance, gameState, playerState) => {
      if (!ensureDeckHasCardsForMove(gameState, playerState.uid, 1, instance)) return;
      const top = getTopDeckCards(playerState, 1)[0];
      if (!top) return;
      moveCard(gameState, playerState.uid, top, 'GRAVE', instance);
      if (isNonGodUnit(top) && (top.power || 0) >= 2500 && canPutUnitOntoBattlefield(playerState, top)) {
        moveCard(gameState, playerState.uid, instance, 'EXILE', instance);
        moveCard(gameState, playerState.uid, top, 'UNIT', instance);
      }
    }
  }];

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 303090012
 * Card2 Row: 38
 * Card Row: 38
 * Source CardNo: BT01-G17
 * Package: BT01(R)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 【启】:[〖横置〗]将你的卡组顶的1张卡送入墓地。若那张卡是〖力量2500〗以上的非神蚀单位，你可以将这张卡放逐。之后，将那个单位放置到战场上。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '303090012',
  fullName: '银乐器长笛',
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
  rarity: 'R',
  availableRarities: ['R'],
  cardPackage: 'BT01',
  uniqueId: null as any,
};

export default card;
