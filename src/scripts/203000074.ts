import { Card, CardEffect } from '../types/game';
import { AtomicEffectExecutor, createSelectCardQuery, moveCard, story } from './BaseUtil';

const cardEffects: CardEffect[] = [story('203000074_return_god', '选择墓地中1张力量2000以下神蚀单位卡加入手牌。', async (instance, gameState, playerState) => {
  const targets = playerState.grave.filter(card => card.type === 'UNIT' && card.godMark && (card.power || card.basePower || 0) <= 2000);
  if (targets.length === 0) return;
  createSelectCardQuery(gameState, playerState.uid, targets, '选择加入手牌的单位', '选择你的墓地中的1张力量2000以下神蚀单位卡，将其加入手牌。', 1, 1, { sourceCardId: instance.gamecardId, effectId: '203000074_return_god' }, () => 'GRAVE');
}, {
  targetSpec: {
    title: '选择加入手牌的单位',
    description: '选择你的墓地中的1张力量2000以下神蚀单位卡，将其加入手牌。',
    minSelections: 1,
    maxSelections: 1,
    zones: ['GRAVE'],
    controller: 'SELF',
    getCandidates: (_gameState, playerState) => playerState.grave
      .filter(card => card.type === 'UNIT' && card.godMark && (card.power || card.basePower || 0) <= 2000)
      .map(card => ({ card, source: 'GRAVE' as any }))
  },
  onQueryResolve: async (instance, gameState, playerState, selections) => {
    const target = selections[0] ? AtomicEffectExecutor.findCardById(gameState, selections[0]) : undefined;
    if (target?.cardlocation === 'GRAVE') moveCard(gameState, playerState.uid, target, 'HAND', instance);
  }
})];

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 203000074
 * Card2 Row: 205
 * Card Row: 205
 * Source CardNo: BT03-G14
 * Package: BT03(C)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 选择你的墓地中的1张〖力量2000〗以下的神蚀单位卡，将其加入手牌。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '203000074',
  fullName: '新芽',
  specialName: '',
  type: 'STORY',
  color: 'GREEN',
  gamecardId: null as any,
  colorReq: { GREEN: 1 },
  faction: '无',
  acValue: 2,
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
