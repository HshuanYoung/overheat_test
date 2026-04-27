import { Card, CardEffect } from '../types/game';
import { AtomicEffectExecutor, canPutUnitOntoBattlefield, createSelectCardQuery, ensureDeckHasCardsForMove, getTopDeckCards, isNonGodUnit, moveCard, ownUnits } from './BaseUtil';

const cardEffects: CardEffect[] = [{
    id: '103000080_mill_revive',
    type: 'ACTIVATE',
    triggerLocation: ['UNIT'],
    description: '放逐此单位：将卡组顶3张送入墓地，之后从那3张中将1个力量2500以下的非神蚀单位放置到战场上。',
    condition: (_gameState, playerState) => ownUnits(playerState).filter(unit => AtomicEffectExecutor.matchesColor(unit, 'GREEN')).length >= 2,
    cost: async (gameState, playerState, instance) => {
      moveCard(gameState, playerState.uid, instance, 'EXILE', instance);
      return playerState.exile.some(card => card.gamecardId === instance.gamecardId);
    },
    execute: async (instance, gameState, playerState) => {
      if (!ensureDeckHasCardsForMove(gameState, playerState.uid, 3, instance)) return;
      const milled = getTopDeckCards(playerState, 3);
      milled.forEach(card => moveCard(gameState, playerState.uid, card, 'GRAVE', instance));
      const candidates = milled.filter(card => playerState.grave.some(grave => grave.gamecardId === card.gamecardId) && isNonGodUnit(card) && (card.power || 0) <= 2500 && canPutUnitOntoBattlefield(playerState, card));
      if (candidates.length === 0) return;
      createSelectCardQuery(
        gameState,
        playerState.uid,
        candidates,
        '选择放置到战场的单位',
        '从送入墓地的3张卡中选择1个力量2500以下的非神蚀单位，放置到战场上。',
        1,
        1,
        { sourceCardId: instance.gamecardId, effectId: '103000080_mill_revive' },
        () => 'GRAVE'
      );
    },
    onQueryResolve: async (instance, gameState, playerState, selections) => {
      const target = playerState.grave.find(card => card.gamecardId === selections[0] && isNonGodUnit(card) && (card.power || 0) <= 2500 && canPutUnitOntoBattlefield(playerState, card));
      if (target) moveCard(gameState, playerState.uid, target, 'UNIT', instance);
    }
  }];

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 103000080
 * Card2 Row: 28
 * Card Row: 28
 * Source CardNo: BT01-G07
 * Package: BT01(R)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 【启】:[〖支付0费，我方单位区有两个或者以上的绿色单位〗，将这个单位放逐]将你的卡组顶的3张卡送入墓地。之后，从那3张卡中选择1个〖力量2500〗以下的非神蚀单位，放置到战场上。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '103000080',
  fullName: '林中魅影',
  specialName: '',
  type: 'UNIT',
  color: 'GREEN',
  gamecardId: null as any,
  colorReq: {},
  faction: '无',
  acValue: 1,
  power: 500,
  basePower: 500,
  damage: 0,
  baseDamage: 0,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  isExhausted: false,
  isrush: false,
  canAttack: true,
  feijingMark: false,
  canResetCount: 0,
  effects: cardEffects,
  rarity: 'R',
  availableRarities: ['R'],
  cardPackage: 'BT01',
  uniqueId: null as any,
};

export default card;
