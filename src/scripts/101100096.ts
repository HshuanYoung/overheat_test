import { Card } from '../types/game';
import { getBt01CardEffects } from './_bt03YellowUtils';

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 101100096
 * Card2 Row: 56
 * Card Row: 56
 * Source CardNo: BT01-W01
 * Package: BT01(SR,ESR,OHR)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 【永】:这个单位参与的联军攻击中，你的白色联军单位不会被破坏。
 * 【诱】〖1回合1次〗:[〖支付一费〗]这个单位参与的攻击结束时，你可以将你的所有参战单位重置。
 * 〖10+〗【启】〖1游戏1次〗:[〖侵蚀1〗]选择你的墓地中的6张卡，放置到卡组底。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '101100096',
  fullName: '女神的微笑「柯莉尔」',
  specialName: '柯莉尔',
  type: 'UNIT',
  color: 'WHITE',
  gamecardId: null as any,
  colorReq: { WHITE: 2 },
  faction: '艾柯利普斯',
  acValue: 2,
  power: 500,
  basePower: 500,
  damage: 1,
  baseDamage: 1,
  godMark: true,
  displayState: 'FRONT_UPRIGHT',
  isExhausted: false,
  isrush: false,
  canAttack: true,
  feijingMark: false,
  canResetCount: 0,
  effects: getBt01CardEffects('101100096'),
  rarity: 'SR',
  availableRarities: ['SR', 'SER', 'UR'],
  cardPackage: 'BT01',
  uniqueId: null as any,
};

export default card;
