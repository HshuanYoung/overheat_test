import { Card, CardEffect, GameEvent } from '../types/game';
import { AtomicEffectExecutor, createSelectCardQuery, faceUpErosion, moveCard, moveCardAsCost, ownUnits } from './BaseUtil';

const cardEffects: CardEffect[] = [{
  id: '101140230_enter_search_story',
  type: 'TRIGGER',
  triggerLocation: ['UNIT'],
  triggerEvent: 'CARD_ENTERED_ZONE',
  description: '进入战场时，若对手单位比你多2个以上，送墓2张白色正面侵蚀，可将卡组中1张ACCESS+2白色故事卡加入手牌。',
  condition: (gameState, playerState, instance, event?: GameEvent) => {
    if (event?.sourceCardId !== instance.gamecardId || event.data?.zone !== 'UNIT') return false;
    const opponentUid = gameState.playerIds.find(uid => uid !== playerState.uid)!;
    const opponentUnits = ownUnits(gameState.players[opponentUid]).length;
    const ownUnitCount = ownUnits(playerState).length;
    return opponentUnits >= ownUnitCount + 2 &&
      faceUpErosion(playerState).filter(card => card.color === 'WHITE').length >= 2;
  },
  cost: async (gameState, playerState, instance) => {
    const targets = faceUpErosion(playerState).filter(card => card.color === 'WHITE');
    if (targets.length < 2) return false;
    createSelectCardQuery(
      gameState,
      playerState.uid,
      targets,
      '选择白色侵蚀卡',
      '选择侵蚀区中的2张白色正面卡送入墓地作为费用。',
      2,
      2,
      { sourceCardId: instance.gamecardId, effectId: '101140230_enter_search_story', step: 'COST' },
      () => 'EROSION_FRONT'
    );
    return true;
  },
  execute: async (instance, gameState, playerState) => {
    const candidates = playerState.deck.filter(card => card.type === 'STORY' && card.color === 'WHITE' && (card.acValue || 0) === 2);
    if (candidates.length === 0) return;
    createSelectCardQuery(
      gameState,
      playerState.uid,
      candidates,
      '选择故事卡',
      '选择卡组中的1张ACCESS值+2的白色故事卡加入手牌。',
      0,
      1,
      { sourceCardId: instance.gamecardId, effectId: '101140230_enter_search_story', step: 'SEARCH' },
      () => 'DECK'
    );
  },
  onQueryResolve: async (instance, gameState, playerState, selections, context) => {
    if (context?.step === 'COST') {
      selections.forEach(id => {
        const target = playerState.erosionFront.find(card => card?.gamecardId === id);
        if (target) moveCardAsCost(gameState, playerState.uid, target, 'GRAVE', instance);
      });
      return;
    }
    if (context?.step !== 'SEARCH') return;
    const selected = selections[0] ? AtomicEffectExecutor.findCardById(gameState, selections[0]) : undefined;
    if (selected?.cardlocation === 'DECK') {
      moveCard(gameState, playerState.uid, selected, 'HAND', instance);
      await AtomicEffectExecutor.execute(gameState, playerState.uid, { type: 'SHUFFLE_DECK' }, instance);
    }
  }
}];

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 101140230
 * Card2 Row: 397
 * Card Row: 267
 * Source CardNo: BT05-W01
 * Package: BT05(R)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 【诱】{这个单位进入战场时，战场上的对手单位比你的单位多2个以上}[将你的侵蚀区中的2张白色正面卡送入墓地]:你可以将你的卡组中的1张ACCESS值+2的白色故事卡加入手牌。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '101140230',
  fullName: '天翼的追随者「丝米娅」',
  specialName: '丝米娅',
  type: 'UNIT',
  color: 'WHITE',
  gamecardId: null as any,
  colorReq: {},
  faction: '女神教会',
  acValue: 3,
  power: 2500,
  basePower: 2500,
  damage: 2,
  baseDamage: 2,
  godMark: true,
  displayState: 'FRONT_UPRIGHT',
  isExhausted: false,
  isrush: false,
  canAttack: true,
  feijingMark: false,
  canResetCount: 0,
  effects: cardEffects,
  rarity: 'R',
  availableRarities: ['R'],
  cardPackage: 'BT05',
  uniqueId: null as any,
};

export default card;
