import { Card, CardEffect, TriggerLocation } from '../types/game';
import { AtomicEffectExecutor, addInfluence, canPutUnitOntoBattlefield, createSelectCardQuery, ensureData, grantedTotemReviveFromGrave, moveCard, ownerOf } from './BaseUtil';

const cardEffects: CardEffect[] = [{
  id: '103080184_end_search',
  type: 'TRIGGER',
  triggerEvent: 'TURN_END' as any,
  triggerLocation: ['UNIT'],
  isMandatory: true,
  description: '你的回合结束时，选择卡组或墓地1张卡名含有《降灵》的卡加入手牌。',
  condition: (_gameState, playerState, _instance, event) =>
    event?.playerUid === playerState.uid &&
    [...playerState.deck, ...playerState.grave].some(card => card.fullName.includes('降灵')),
  execute: async (instance, gameState, playerState) => {
    const options = [
      ...playerState.deck.filter(card => card.fullName.includes('降灵')),
      ...playerState.grave.filter(card => card.fullName.includes('降灵'))
    ];
    createSelectCardQuery(
      gameState,
      playerState.uid,
      options,
      '选择加入手牌的卡',
      '选择你的卡组或墓地中的1张卡名含有《降灵》的卡，将其加入手牌。',
      1,
      1,
      { sourceCardId: instance.gamecardId, effectId: '103080184_end_search' },
      card => card.cardlocation as TriggerLocation
    );
  },
  onQueryResolve: async (instance, gameState, playerState, selections) => {
    const target = selections[0] ? AtomicEffectExecutor.findCardById(gameState, selections[0]) : undefined;
    if (!target) return;
    const fromDeck = target.cardlocation === 'DECK';
    moveCard(gameState, playerState.uid, target, 'HAND', instance);
    if (fromDeck) await AtomicEffectExecutor.execute(gameState, playerState.uid, { type: 'SHUFFLE_DECK' }, instance);
  }
}, {
  id: '103080184_totem_grant',
  type: 'CONTINUOUS',
  triggerLocation: ['UNIT'],
  erosionTotalLimit: [2, 4],
  description: '2~4：你的所有卡名含有《图腾》的单位卡获得从墓地发动并回场的能力。',
  applyContinuous: (gameState, instance) => {
    const owner = ownerOf(gameState, instance);
    if (!owner) return;
    [...owner.grave, ...owner.unitZone].forEach(card => {
      if (!card || card.type !== 'UNIT' || !card.fullName.includes('图腾')) return;
      if (!card.effects) card.effects = [];
      if (!card.effects.some(effect => effect.id === '103080184_granted_totem_revive')) {
        card.effects.push(grantedTotemReviveFromGrave());
      }
      const data = ensureData(card);
      data.grantedTotemReviveBy103080184 = instance.gamecardId;
      data.grantedTotemReviveSourceName = instance.fullName;
      addInfluence(card, instance, '获得能力：可从墓地发动并回场');
    });
  }
}];

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 103080184
 * Card2 Row: 197
 * Card Row: 197
 * Source CardNo: BT03-G06
 * Package: BT03(SR,ESR,OHR)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 【诱】:你的回合结束时，选择你的卡组或墓地中的1张卡名含有《降灵》的卡，将其加入手牌。
 * 〖2~4〗【永】:你的所有卡名含有《图腾》的单位卡获得“【启】:[舍弃2张手牌]这个能力只能从墓地发动，将这张卡放置到战场上。”的能力。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '103080184',
  fullName: '神木大灵萨「温多娜」',
  specialName: '温多娜',
  type: 'UNIT',
  color: 'GREEN',
  gamecardId: null as any,
  colorReq: { GREEN: 2 },
  faction: '神木森',
  acValue: 2,
  power: 500,
  basePower: 500,
  damage: 0,
  baseDamage: 0,
  godMark: true,
  displayState: 'FRONT_UPRIGHT',
  isExhausted: false,
  isrush: false,
  canAttack: true,
  feijingMark: false,
  canResetCount: 0,
  effects: cardEffects,
  rarity: 'SR',
  availableRarities: ['SR'],
  cardPackage: 'BT03',
  uniqueId: null as any,
};

export default card;
