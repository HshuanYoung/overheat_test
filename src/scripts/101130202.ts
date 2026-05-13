import { Card, CardEffect } from '../types/game';
import { canPutUnitOntoBattlefield, createSelectCardQuery, moveCard } from './BaseUtil';

const cardEffects: CardEffect[] = [{
  id: '101130202_hand_to_field',
  type: 'TRIGGER',
  triggerEvent: 'CARD_ENTERED_ZONE',
  triggerLocation: ['UNIT'],
  description: '入场时，可以选择手牌中这张卡以外的AC+3以下<圣王国>非神蚀单位放置到战场。',
  condition: (_gameState, playerState, instance, event) =>
    event?.sourceCardId === instance.gamecardId &&
    event.data?.zone === 'UNIT' &&
    playerState.hand.some(card =>
      card.gamecardId !== instance.gamecardId &&
      card.id !== '101130202' &&
      card.type === 'UNIT' &&
      card.faction === '圣王国' &&
      !card.godMark &&
      (card.acValue || 0) <= 3 &&
      canPutUnitOntoBattlefield(playerState, card)
    ),
  execute: async (instance, gameState, playerState) => {
    createSelectCardQuery(
      gameState,
      playerState.uid,
      playerState.hand.filter(card =>
        card.id !== '101130202' &&
        card.type === 'UNIT' &&
        card.faction === '圣王国' &&
        !card.godMark &&
        (card.acValue || 0) <= 3 &&
        canPutUnitOntoBattlefield(playerState, card)
      ),
      '选择放置到战场的单位',
      '选择你的手牌中的1张AC+3以下<圣王国>非神蚀单位卡，将其放置到战场。',
      0,
      1,
      { sourceCardId: instance.gamecardId, effectId: '101130202_hand_to_field' },
      () => 'HAND'
    );
  },
  onQueryResolve: async (instance, gameState, playerState, selections) => {
    const target = selections[0] ? playerState.hand.find(card => card.gamecardId === selections[0]) : undefined;
    if (target && canPutUnitOntoBattlefield(playerState, target)) {
      const targetId = target.gamecardId;
      moveCard(gameState, playerState.uid, target, 'UNIT', instance);
      const live = playerState.unitZone.find(card => card?.gamecardId === targetId);
      if (live) {
        live.playedTurn = gameState.turnCount;
        (live as any).data = {
          ...((live as any).data || {}),
          cannotAttackThisTurn: gameState.turnCount,
          cannotAttackThisTurnSourceName: instance.fullName
        };
      }
    }
  }
}];

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 101130202
 * Card2 Row: 228
 * Card Row: 228
 * Source CardNo: BT03-W03
 * Package: BT03(U)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 【诱】:这个单位进入战场时，你可以选择你的手牌中的1张《南征军的弓兵》以外的ACCESS值+3以下的<圣王国>非神蚀单位卡，将其放置到战场上。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '101130202',
  fullName: '南征军的弓兵',
  specialName: '',
  type: 'UNIT',
  color: 'WHITE',
  gamecardId: null as any,
  colorReq: { WHITE: 1 },
  faction: '圣王国',
  acValue: 3,
  power: 2500,
  basePower: 2500,
  damage: 2,
  baseDamage: 2,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  isExhausted: false,
  isrush: false,
  canAttack: true,
  feijingMark: false,
  canResetCount: 0,
  effects: cardEffects,
  rarity: 'U',
  availableRarities: ['U'],
  cardPackage: 'BT03',
  uniqueId: null as any,
};

export default card;
