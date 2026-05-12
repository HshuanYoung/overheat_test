import { Card, CardEffect, TriggerLocation } from '../types/game';
import { createSelectCardQuery, faceUpErosion, getOpponentUid, moveCard, story } from './BaseUtil';

const cardEffects: CardEffect[] = [story('203000031_flip', '同名1回合1次：选择对手侵蚀区中的1张正面卡，转为背面。', async (instance, gameState, playerState) => {
    const opponent = gameState.players[getOpponentUid(gameState, playerState.uid)];
    const candidates = faceUpErosion(opponent);
    if (candidates.length === 0) return;
    createSelectCardQuery(
      gameState,
      playerState.uid,
      candidates,
      '选择翻面的侵蚀卡',
      '选择对手侵蚀区中的1张正面卡，将其转为背面。',
      1,
      1,
      { sourceCardId: instance.gamecardId, effectId: '203000031_flip' },
      () => 'EROSION_FRONT'
    );
  }, {
    limitCount: 1,
    limitNameType: true,
    condition: (gameState, playerState) => faceUpErosion(gameState.players[getOpponentUid(gameState, playerState.uid)]).length > 0,
    targetSpec: {
      title: '选择翻面的侵蚀卡',
      description: '选择对手侵蚀区中的1张正面卡，将其转为背面。',
      minSelections: 1,
      maxSelections: 1,
      zones: ['EROSION_FRONT'],
      controller: 'OPPONENT',
      getCandidates: (gameState, playerState) => faceUpErosion(gameState.players[getOpponentUid(gameState, playerState.uid)])
        .map(card => ({ card, source: 'EROSION_FRONT' as any }))
    },
    onQueryResolve: async (instance, gameState, playerState, selections) => {
      const opponent = gameState.players[getOpponentUid(gameState, playerState.uid)];
      const target = faceUpErosion(opponent).find(card => card.gamecardId === selections[0]);
      if (target) moveCard(gameState, opponent.uid, target, 'EROSION_BACK', instance, { faceDown: true });
    }
  })];

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 203000031
 * Card2 Row: 36
 * Card Row: 36
 * Source CardNo: BT01-G15
 * Package: BT01(U)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 〖同名1回合1次〗选择对手的侵蚀区中的1张正面卡，将其转为背面。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '203000031',
  fullName: '偷偷潜入的黑暗',
  specialName: '',
  type: 'STORY',
  color: 'GREEN',
  gamecardId: null as any,
  colorReq: { GREEN: 1 },
  faction: '无',
  acValue: 4,
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
