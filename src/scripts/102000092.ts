import { Card } from '../types/game';
import { getBt01CardEffects } from './_bt03YellowUtils';

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 102000092
 * Card2 Row: 46
 * Card Row: 46
 * Source CardNo: BT01-R08
 * Package: ST01(TD),BT01(U)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 【启】〖1回合1次〗:[〖支付0费，我方单位区有两个或者以上的红色单位〗]你的主要阶段中才可以发动。给予所有玩家1点伤害。
 * 〖9~9〗【诱】:这个单位进入战场时，给予你1点伤害。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '102000092',
  fullName: '招来不幸的预言者',
  specialName: '',
  type: 'UNIT',
  color: 'RED',
  gamecardId: null as any,
  colorReq: {},
  faction: '无',
  acValue: 1,
  power: 500,
  basePower: 500,
  damage: 0,
  baseDamage: 0,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  isExhausted: false,
  isrush: false,
  canAttack: true,
  feijingMark: false,
  canResetCount: 0,
  effects: getBt01CardEffects('102000092'),
  rarity: 'U',
  availableRarities: ['U'],
  cardPackage: 'BT01',
  uniqueId: null as any,
};

export default card;
