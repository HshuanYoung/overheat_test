import { Card, CardEffect, TriggerLocation } from '../types/game';
import { addTempDamage, addTempPower, createSelectCardQuery, dealUnpreventableSelfDamage, ownUnits, story } from './BaseUtil';

const cardEffects: CardEffect[] = [story('202050033_goddess', '5~7且创痕3：给予你5点不能防止的伤害，选择1个单位伤害+2、力量+2000。', async (instance, gameState, playerState) => {
    dealUnpreventableSelfDamage(gameState, playerState.uid, 5, instance);
    const candidates = ownUnits(playerState);
    if (candidates.length === 0) return;
    createSelectCardQuery(
      gameState,
      playerState.uid,
      candidates,
      '选择单位',
      '选择你的1个单位，本回合中伤害+2、力量+2000。',
      1,
      1,
      { sourceCardId: instance.gamecardId, effectId: '202050033_goddess' }
    );
  }, {
    erosionTotalLimit: [5, 7],
    erosionBackLimit: [3, 10],
    condition: (_gameState, playerState) => ownUnits(playerState).length > 0,
    targetSpec: {
      title: '选择单位',
      description: '选择你的1个单位，本回合中伤害+2、力量+2000。',
      minSelections: 1,
      maxSelections: 1,
      zones: ['UNIT'],
      controller: 'SELF',
      getCandidates: (_gameState, playerState) => ownUnits(playerState).map(card => ({ card, source: 'UNIT' as any }))
    },
    onQueryResolve: async (instance, gameState, playerState, selections, context) => {
      if (context?.declaredTargets?.length) {
        dealUnpreventableSelfDamage(gameState, playerState.uid, 5, instance);
      }
      const target = ownUnits(playerState).find(unit => unit.gamecardId === selections[0]);
    if (target) {
      addTempDamage(target, instance, 2);
      addTempPower(target, instance, 2000);
    }
    }
  })];

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 202050033
 * Card2 Row: 51
 * Card Row: 51
 * Source CardNo: BT01-R13
 * Package: ST01(TD),BT01(U)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 〖5~7〗【创痕3】（你的侵蚀区中的背面卡有3张以上时才有效）给予你5点不能防止的伤害，选择你的1个单位，本回合中〖伤害+2〗〖力量+2000〗。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '202050033',
  fullName: '女神化',
  specialName: '',
  type: 'STORY',
  color: 'RED',
  gamecardId: null as any,
  colorReq: { RED: 1 },
  faction: '伊列宇王国',
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
