import { Card, CardEffect } from '../types/game';
import { canActivateDuringYourTurn, canPutUnitOntoBattlefield, moveCard, nameContains, ownUnits } from './BaseUtil';

const cardEffects: CardEffect[] = [{
  id: '103000463_grave_enter',
  type: 'ACTIVATE',
  triggerLocation: ['GRAVE'],
  erosionTotalLimit: [6, 8],
  limitCount: 1,
  limitNameType: true,
  description: '6-8同名1回合1次：你的回合中，若你战场上有卡名含有《黄昏的魔女》的卡，从墓地放置到战场。',
  condition: (gameState, playerState, instance) =>
    canActivateDuringYourTurn(gameState, playerState) &&
    ownUnits(playerState).some(unit => nameContains(unit, '黄昏的魔女')) &&
    canPutUnitOntoBattlefield(playerState, instance),
  execute: async (instance, gameState, playerState) => {
    moveCard(gameState, playerState.uid, instance, 'UNIT', instance);
    (instance as any).data = { ...((instance as any).data || {}), exileWhenLeavesFieldSourceName: instance.fullName };
  }
}, {
  id: '103000463_leave_exile',
  type: 'TRIGGER',
  triggerEvent: 'CARD_LEFT_FIELD',
  triggerLocation: ['GRAVE'],
  isMandatory: true,
  description: '这个单位从战场离开时，将这张卡放逐。',
  condition: (_gameState, _playerState, instance, event) =>
    event?.sourceCardId === instance.gamecardId &&
    !!(instance as any).data?.exileWhenLeavesFieldSourceName,
  execute: async (instance, gameState, playerState) => {
    if (instance.cardlocation === 'GRAVE') moveCard(gameState, playerState.uid, instance, 'EXILE', instance);
  }
}];

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 103000463
 * Card2 Row: 294
 * Card Row: 590
 * Source CardNo: BT04-G03
 * Package: BT04(C)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 〖6-8〗【启】〖同名1回合1次〗：这个能力只能在你的回合中从墓地发动。若你的战场上有卡名含有《黄昏的魔女》的卡，将这张卡放置到战场上。这个单位从战场上离开时，将这张卡放逐。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '103000463',
  fullName: '魔女的侍卫灵',
  specialName: '',
  type: 'UNIT',
  color: 'GREEN',
  gamecardId: null as any,
  colorReq: { GREEN: 1 },
  faction: '无',
  acValue: 2,
  power: 2000,
  basePower: 2000,
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
  rarity: 'C',
  availableRarities: ['C'],
  cardPackage: 'BT04',
  uniqueId: null as any,
};

export default card;
