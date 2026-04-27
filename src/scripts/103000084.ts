import { Card, CardEffect, TriggerLocation } from '../types/game';
import { AtomicEffectExecutor, addInfluence, addTempKeyword, canPutUnitOntoBattlefield, createSelectCardQuery, erosionCost, getOpponentUid, isNonGodUnit, moveCard, ownUnits } from './BaseUtil';

const cardEffects: CardEffect[] = [{
    id: '103000084_grave_entry',
    type: 'ACTIVATE',
    triggerLocation: ['GRAVE'],
    description: '主要阶段，从墓地发动：将你战场上3个非神蚀单位送入墓地，将此卡放置到战场，本回合获得速攻、歼灭。',
    condition: (gameState, playerState) => gameState.phase === 'MAIN' && playerState.isTurn && ownUnits(playerState).filter(unit => AtomicEffectExecutor.matchesColor(unit, 'GREEN')).length >= 2 && ownUnits(playerState).filter(isNonGodUnit).length >= 3 && canPutUnitOntoBattlefield(playerState, playerState.grave.find(card => card.id === '103000084') as Card),
    execute: async (instance, gameState, playerState) => {
      const candidates = ownUnits(playerState).filter(isNonGodUnit);
      createSelectCardQuery(
        gameState,
        playerState.uid,
        candidates,
        '选择送入墓地的单位',
        '选择你的战场上的3个非神蚀单位送入墓地。',
        3,
        3,
        { sourceCardId: instance.gamecardId, effectId: '103000084_grave_entry', step: 'SEND_UNITS' }
      );
    },
    onQueryResolve: async (instance, gameState, playerState, selections, context) => {
      if (context?.step !== 'SEND_UNITS') return;
      selections
        .map(id => ownUnits(playerState).find(unit => unit.gamecardId === id))
        .filter((unit): unit is Card => !!unit)
        .forEach(unit => moveCard(gameState, playerState.uid, unit, 'GRAVE', instance));
      if (instance.cardlocation === 'GRAVE') moveCard(gameState, playerState.uid, instance, 'UNIT', instance);
      addTempKeyword(instance, instance, 'rush');
      addTempKeyword(instance, instance, 'annihilation');
    }
  }, {
    id: '103000084_ten_plus_tap',
    type: 'ACTIVATE',
    triggerLocation: ['UNIT'],
    limitCount: 1,
    limitGlobal: true,
    erosionTotalLimit: [10, 99],
    description: '10+，1游戏1次，侵蚀2：横置对手最多2个非神蚀单位；下次对手回合开始不能重置。',
    cost: erosionCost(2),
    execute: async (instance, gameState, playerState) => {
      const opponent = gameState.players[getOpponentUid(gameState, playerState.uid)];
      const candidates = ownUnits(opponent).filter(unit => !unit.godMark);
      if (candidates.length === 0) return;
      const count = Math.min(2, candidates.length);
      createSelectCardQuery(
        gameState,
        playerState.uid,
        candidates,
        '选择横置单位',
        `选择对手的${count}个非神蚀单位，将其横置。`,
        count,
        count,
        { sourceCardId: instance.gamecardId, effectId: '103000084_ten_plus_tap' }
      );
    },
    onQueryResolve: async (instance, gameState, _playerState, selections) => {
      Object.values(gameState.players)
        .flatMap(player => ownUnits(player))
        .filter(unit => selections.includes(unit.gamecardId))
        .forEach(unit => {
        unit.isExhausted = true;
        unit.canResetCount = 1;
        addInfluence(unit, instance, '下个重置阶段不能重置');
      });
    }
  }];

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 103000084
 * Card2 Row: 32
 * Card Row: 32
 * Source CardNo: BT01-G11
 * Package: BT01(SR,ESR,OHR)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 【启】:[〖我方单位区有两个或者以上的绿色单位〗，将你的战场上的3个非神蚀单位送入墓地]这个能力只能在你的主要阶段中从墓地发动，且不能用于对抗。将这张卡放置到战场上，本回合中，这个单位获得【速攻】【歼灭】。 
 * 〖10+〗 【启】〖1游戏1次〗:[〖侵蚀2〗]选择对手的2个非神蚀单位，将其横置。下次对手的回合开始阶段中，那些单位不能重置。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '103000084',
  fullName: '苍穹的飞狮「奇美拉」',
  specialName: '奇美拉',
  type: 'UNIT',
  color: 'GREEN',
  gamecardId: null as any,
  colorReq: { GREEN: 2 },
  faction: '无',
  acValue: 3,
  power: 3500,
  basePower: 3500,
  damage: 3,
  baseDamage: 3,
  godMark: true,
  displayState: 'FRONT_UPRIGHT',
  isExhausted: false,
  isrush: true,
  isAnnihilation: true,
  canAttack: true,
  feijingMark: false,
  canResetCount: 0,
  effects: cardEffects,
  rarity: 'SR',
  availableRarities: ['SR', 'SER'],
  cardPackage: 'BT01',
  uniqueId: null as any,
};

export default card;
