import { Card, CardEffect } from '../types/game';
import { AtomicEffectExecutor, allCardsOnField, createSelectCardQuery, discardHandCost, isNonGodFieldCard, story } from './BaseUtil';

const cardEffects: CardEffect[] = [story('202000087_destroy_two', '主要阶段中，舍弃2张手牌。之后选择战场上的最多2张非神蚀卡破坏。', async (instance, gameState, playerState) => {
  const targets = allCardsOnField(gameState).filter(isNonGodFieldCard);
  createSelectCardQuery(
    gameState,
    playerState.uid,
    targets,
    '选择破坏目标',
    '选择战场上的最多2张非神蚀卡破坏。',
    0,
    Math.min(2, targets.length),
    { sourceCardId: instance.gamecardId, effectId: '202000087_destroy_two' },
    card => card.cardlocation as any
  );
}, {
  limitCount: 1,
  limitNameType: true,
  condition: (gameState, playerState) =>
    gameState.phase === 'MAIN' &&
    playerState.isTurn &&
    playerState.hand.length >= 2 &&
    allCardsOnField(gameState).some(isNonGodFieldCard),
  cost: discardHandCost(2),
  onQueryResolve: async (instance, gameState, playerState, selections) => {
    for (const id of selections) {
      await AtomicEffectExecutor.execute(gameState, playerState.uid, { type: 'DESTROY_CARD', targetFilter: { gamecardId: id } }, instance);
    }
  }
})];

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 202000087
 * Card2 Row: 415
 * Card Row: 285
 * Source CardNo: BT05-R09
 * Package: BT05(R)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 〖同名1回合1次〗{你的主要阶段}:舍弃2张手牌。之后，选择战场上的最多2张非神蚀卡，将其破坏。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '202000087',
  fullName: '炎雨',
  specialName: '',
  type: 'STORY',
  color: 'RED',
  gamecardId: null as any,
  colorReq: { RED: 1 },
  faction: '无',
  acValue: 1,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  feijingMark: false,
  canResetCount: 0,
  effects: cardEffects,
  rarity: 'R',
  availableRarities: ['R'],
  cardPackage: 'BT05',
  uniqueId: null as any,
};

export default card;
