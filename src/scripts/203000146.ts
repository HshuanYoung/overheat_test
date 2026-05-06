import { Card } from '../types/game';

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 203000146
 * Card2 Row: 263
 * Card Row: 619
 * Source CardNo: SP01-G02
 * Package: SP01(R,SPR)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 〖同名1回合1次〗:只能在你的主要阶段使用。从你的墓地选择2张同名的非神蚀单位卡放置到战场上，那些单位的所有能力无效，你的回合结束时，将那些单位放逐。
 * 【你为ACCESS值+3以下的白色卡支付使用费用时，你可以将手牌中的这张卡放逐作为这次费用的代替。】
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '203000146',
  fullName: '花开的传说',
  specialName: '',
  type: 'STORY',
  color: 'GREEN',
  gamecardId: null as any,
  colorReq: {},
  faction: '无',
  acValue: 0,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  feijingMark: false,
  canResetCount: 0,
  effects: [],
  rarity: 'R',
  availableRarities: ['R'],
  cardPackage: 'BT05',
  uniqueId: null as any,
};

export default card;
