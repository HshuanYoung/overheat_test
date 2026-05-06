import { Card } from '../types/game';

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 101000501
 * Card2 Row: 291
 * Card Row: 648
 * Source CardNo: SP01-W01
 * Package: SP01(SPR,XSR)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 【诱】〖1回合1次〗:你的回合结束时，公开你卡组顶的一张卡。若那张卡是白色卡，所有对手选择他的一个单位，将其放逐。将公开的卡原样放回。
 * 【启】〖同名1回合1次〗:[舍弃手牌中的1张白色单位卡]这个能力只能在战斗阶段中发动。将这张卡放逐。这个战斗阶段结束时，将被放逐的这张卡放置到战场上。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '101000501',
  fullName: '冰峰神兽「白虎」',
  specialName: '白虎',
  type: 'UNIT',
  color: 'WHITE',
  gamecardId: null as any,
  colorReq: { WHITE: 2 },
  faction: '无',
  acValue: 4,
  power: 3500,
  basePower: 3500,
  damage: 3,
  baseDamage: 3,
  godMark: true,
  displayState: 'FRONT_UPRIGHT',
  isExhausted: false,
  isrush: false,
  canAttack: true,
  feijingMark: false,
  canResetCount: 0,
  effects: [],
  rarity: 'C',
  availableRarities: ['C'],
  cardPackage: 'BT05',
  uniqueId: null as any,
};

export default card;
