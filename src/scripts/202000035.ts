import { Card } from '../types/game';
import { getBt01CardEffects } from './_bt03YellowUtils';

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 202000035
 * Card2 Row: 53
 * Card Row: 53
 * Source CardNo: BT01-R15
 * Package: ST01(TD),BT01(C)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 选择1张非神蚀道具卡或1个〖力量2500〗以下的非神蚀单位，将其破坏。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '202000035',
  fullName: '魔兽讨伐',
  specialName: '',
  type: 'STORY',
  color: 'RED',
  gamecardId: null as any,
  colorReq: { RED: 1 },
  faction: '无',
  acValue: 2,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  feijingMark: false,
  canResetCount: 0,
  effects: getBt01CardEffects('202000035'),
  rarity: 'U',
  availableRarities: ['U', 'C'],
  cardPackage: 'BT01',
  uniqueId: null as any,
};

export default card;
