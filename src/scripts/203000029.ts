import { Card, CardEffect, TriggerLocation } from '../types/game';
import { backErosionCount, story } from './BaseUtil';

const cardEffects: CardEffect[] = [story('203000029_wind_production', '本回合中，你下一次支付ACCESS值时，可以使自己的侵蚀区中的卡刚好达到10张。', async (instance, gameState, playerState) => {
    if (backErosionCount(playerState) < 3) return;
    (playerState as any).bt01WindProductionTurn = gameState.turnCount;
    (playerState as any).bt01WindProductionSourceName = instance.fullName;
    gameState.logs.push(`[${instance.fullName}] 本回合下一次支付ACCESS值可以刚好达到10张侵蚀。`);
  })];

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 203000029
 * Card2 Row: 34
 * Card Row: 34
 * Source CardNo: BT01-G13
 * Package: BT01(U)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 【创痕3】（你的侵蚀区中的背面卡有3张以上时才有效）本回合中，你下一次支付ACCESS值时，可以使自己的侵蚀区中的卡刚好达到10张。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '203000029',
  fullName: '风力生产',
  specialName: '',
  type: 'STORY',
  color: 'GREEN',
  gamecardId: null as any,
  colorReq: { GREEN: 1 },
  faction: '无',
  acValue: 0,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  feijingMark: false,
  canResetCount: 0,
  effects: cardEffects,
  rarity: 'U',
  availableRarities: ['U'],
  cardPackage: 'BT01',
  uniqueId: null as any,
};

export default card;
