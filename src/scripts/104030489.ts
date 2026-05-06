import { Card } from '../types/game';
import baseCocola from './104030125';

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 104030489
 * Card2 Row: 279
 * Card Row: 635
 * Source CardNo: PR02-03B
 * Package: 特殊(PR)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 【诱】:你的主要阶段开始时，选择对手的1个非神蚀单位，这个回合中，你的单位可以攻击那个单位。
 * 〖10+〗【启】〖同名1回合1次〗:[〖侵蚀1〗]选择你的手牌、卡组或墓地中的1张 「可可亚」单位卡，将其放置到战场上。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '104030489',
  fullName: '公会的看板娘「可可拉」pr',
  specialName: '可可拉',
  type: 'UNIT',
  color: 'BLUE',
  gamecardId: null as any,
  colorReq: { BLUE: 2 },
  faction: '冒险家公会',
  acValue: 3,
  power: 2500,
  basePower: 2500,
  damage: 2,
  baseDamage: 2,
  godMark: true,
  displayState: 'FRONT_UPRIGHT',
  isExhausted: false,
  isrush: false,
  canAttack: true,
  feijingMark: false,
  canResetCount: 0,
  effects: baseCocola.effects,
  rarity: 'PR',
  availableRarities: ['PR'],
  cardPackage: 'BT05',
  uniqueId: null as any,
};

export default card;
