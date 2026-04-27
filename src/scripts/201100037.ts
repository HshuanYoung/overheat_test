import { Card } from '../types/game';
import { getBt01CardEffects } from './_bt03YellowUtils';

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 201100037
 * Card2 Row: 68
 * Card Row: 68
 * Source CardNo: BT01-W13
 * Package: BT01(R)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 【创痕3】（你的侵蚀区中的背面卡有3张以上时才有效）将战场上的所有卡破坏。之后，这场游戏中，你的《日蚀》的效果不再处理。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '201100037',
  fullName: '日蚀',
  specialName: '',
  type: 'STORY',
  color: 'WHITE',
  gamecardId: null as any,
  colorReq: { WHITE: 1 },
  faction: '艾柯利普斯',
  acValue: 4,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  feijingMark: false,
  canResetCount: 0,
  effects: getBt01CardEffects('201100037'),
  rarity: 'R',
  availableRarities: ['R'],
  cardPackage: 'BT01',
  uniqueId: null as any,
};

export default card;
