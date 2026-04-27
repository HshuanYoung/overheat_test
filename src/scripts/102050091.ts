import { Card } from '../types/game';
import { getBt01CardEffects } from './_bt03YellowUtils';

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 102050091
 * Card2 Row: 45
 * Card Row: 45
 * Source CardNo: BT01-R07
 * Package: BT01(SR,ESR)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 【永】:你的所有红色神蚀单位获得【速攻】。
 * 【永】:这个单位可以攻击对手的横置单位。
 * 【诱】:[〖支付三费，我方场上有两个或以上的红色单位〗]你的1个单位将要被战斗破坏时，你可以将这张卡从手牌放置到战场上。之后，防止那次破坏。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '102050091',
  fullName: '烬晓之光「迪凯」',
  specialName: '迪凯',
  type: 'UNIT',
  color: 'RED',
  gamecardId: null as any,
  colorReq: { RED: 2 },
  faction: '伊列宇王国',
  acValue: 5,
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
  effects: getBt01CardEffects('102050091'),
  rarity: 'SR',
  availableRarities: ['SR', 'SER'],
  cardPackage: 'BT01',
  uniqueId: null as any,
};

export default card;
