import { Card } from '../types/game';
import { getBt01CardEffects } from './_bt03YellowUtils';

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 101140097
 * Card2 Row: 57
 * Card Row: 57
 * Source CardNo: BT01-W02
 * Package: ST01(TD),BT01(C)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 【诱】:你的卡从墓地进入卡组时，选择你的1个单位，本回合中〖伤害+1〗〖力量+500〗。 
 * 
 * 愿菲之女神的保佑与你同在。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '101140097',
  fullName: '虔诚的修道女',
  specialName: '',
  type: 'UNIT',
  color: 'WHITE',
  gamecardId: null as any,
  colorReq: {},
  faction: '女神教会',
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
  effects: getBt01CardEffects('101140097'),
  rarity: 'U',
  availableRarities: ['U', 'C'],
  cardPackage: 'BT01',
  uniqueId: null as any,
};

export default card;
