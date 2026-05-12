import { Card, CardEffect } from '../types/game';
import { AtomicEffectExecutor, addTempPower, allUnitsOnField, createSelectCardQuery, story } from './BaseUtil';

const cardEffects: CardEffect[] = [story('203000072_draw_zero', '抽1张卡。之后选择战场上1张具有【神依】的单位，本回合力量值变为0。', async (instance, gameState, playerState) => {
  await AtomicEffectExecutor.execute(gameState, playerState.uid, { type: 'DRAW', value: 1 }, instance);
  const targets = allUnitsOnField(gameState).filter(unit => unit.isShenyi);
  if (targets.length === 0) return;
  createSelectCardQuery(gameState, playerState.uid, targets, '选择神依单位', '选择战场上的1张具有【神依】的单位，本回合中力量值变为0。', 1, 1, { sourceCardId: instance.gamecardId, effectId: '203000072_draw_zero' }, () => 'UNIT');
}, {
  targetSpec: {
    title: '选择神依单位',
    description: '选择战场上的1张具有【神依】的单位，本回合中力量值变为0。',
    minSelections: 1,
    maxSelections: 1,
    zones: ['UNIT'],
    getCandidates: gameState => allUnitsOnField(gameState)
      .filter(unit => unit.isShenyi)
      .map(card => ({ card, source: 'UNIT' as any }))
  },
  onQueryResolve: async (instance, gameState, playerState, selections, context) => {
    if (context?.declaredTargets?.length) {
      await AtomicEffectExecutor.execute(gameState, playerState.uid, { type: 'DRAW', value: 1 }, instance);
    }
    const target = selections[0] ? AtomicEffectExecutor.findCardById(gameState, selections[0]) : undefined;
    if (target?.cardlocation === 'UNIT') addTempPower(target, instance, -(target.power || 0));
  }
})];

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 203000072
 * Card2 Row: 203
 * Card Row: 203
 * Source CardNo: BT03-G12
 * Package: BT03(C)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 抽1张卡。之后，选择战场上的1张具有【神依】的单位，本回合中，那个单位力量值变为〖力量0〗。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '203000072',
  fullName: '驱灵术',
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
  rarity: 'C',
  availableRarities: ['C'],
  cardPackage: 'BT03',
  uniqueId: null as any,
};

export default card;
