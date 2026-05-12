import { Card, CardEffect } from '../types/game';
import { AtomicEffectExecutor, addTempKeyword, createSelectCardQuery, ownUnits, story } from './BaseUtil';

const cardEffects: CardEffect[] = [story('202000078_rush', '选择你的1个单位，本回合获得【速攻】。', async (instance, gameState, playerState, _event, declaredSelections?: string[]) => {
  if (declaredSelections?.length) {
    const target = declaredSelections[0] ? AtomicEffectExecutor.findCardById(gameState, declaredSelections[0]) : undefined;
    if (target?.cardlocation === 'UNIT') addTempKeyword(target, instance, 'rush');
    return;
  }
  if (ownUnits(playerState).length === 0) return;
  createSelectCardQuery(gameState, playerState.uid, ownUnits(playerState), '选择单位', '选择你的1个单位，本回合中获得【速攻】。', 1, 1, { sourceCardId: instance.gamecardId, effectId: '202000078_rush' }, () => 'UNIT');
}, {
  targetSpec: {
    title: '选择单位',
    description: '选择你的1个单位，本回合中获得【速攻】。',
    minSelections: 1,
    maxSelections: 1,
    zones: ['UNIT'],
    controller: 'SELF',
    getCandidates: (_gameState, playerState) => ownUnits(playerState).map(card => ({ card, source: 'UNIT' as any }))
  },
  onQueryResolve: async (instance, gameState, _playerState, selections) => {
    const target = selections[0] ? AtomicEffectExecutor.findCardById(gameState, selections[0]) : undefined;
    if (target?.cardlocation === 'UNIT') addTempKeyword(target, instance, 'rush');
  }
})];

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 202000078
 * Card2 Row: 220
 * Card Row: 220
 * Source CardNo: BT03-R13
 * Package: BT03(U)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 选择你的1个单位，本回合中，获得【速攻】。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '202000078',
  fullName: '迅雷的猛袭',
  specialName: '',
  type: 'STORY',
  color: 'RED',
  gamecardId: null as any,
  colorReq: { RED: 1 },
  faction: '无',
  acValue: 2,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  feijingMark: false,
  canResetCount: 0,
  effects: cardEffects,
  rarity: 'U',
  availableRarities: ['U'],
  cardPackage: 'BT03',
  uniqueId: null as any,
};

export default card;
