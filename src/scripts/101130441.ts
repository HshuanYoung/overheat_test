import { Card, CardEffect } from '../types/game';
import { AtomicEffectExecutor, addTempPower, canActivateDefaultTiming, canPutUnitOntoBattlefield, createSelectCardQuery, ensureDeckHasCardsForMove, getOpponentUid, getTopDeckCards, isNonGodUnit, moveCard, nameContains, ownUnits, readyByEffect } from './BaseUtil';

const cardEffects: CardEffect[] = [{
  id: '101130441_track_hall_attack',
  type: 'TRIGGER',
  triggerEvent: 'CARD_ATTACK_DECLARED',
  triggerLocation: ['UNIT'],
  isGlobal: true,
  isMandatory: true,
  description: '记录本回合卡名含有《殿堂》的单位参与攻击次数。',
  condition: (gameState, playerState, _instance, event) => {
    if (event?.playerUid !== playerState.uid) return false;
    const attackers = (event.data?.attackerIds || [])
      .map((id: string) => AtomicEffectExecutor.findCardById(gameState, id))
      .filter((card: Card | undefined): card is Card => !!card);
    return attackers.some(unit => nameContains(unit, '殿堂'));
  },
  execute: async (_instance, gameState, playerState) => {
    (playerState as any).hallAttackCountTurn = gameState.turnCount;
    (playerState as any).hallAttackCount = Number((playerState as any).hallAttackCount || 0) + 1;
  }
}, {
  id: '101130441_reset_boost',
  type: 'ACTIVATE',
  triggerLocation: ['UNIT'],
  limitCount: 1,
  description: '1回合1次：放逐墓地3张卡，选择战场上1个<圣王国>非神蚀单位，重置并本回合力量+500。',
  condition: (gameState, playerState) =>
    canActivateDefaultTiming(gameState, playerState) &&
    playerState.grave.length >= 3 &&
    ownUnits(playerState).some(unit => unit.isExhausted && unit.faction === '圣王国' && isNonGodUnit(unit)),
  execute: async (instance, gameState, playerState) => {
    createSelectCardQuery(gameState, playerState.uid, playerState.grave, '选择放逐费用', '选择墓地中的3张卡放逐作为费用。', 3, 3, {
      sourceCardId: instance.gamecardId,
      effectId: '101130441_reset_boost',
      step: 'COST'
    }, () => 'GRAVE');
  },
  onQueryResolve: async (instance, gameState, playerState, selections, context) => {
    if (context?.step === 'COST') {
      selections.forEach(id => {
        const card = AtomicEffectExecutor.findCardById(gameState, id);
        if (card?.cardlocation === 'GRAVE') moveCard(gameState, playerState.uid, card, 'EXILE', instance);
      });
      createSelectCardQuery(gameState, playerState.uid, ownUnits(playerState).filter(unit => unit.isExhausted && unit.faction === '圣王国' && isNonGodUnit(unit)), '选择重置单位', '选择战场上1个横置的<圣王国>非神蚀单位，重置并本回合力量+500。', 1, 1, {
        sourceCardId: instance.gamecardId,
        effectId: '101130441_reset_boost',
        step: 'TARGET'
      });
      return;
    }
    const target = selections[0] ? AtomicEffectExecutor.findCardById(gameState, selections[0]) : undefined;
    if (target?.cardlocation !== 'UNIT' || !target.isExhausted) return;
    readyByEffect(gameState, target, instance);
    addTempPower(target, instance, 500);
  }
}, {
  id: '101130441_ten_mill_exile',
  type: 'ACTIVATE',
  triggerLocation: ['UNIT'],
  erosionTotalLimit: [10, 10],
  limitCount: 1,
  description: '10+：本回合进行过10次以上卡名含有《殿堂》的单位参与的攻击时，将对手卡组顶5张正面放逐。',
  condition: (gameState, playerState) =>
    canActivateDefaultTiming(gameState, playerState) &&
    (playerState as any).hallAttackCountTurn === gameState.turnCount &&
    Number((playerState as any).hallAttackCount || 0) >= 10,
  execute: async (instance, gameState, playerState) => {
    const opponentUid = getOpponentUid(gameState, playerState.uid);
    if (!ensureDeckHasCardsForMove(gameState, opponentUid, 5, instance)) return;
    getTopDeckCards(gameState.players[opponentUid], 5).forEach(card => moveCard(gameState, opponentUid, card, 'EXILE', instance));
  }
}];

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 101130441
 * Card2 Row: 318
 * Card Row: 557
 * Source CardNo: BT04-W07
 * Package: BT04(SR)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 【启】〖1回合1次〗：[将你的墓地中的3张卡放逐]选择战场上的1个<圣王国>的非神蚀单位，将其重置，本回合中〖力量+500〗。
 * 〖10+〗【启】〖一回合一次〗：这个能力只能在你进行过10次以上卡名含有《殿堂》的单位参与的攻击的回合中发动。将对手的卡组顶的5张卡正面放逐。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '101130441',
  fullName: '圣王子「卢恩」',
  specialName: '卢恩',
  type: 'UNIT',
  color: 'WHITE',
  gamecardId: null as any,
  colorReq: { WHITE: 2 },
  faction: '圣王国',
  acValue: 3,
  power: 2000,
  basePower: 2000,
  damage: 1,
  baseDamage: 1,
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
  cardPackage: 'BT04',
  uniqueId: null as any,
};

export default card;
