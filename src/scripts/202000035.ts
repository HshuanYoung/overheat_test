import { Card, CardEffect, TriggerLocation } from '../types/game';
import { allCardsOnField, createSelectCardQuery, destroyByEffect, story } from './BaseUtil';

const cardEffects: CardEffect[] = [story('202000035_destroy', '选择1张非神蚀道具卡或1个力量2500以下非神蚀单位破坏。', async (instance, gameState, playerState) => {
    const candidates = allCardsOnField(gameState).filter(card => !card.godMark && ((card.type === 'ITEM' || card.isEquip) || (card.type === 'UNIT' && (card.power || 0) <= 2500)));
    if (candidates.length === 0) return;
    createSelectCardQuery(
      gameState,
      playerState.uid,
      candidates,
      '选择破坏对象',
      '选择1张非神蚀道具卡或1个力量2500以下的非神蚀单位，将其破坏。',
      1,
      1,
      { sourceCardId: instance.gamecardId, effectId: '202000035_destroy' },
      card => card.cardlocation || 'UNIT'
    );
  }, {
    condition: gameState => allCardsOnField(gameState).some(card => !card.godMark && ((card.type === 'ITEM' || card.isEquip) || (card.type === 'UNIT' && (card.power || 0) <= 2500))),
    targetSpec: {
      title: '选择破坏对象',
      description: '选择1张非神蚀道具卡或1个力量2500以下的非神蚀单位，将其破坏。',
      minSelections: 1,
      maxSelections: 1,
      zones: ['UNIT', 'ITEM'],
      getCandidates: gameState => allCardsOnField(gameState)
        .filter(card => !card.godMark && ((card.type === 'ITEM' || card.isEquip) || (card.type === 'UNIT' && (card.power || 0) <= 2500)))
        .map(card => ({ card, source: card.cardlocation as any }))
    },
    onQueryResolve: async (instance, gameState, _playerState, selections) => {
      const target = allCardsOnField(gameState).find(card => card.gamecardId === selections[0]);
    if (target) destroyByEffect(gameState, target, instance);
    }
  })];

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 202000035
 * Card2 Row: 53
 * Card Row: 53
 * Source CardNo: BT01-R15
 * Package: ST01(TD),BT01(C)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 选择1张非神蚀道具卡或1个〖力量2500〗以下的非神蚀单位，将其破坏。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '202000035',
  fullName: '魔兽讨伐',
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
  cardPackage: 'BT01',
  uniqueId: null as any,
};

export default card;
