import { Card } from '../types/game';

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 105000460
 * Card2 Row: 349
 * Card Row: 587
 * Source CardNo: PR04-02Y
 * Package: 特殊(PR)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 略
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '105000460',
  fullName: '怪盗少女',
  specialName: '',
  type: 'UNIT',
  color: 'YELLOW',
  gamecardId: null as any,
  colorReq: { YELLOW: 1 },
  faction: '无',
  acValue: 3,
  power: 2500,
  basePower: 2500,
  damage: 2,
  baseDamage: 2,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  isExhausted: false,
  isrush: false,
  canAttack: true,
  feijingMark: false,
  canResetCount: 0,
  effects: [],
  rarity: 'PR',
  availableRarities: ['PR'],
  cardPackage: 'BT04',
  uniqueId: null as any,
};

export default card;
