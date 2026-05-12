import { Card, CardEffect } from '../types/game';
import { AtomicEffectExecutor, addInfluence, createSelectCardQuery, ensureData, ownUnits, story } from './BaseUtil';

const cardEffects: CardEffect[] = [story('202000053_reset_after_destroy', '只能在你的回合中使用。选择你的1个单位，本回合中下一次战斗破坏对手单位时可以重置。', async (instance, gameState, playerState) => {
  if (ownUnits(playerState).length === 0) return;
  createSelectCardQuery(
    gameState,
    playerState.uid,
    ownUnits(playerState),
    '选择单位',
    '选择你的1个单位。本回合中，那个单位下一次战斗破坏对手单位时可以重置。',
    1,
    1,
    { sourceCardId: instance.gamecardId, effectId: '202000053_reset_after_destroy' }
  );
}, {
  condition: (_gameState, playerState) => playerState.isTurn,
  targetSpec: {
    title: '选择单位',
    description: '选择你的1个单位。本回合中，那个单位下一次战斗破坏对手单位时可以重置。',
    minSelections: 1,
    maxSelections: 1,
    zones: ['UNIT'],
    controller: 'SELF',
    getCandidates: (_gameState, playerState) => ownUnits(playerState).map(card => ({ card, source: 'UNIT' as any }))
  },
  onQueryResolve: async (instance, gameState, _playerState, selections) => {
    const target = selections[0] ? AtomicEffectExecutor.findCardById(gameState, selections[0]) : undefined;
    if (!target || target.cardlocation !== 'UNIT') return;
    const data = ensureData(target);
    data.resetAfterNextBattleDestroyTurn = gameState.turnCount;
    data.resetAfterNextBattleDestroySourceName = instance.fullName;
    addInfluence(target, instance, '战斗破坏对手单位后可以重置');
  }
})];

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 202000053
 * Card2 Row: 136
 * Card Row: 136
 * Source CardNo: BT02-R13
 * Package: BT02(C)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 只能在你的回合中使用。选择你的1个单位，本回合中，那个单位下一次战斗破坏对手单位时，你可以将其〖重置〗。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '202000053',
  fullName: '电光石火',
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
  rarity: 'C',
  availableRarities: ['C'],
  cardPackage: 'BT02',
  uniqueId: null as any,
};

export default card;
