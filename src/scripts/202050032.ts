import { Card } from '../types/game';
import { getBt01CardEffects } from './_bt03YellowUtils';

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 202050032
 * Card2 Row: 50
 * Card Row: 50
 * Source CardNo: BT01-R12
 * Package: ST01(TD),BT01(C)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 选择你的1个重置单位，将其送入墓地。之后，抽1张卡。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '202050032',
  fullName: '决裂',
  specialName: '',
  type: 'STORY',
  color: 'RED',
  gamecardId: null as any,
  colorReq: { RED: 1 },
  faction: '伊列宇王国',
  acValue: -5,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  feijingMark: false,
  canResetCount: 0,
  effects: getBt01CardEffects('202050032'),
  rarity: 'U',
  availableRarities: ['U', 'C'],
  cardPackage: 'BT01',
  uniqueId: null as any,
};

export default card;
