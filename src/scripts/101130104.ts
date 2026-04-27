import { Card } from '../types/game';
import { getBt01CardEffects } from './_bt03YellowUtils';

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 101130104
 * Card2 Row: 64
 * Card Row: 64
 * Source CardNo: BT01-W09
 * Package: BT01(R)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 【永】:这个单位参与的联军攻击中，这个单位获得【歼灭】。
 * 〖0~3〗【诱】:这个单位给予对手战斗伤害时，选择你的墓地中的2张卡，放置到卡组底。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '101130104',
  fullName: '歼灭天使团',
  specialName: '',
  type: 'UNIT',
  color: 'WHITE',
  gamecardId: null as any,
  colorReq: { WHITE: 1 },
  faction: '圣王国',
  acValue: 3,
  power: 2500,
  basePower: 2500,
  damage: 2,
  baseDamage: 2,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  isExhausted: false,
  isrush: false,
  isAnnihilation: true,
  canAttack: true,
  feijingMark: false,
  canResetCount: 0,
  effects: getBt01CardEffects('101130104'),
  rarity: 'R',
  availableRarities: ['R'],
  cardPackage: 'BT01',
  uniqueId: null as any,
};

export default card;
