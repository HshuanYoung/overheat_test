import { Card, CardEffect } from '../types/game';
import { AtomicEffectExecutor, canPutUnitOntoBattlefield, createSelectCardQuery, moveCard, ownUnits, putUnitOntoField, story } from './BaseUtil';

const cardEffects: CardEffect[] = [story('203000128_awaken', '同名1回合1次：将你的1个有指定名神蚀单位返回手牌，选择墓地中指定名相同但卡名不同的单位放置到战场。', async (instance, gameState, playerState) => {
  createSelectCardQuery(gameState, playerState.uid, ownUnits(playerState).filter(unit => unit.godMark && !!unit.specialName), '选择返回单位', '选择你的1个具有指定名的神蚀单位返回手牌。', 1, 1, {
    sourceCardId: instance.gamecardId,
    effectId: '203000128_awaken',
    step: 'BOUNCE'
  });
}, {
  limitCount: 1,
  limitNameType: true,
  condition: (_gameState, playerState) => ownUnits(playerState).some(unit =>
    unit.godMark &&
    !!unit.specialName &&
    playerState.grave.some(card => card.type === 'UNIT' && card.specialName === unit.specialName && card.fullName !== unit.fullName)
  ),
  targetSpec: {
    title: '选择返回单位',
    description: '选择你的1个具有指定名的神蚀单位返回手牌。',
    minSelections: 1,
    maxSelections: 1,
    zones: ['UNIT'],
    controller: 'SELF',
    step: 'BOUNCE',
    getCandidates: (_gameState, playerState) => ownUnits(playerState)
      .filter(unit =>
        unit.godMark &&
        !!unit.specialName &&
        playerState.grave.some(card => card.type === 'UNIT' && card.specialName === unit.specialName && card.fullName !== unit.fullName)
      )
      .map(card => ({ card, source: 'UNIT' as any }))
  },
  onQueryResolve: async (instance, gameState, playerState, selections, context) => {
    if (context?.step === 'BOUNCE') {
      const bounced = selections[0] ? AtomicEffectExecutor.findCardById(gameState, selections[0]) : undefined;
      if (!bounced?.specialName || bounced.cardlocation !== 'UNIT') return;
      const specialName = bounced.specialName;
      const fullName = bounced.fullName;
      moveCard(gameState, playerState.uid, bounced, 'HAND', instance);
      const candidates = playerState.grave.filter(card =>
        card.type === 'UNIT' &&
        card.specialName === specialName &&
        card.fullName !== fullName &&
        canPutUnitOntoBattlefield(playerState, card)
      );
      createSelectCardQuery(gameState, playerState.uid, candidates, '选择登场单位', '选择墓地中指定名相同、卡名不同的1张单位卡放置到战场。', 1, 1, {
        sourceCardId: instance.gamecardId,
        effectId: '203000128_awaken',
        step: 'FIELD'
      }, () => 'GRAVE');
      return;
    }
    const selected = selections[0] ? AtomicEffectExecutor.findCardById(gameState, selections[0]) : undefined;
    if (selected?.cardlocation === 'GRAVE') putUnitOntoField(gameState, playerState.uid, selected, instance);
  }
})];

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 203000128
 * Card2 Row: 299
 * Card Row: 538
 * Source CardNo: BT04-G08
 * Package: BT04(R)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 〖同名1回合1次〗：将你的1个具有指定名的神蚀单位返回持有者的手牌，选择你墓地中的1张与那个单位指定名相同、卡名不同的单位卡，将其放置到战场上。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '203000128',
  fullName: '魔女觉醒',
  specialName: '',
  type: 'STORY',
  color: 'GREEN',
  gamecardId: null as any,
  colorReq: { GREEN: 1 },
  faction: '无',
  acValue: 0,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  feijingMark: false,
  canResetCount: 0,
  effects: cardEffects,
  rarity: 'R',
  availableRarities: ['R'],
  cardPackage: 'BT04',
  uniqueId: null as any,
};

export default card;
