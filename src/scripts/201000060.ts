import { Card, CardEffect } from '../types/game';
import { AtomicEffectExecutor, addTempPower, createSelectCardQuery, defendingUnit, isBattleFreeContext, silenceAllEffectsUntil, story } from './BaseUtil';

const cardEffects: CardEffect[] = [story('201000060_silence_defender', '只能在你的单位参与的联军攻击战斗自由步骤中使用。选择对手1个防御单位，本回合力量-2000并失去所有能力。', async (instance, gameState, playerState) => {
  const defender = defendingUnit(gameState);
  if (!defender) return;
  createSelectCardQuery(
    gameState,
    playerState.uid,
    [defender],
    '选择防御单位',
    '选择对手的1个防御单位，本回合中力量-2000并失去所有能力。',
    1,
    1,
    { sourceCardId: instance.gamecardId, effectId: '201000060_silence_defender' }
  );
}, {
  condition: (gameState, playerState) =>
    isBattleFreeContext(gameState) &&
    !!gameState.battleState?.isAlliance &&
    (gameState.battleState.attackers || []).some(id => playerState.unitZone.some(unit => unit?.gamecardId === id)) &&
    !!defendingUnit(gameState),
  targetSpec: {
    title: '选择防御单位',
    description: '选择对手的1个防御单位，本回合中力量-2000并失去所有能力。',
    minSelections: 1,
    maxSelections: 1,
    zones: ['UNIT'],
    controller: 'OPPONENT',
    getCandidates: gameState => {
      const defender = defendingUnit(gameState);
      return defender ? [{ card: defender, source: 'UNIT' as any }] : [];
    }
  },
  onQueryResolve: async (instance, gameState, _playerState, selections) => {
    const target = selections[0] ? AtomicEffectExecutor.findCardById(gameState, selections[0]) : undefined;
    if (!target || target.cardlocation !== 'UNIT') return;
    addTempPower(target, instance, -2000);
    silenceAllEffectsUntil(target, instance, gameState.turnCount);
  }
})];

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 201000060
 * Card2 Row: 154
 * Card Row: 154
 * Source CardNo: BT02-W14
 * Package: BT02(C)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 只能在你的单位参与的联军攻击的战斗自由步骤中使用。选择对手的1个防御单位，本回合中，〖力量-2000〗并失去所有能力，那些能力的效果也不处理。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '201000060',
  fullName: '双剑交辉',
  specialName: '',
  type: 'STORY',
  color: 'WHITE',
  gamecardId: null as any,
  colorReq: { WHITE: 1 },
  faction: '无',
  acValue: 2,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  feijingMark: false,
  canResetCount: 0,
  effects: cardEffects,
  rarity: 'C',
  availableRarities: ['C'],
  cardPackage: 'BT02',
  uniqueId: null as any,
};

export default card;
