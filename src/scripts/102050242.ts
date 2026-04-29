import { Card, CardEffect, GameEvent } from '../types/game';
import { AtomicEffectExecutor, canPutUnitOntoBattlefield, createSelectCardQuery, isFeijingUnit, putUnitOntoField } from './BaseUtil';

const cardEffects: CardEffect[] = [{
  id: '102050242_enter_feijing',
  type: 'TRIGGER',
  triggerLocation: ['UNIT'],
  triggerEvent: 'CARD_ENTERED_ZONE',
  limitCount: 1,
  limitNameType: true,
  description: '进入战场时，可以选择手牌中1张ACCESS+3以下的菲晶单位卡放置到战场上。',
  condition: (_gameState, playerState, instance, event?: GameEvent) =>
    event?.sourceCardId === instance.gamecardId &&
    event.data?.zone === 'UNIT' &&
    playerState.hand.some(card => isFeijingUnit(card) && (card.acValue || 0) <= 3 && canPutUnitOntoBattlefield(playerState, card)),
  execute: async (instance, gameState, playerState) => {
    const candidates = playerState.hand.filter(card => isFeijingUnit(card) && (card.acValue || 0) <= 3 && canPutUnitOntoBattlefield(playerState, card));
    createSelectCardQuery(
      gameState,
      playerState.uid,
      candidates,
      '选择菲晶单位',
      '选择手牌中的1张ACCESS值+3以下的具有【菲晶】的单位卡放置到战场上。',
      0,
      1,
      { sourceCardId: instance.gamecardId, effectId: '102050242_enter_feijing' },
      () => 'HAND'
    );
  },
  onQueryResolve: async (instance, gameState, playerState, selections) => {
    const target = selections[0] ? AtomicEffectExecutor.findCardById(gameState, selections[0]) : undefined;
    if (target?.cardlocation === 'HAND') putUnitOntoField(gameState, playerState.uid, target, instance);
  }
}];

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 102050242
 * Card2 Row: 411
 * Card Row: 281
 * Source CardNo: BT05-R05
 * Package: BT05(C)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 诱】〖同名1回合1次〗{这个单位进入战场时}:你可以选择手牌中的1张ACCESS值+3以下的具有【菲晶】的单位卡，将其放置到战场上。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '102050242',
  fullName: '沙普城的骑兵队',
  specialName: '',
  type: 'UNIT',
  color: 'RED',
  gamecardId: null as any,
  colorReq: {},
  faction: '伊列宇王国',
  acValue: 4,
  power: 3500,
  basePower: 3500,
  damage: 3,
  baseDamage: 3,
  godMark: true,
  displayState: 'FRONT_UPRIGHT',
  isExhausted: false,
  isrush: false,
  canAttack: true,
  feijingMark: true,
  canResetCount: 0,
  effects: cardEffects,
  rarity: 'C',
  availableRarities: ['C'],
  cardPackage: 'BT05',
  uniqueId: null as any,
};

export default card;
