import { Card } from '../types/game';
import { getBt01CardEffects } from './_bt03YellowUtils';

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 102050090
 * Card2 Row: 44
 * Card Row: 44
 * Source CardNo: BT01-R06
 * Package: BT01(SR,ESR,OHR),BTO3(FVR)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 【速攻】
 * 【诱】:这个单位攻击时，选择对手的最多2个〖力量3000〗以上的单位，本回合中，不能宣言防御。
 * 〖10+〗【诱】:[〖侵蚀1〗]你进入女神化状态时，你可以将这张卡从手牌放置到战场上，选择战场上的最多2个单位，本回合中〖伤害+1〗〖力量+1000〗。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '102050090',
  fullName: '第二王女「赛利亚」',
  specialName: '赛利亚',
  type: 'UNIT',
  color: 'RED',
  gamecardId: null as any,
  colorReq: { RED: 2 },
  faction: '伊列宇王国',
  acValue: 4,
  power: 3500,
  basePower: 3500,
  damage: 2,
  baseDamage: 2,
  godMark: true,
  displayState: 'FRONT_UPRIGHT',
  isExhausted: false,
  isrush: true,
  canAttack: true,
  feijingMark: false,
  canResetCount: 0,
  effects: getBt01CardEffects('102050090'),
  rarity: 'SR',
  availableRarities: ['SR', 'SER'],
  cardPackage: 'BT01',
  uniqueId: null as any,
};

export default card;
