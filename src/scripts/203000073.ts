import { Card, CardEffect } from '../types/game';
import { AtomicEffectExecutor, addInfluence, createSelectCardQuery, ensureData, ownUnits, story } from './BaseUtil';

const cardEffects: CardEffect[] = [story('203000073_must_defend', '选择你的1个单位，本回合那个单位参与攻击的战斗中，对手若有可防御单位必须防御。', async (instance, gameState, playerState) => {
  if (ownUnits(playerState).length === 0) return;
  createSelectCardQuery(gameState, playerState.uid, ownUnits(playerState), '选择单位', '选择你的1个单位，本回合中攻击时对手必须防御。', 1, 1, { sourceCardId: instance.gamecardId, effectId: '203000073_must_defend' }, () => 'UNIT');
}, {
  targetSpec: {
    title: '选择单位',
    description: '选择你的1个单位，本回合中攻击时对手必须防御。',
    minSelections: 1,
    maxSelections: 1,
    zones: ['UNIT'],
    controller: 'SELF',
    getCandidates: (_gameState, playerState) => ownUnits(playerState).map(card => ({ card, source: 'UNIT' as any }))
  },
  onQueryResolve: async (instance, gameState, _playerState, selections) => {
    const target = selections[0] ? AtomicEffectExecutor.findCardById(gameState, selections[0]) : undefined;
    if (target?.cardlocation === 'UNIT') {
      ensureData(target).mustBeDefendedTurn = gameState.turnCount;
      ensureData(target).mustBeDefendedSourceName = instance.fullName;
      addInfluence(target, instance, '攻击时对手必须宣言防御');
    }
  }
})];

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 203000073
 * Card2 Row: 204
 * Card Row: 204
 * Source CardNo: BT03-G13
 * Package: BT03(C)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 选择你的1个单位，本回合中，那个单位参与攻击的战斗中，若对手有可以宣言防御的单位，对手必须从中选择1个单位宣言防御。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '203000073',
  fullName: '野性之力',
  specialName: '',
  type: 'STORY',
  color: 'GREEN',
  gamecardId: null as any,
  colorReq: { GREEN: 1 },
  faction: '无',
  acValue: 1,
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
