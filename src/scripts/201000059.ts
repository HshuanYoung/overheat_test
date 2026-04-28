import { Card, CardEffect } from '../types/game';
import { AtomicEffectExecutor, createSelectCardQuery, ownUnits, preventNextDestroy, story } from './BaseUtil';

const cardEffects: CardEffect[] = [story('201000059_prevent_destroy', '选择你的1个单位，本回合中那个单位下一次将被破坏时防止那次破坏。', async (instance, gameState, playerState) => {
  if (ownUnits(playerState).length === 0) return;
  createSelectCardQuery(
    gameState,
    playerState.uid,
    ownUnits(playerState),
    '选择保护单位',
    '选择你的1个单位，本回合中那个单位下一次将要被破坏时，防止那次破坏。',
    1,
    1,
    { sourceCardId: instance.gamecardId, effectId: '201000059_prevent_destroy' }
  );
}, {
  onQueryResolve: async (instance, gameState, _playerState, selections) => {
    const target = selections[0] ? AtomicEffectExecutor.findCardById(gameState, selections[0]) : undefined;
    if (target?.cardlocation === 'UNIT') preventNextDestroy(target, instance, gameState.turnCount);
  }
})];

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 201000059
 * Card2 Row: 153
 * Card Row: 153
 * Source CardNo: BT02-W13
 * Package: BT02(R)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 选择你的1个单位，本回合中，那个单位下一次将要被破坏时，防止那次破坏。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '201000059',
  fullName: '骑士的誓言',
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
  rarity: 'R',
  availableRarities: ['R'],
  cardPackage: 'BT02',
  uniqueId: null as any,
};

export default card;
