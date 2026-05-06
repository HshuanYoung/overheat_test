import { Card, CardEffect } from '../types/game';
import { AtomicEffectExecutor, canPayAccessCost, cardsInZones, isFeijingCard, moveCard, paymentCost, selectFromEntries } from './BaseUtil';

const cardEffects: CardEffect[] = [{
  id: '305000040_top_feijing',
  type: 'ACTIVATE',
  triggerLocation: ['ITEM'],
  limitCount: 1,
  limitNameType: true,
  description: '横置并支付1费：将卡组或墓地中的1张菲晶卡放置到卡组顶。',
  condition: (gameState, playerState, instance) =>
    !instance.isExhausted &&
    canPayAccessCost(gameState, playerState, 1, 'YELLOW') &&
    cardsInZones(playerState, ['DECK', 'GRAVE']).some(entry => isFeijingCard(entry.card)),
  cost: async (gameState, playerState, instance) => {
    if (instance.isExhausted) return false;
    instance.isExhausted = true;
    return paymentCost(1, 'YELLOW')!(gameState, playerState, instance) as any;
  },
  execute: async (instance, gameState, playerState) => {
    const entries = cardsInZones(playerState, ['DECK', 'GRAVE']).filter(entry => isFeijingCard(entry.card));
    selectFromEntries(
      gameState,
      playerState.uid,
      entries,
      '选择菲晶卡',
      '选择你的卡组或墓地中的1张具有【菲晶】的卡放置到卡组顶。',
      1,
      1,
      { sourceCardId: instance.gamecardId, effectId: '305000040_top_feijing' }
    );
  },
  onQueryResolve: async (instance, gameState, playerState, selections) => {
    const selected = selections[0] ? AtomicEffectExecutor.findCardById(gameState, selections[0]) : undefined;
    if (!selected) return;
    if (selected.cardlocation === 'DECK') {
      playerState.deck = playerState.deck.filter(card => card.gamecardId !== selected.gamecardId);
      await AtomicEffectExecutor.execute(gameState, playerState.uid, { type: 'SHUFFLE_DECK' }, instance);
      selected.cardlocation = 'DECK';
      playerState.deck.push(selected);
      return;
    }
    if (selected.cardlocation === 'GRAVE') moveCard(gameState, playerState.uid, selected, 'DECK', instance);
  }
}];

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 305000040
 * Card2 Row: 395
 * Card Row: 265
 * Source CardNo: BT05-Y09
 * Package: BT05(C)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 【启】〖同名1回合1次〗[〖横置〗，〖支付1费〗]:将你的卡组或你的墓地中的1张具有【菲晶】的卡放置到你的卡组顶。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '305000040',
  fullName: '晶矿搜索仪',
  specialName: '',
  type: 'ITEM',
  color: 'YELLOW',
  gamecardId: null as any,
  colorReq: { YELLOW: 1 },
  faction: '无',
  acValue: 1,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  feijingMark: false,
  canResetCount: 0,
  effects: cardEffects,
  rarity: 'C',
  availableRarities: ['C'],
  cardPackage: 'BT05',
  uniqueId: null as any,
};

export default card;
