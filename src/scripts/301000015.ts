import { Card, CardEffect, TriggerLocation } from '../types/game';
import { faceUpErosion, moveCard } from './BaseUtil';

const cardEffects: CardEffect[] = [{
    id: '301000015_exile_erosion',
    type: 'TRIGGER',
    triggerEvent: 'CARD_ENTERED_ZONE',
    triggerLocation: ['ITEM'],
    description: '进入战场时，将你的侵蚀区中的所有正面卡放逐。',
    condition: (_gameState, _playerState, instance, event) => event?.sourceCardId === instance.gamecardId && event.data?.zone === 'ITEM',
    execute: async (instance, gameState, playerState) => faceUpErosion(playerState).forEach(card => moveCard(gameState, playerState.uid, card, 'EXILE', instance))
  }];

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 301000015
 * Card2 Row: 71
 * Card Row: 71
 * Source CardNo: BT01-W16
 * Package: BT01(C)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 【诱】:这张卡进入战场时，将你的侵蚀区中的所有正面卡放逐。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '301000015',
  fullName: '治疗教典',
  specialName: '',
  type: 'ITEM',
  color: 'WHITE',
  gamecardId: null as any,
  colorReq: { WHITE: 1 },
  faction: '无',
  acValue: 0,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  feijingMark: false,
  canResetCount: 0,
  effects: cardEffects,
  rarity: 'C',
  availableRarities: ['C'],
  cardPackage: 'BT01',
  uniqueId: null as any,
};

export default card;
