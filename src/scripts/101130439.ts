import { Card, CardEffect } from '../types/game';
import { AtomicEffectExecutor, canActivateDefaultTiming, createSelectCardQuery, exhaustCost, nameContains, ownUnits, readyByEffect } from './BaseUtil';

const cardEffects: CardEffect[] = [{
  id: '101130439_reset_hall',
  type: 'ACTIVATE',
  triggerLocation: ['UNIT'],
  limitCount: 1,
  description: '横置：选择这个单位以外你的1个卡名含有《殿堂》的单位，将其重置。',
  cost: exhaustCost,
  condition: (gameState, playerState, instance) =>
    canActivateDefaultTiming(gameState, playerState) &&
    !instance.isExhausted &&
    ownUnits(playerState).some(unit => unit.gamecardId !== instance.gamecardId && unit.isExhausted && nameContains(unit, '殿堂')),
  execute: async (instance, gameState, playerState) => {
    createSelectCardQuery(
      gameState,
      playerState.uid,
      ownUnits(playerState).filter(unit => unit.gamecardId !== instance.gamecardId && unit.isExhausted && nameContains(unit, '殿堂')),
      '选择重置单位',
      '选择这个单位以外你的1个卡名含有《殿堂》的单位，将其重置。',
      1,
      1,
      { sourceCardId: instance.gamecardId, effectId: '101130439_reset_hall' }
    );
  },
  onQueryResolve: async (instance, gameState, _playerState, selections) => {
    const target = selections[0] ? AtomicEffectExecutor.findCardById(gameState, selections[0]) : undefined;
    if (target?.cardlocation === 'UNIT') readyByEffect(gameState, target, instance);
  },
  targetSpec: {
    title: '选择重置单位',
    description: '选择这个单位以外你的1个卡名含有《殿堂》的单位，将其重置。',
    minSelections: 1,
    maxSelections: 1,
    zones: ['UNIT'],
    controller: 'SELF',
    getCandidates: (_gameState, playerState, instance) => ownUnits(playerState)
      .filter(unit => unit.gamecardId !== instance.gamecardId && unit.isExhausted && nameContains(unit, '殿堂'))
      .map(card => ({ card, source: 'UNIT' as any }))
  }
}];

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 101130439
 * Card2 Row: 316
 * Card Row: 555
 * Source CardNo: BT04-W05
 * Package: BT04(C)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 【启】〖1回合1次〗：〖横置〗选择这个单位以外的你的1个卡名含有《殿堂》的单位，将其重置。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '101130439',
  fullName: '殿堂骑士·神羽',
  specialName: '',
  type: 'UNIT',
  color: 'WHITE',
  gamecardId: null as any,
  colorReq: {},
  faction: '圣王国',
  acValue: 2,
  power: 2000,
  basePower: 2000,
  damage: 1,
  baseDamage: 1,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  isExhausted: false,
  isrush: false,
  canAttack: true,
  feijingMark: false,
  canResetCount: 0,
  effects: cardEffects,
  rarity: 'C',
  availableRarities: ['C'],
  cardPackage: 'BT04',
  uniqueId: null as any,
};

export default card;
