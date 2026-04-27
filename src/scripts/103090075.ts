import { Card, CardEffect, TriggerLocation } from '../types/game';
import { searchDeckEffect } from './BaseUtil';

const cardEffects: CardEffect[] = [searchDeckEffect('103090075_search', '入场时，可以从卡组将1张《风车守望者》以外的<瑟诺布>单位加入手牌。', card => card.type === 'UNIT' && card.faction === '瑟诺布' && card.fullName !== '风车守望者')];

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 103090075
 * Card2 Row: 23
 * Card Row: 23
 * Source CardNo: BT01-G02
 * Package: BT01(U),ST02(TD)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 【诱】:这个单位进入战场时，你可以选择你的卡组中的1张《风车守望者》以外的<瑟诺布>单位卡，将其加入手牌。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '103090075',
  fullName: '风车守望者',
  specialName: '',
  type: 'UNIT',
  color: 'GREEN',
  gamecardId: null as any,
  colorReq: { GREEN: 1 },
  faction: '瑟诺布',
  acValue: 2,
  power: 1000,
  basePower: 1000,
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
  rarity: 'U',
  availableRarities: ['U'],
  cardPackage: 'BT01',
  uniqueId: null as any,
};

export default card;
