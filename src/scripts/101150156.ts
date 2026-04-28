import { Card, CardEffect } from '../types/game';
import { AtomicEffectExecutor, createSelectCardQuery, discardHandCost, moveCard } from './BaseUtil';

const cardEffects: CardEffect[] = [{
  id: '101150156_search_snow_god',
  type: 'TRIGGER',
  triggerEvent: 'CARD_ENTERED_ZONE',
  triggerLocation: ['UNIT'],
  description: '进入战场时，舍弃1张手牌，选择卡组中1张<仙雪原>神蚀单位卡加入手牌。',
  condition: (_gameState, playerState, instance, event) =>
    event?.sourceCardId === instance.gamecardId &&
    event.data?.zone === 'UNIT' &&
    playerState.hand.length > 0 &&
    playerState.deck.some(card => card.type === 'UNIT' && card.faction === '仙雪原' && card.godMark),
  cost: discardHandCost(1),
  execute: async (instance, gameState, playerState) => {
    const candidates = playerState.deck.filter(card => card.type === 'UNIT' && card.faction === '仙雪原' && card.godMark);
    createSelectCardQuery(
      gameState,
      playerState.uid,
      candidates,
      '选择加入手牌的卡',
      '选择卡组中的1张<仙雪原>神蚀单位卡，将其加入手牌。',
      1,
      1,
      { sourceCardId: instance.gamecardId, effectId: '101150156_search_snow_god' },
      () => 'DECK'
    );
  },
  onQueryResolve: async (instance, gameState, playerState, selections) => {
    const target = selections[0] ? AtomicEffectExecutor.findCardById(gameState, selections[0]) : undefined;
    if (!target || target.cardlocation !== 'DECK') return;
    moveCard(gameState, playerState.uid, target, 'HAND', instance);
    await AtomicEffectExecutor.execute(gameState, playerState.uid, { type: 'SHUFFLE_DECK' }, instance);
  }
}];

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 101150156
 * Card2 Row: 146
 * Card Row: 146
 * Source CardNo: BT02-W06
 * Package: BT02(R)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 【诱】:[舍弃1张手牌]这个单位进入战场时，选择你的卡组中的1张<仙雪原>的神蚀单位卡，将其加入手牌。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '101150156',
  fullName: '雪地的妖精',
  specialName: '',
  type: 'UNIT',
  color: 'WHITE',
  gamecardId: null as any,
  colorReq: { WHITE: 1 },
  faction: '仙雪原',
  acValue: 1,
  power: 500,
  basePower: 500,
  damage: 1,
  baseDamage: 1,
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
  cardPackage: 'BT02',
  uniqueId: null as any,
};

export default card;
