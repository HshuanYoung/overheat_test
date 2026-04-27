import { Card } from '../types/game';
import { getBt01CardEffects } from './_bt03YellowUtils';

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 101000106
 * Card2 Row: 66
 * Card Row: 66
 * Source CardNo: BT01-W11
 * Package: BT01(C)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 【永】:对手的回合中，这个单位〖力量+1000〗。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '101000106',
  fullName: '普尔氏·侠客大熊猫',
  specialName: '',
  type: 'UNIT',
  color: 'WHITE',
  gamecardId: null as any,
  colorReq: {},
  faction: '无',
  acValue: 2,
  power: 1500,
  basePower: 1500,
  damage: 2,
  baseDamage: 2,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  isExhausted: false,
  isrush: false,
  canAttack: true,
  feijingMark: false,
  canResetCount: 0,
  effects: getBt01CardEffects('101000106'),
  rarity: 'C',
  availableRarities: ['C'],
  cardPackage: 'BT01',
  uniqueId: null as any,
};

export default card;
