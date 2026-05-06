import { Card, CardEffect, PlayerState } from '../types/game';
import {
  AtomicEffectExecutor,
  addTempDamage,
  addTempPower,
  canPutUnitOntoBattlefield,
  createSelectCardQuery,
  isAlchemyCard,
  moveCardAsCost,
  putUnitOntoField
} from './BaseUtil';

const isFeijingUnit = (card: Card) => card.type === 'UNIT' && !!card.feijingMark;

const getAllFeijingUnitCosts = (playerState: PlayerState) => [
  ...playerState.unitZone.filter((card): card is Card => !!card && isFeijingUnit(card)),
  ...playerState.hand.filter(isFeijingUnit)
];

const canPutUnitAfterCost = (playerState: PlayerState, costCard: Card, candidate: Card) => {
  const simulatedUnitZone = playerState.unitZone.map(unit =>
    unit?.gamecardId === costCard.gamecardId && costCard.cardlocation === 'UNIT' ? null : unit
  );
  return simulatedUnitZone.some(slot => slot === null) &&
    (!candidate.specialName || !simulatedUnitZone.some(unit => unit?.specialName === candidate.specialName));
};

const getAlchemyDeckCandidates = (playerState: PlayerState, costCard: Card) =>
  playerState.deck.filter(card =>
    card.type === 'UNIT' &&
    isAlchemyCard(card) &&
    !card.godMark &&
    canPutUnitAfterCost(playerState, costCard, card)
  );

const getFeijingUnitCosts = (playerState: PlayerState) =>
  getAllFeijingUnitCosts(playerState).filter(costCard => getAlchemyDeckCandidates(playerState, costCard).length > 0);

const cardEffects: CardEffect[] = [{
  id: '105120256_activate',
  type: 'ACTIVATE',
  triggerLocation: ['UNIT'],
  limitCount: 1,
  limitNameType: true,
  description: '同名1回合1次，你的主要阶段，横置该卡：将战场或手牌中1张菲晶单位送入墓地，从卡组将1张《炼金》非神蚀单位放置到战场，本回合中那个单位+1/+500。',
  condition: (gameState, playerState, instance) =>
    gameState.phase === 'MAIN' &&
    playerState.isTurn &&
    !instance.isExhausted &&
    getFeijingUnitCosts(playerState).length > 0,
  execute: async (instance, gameState, playerState) => {
    await AtomicEffectExecutor.execute(gameState, playerState.uid, {
      type: 'ROTATE_HORIZONTAL',
      targetFilter: { gamecardId: instance.gamecardId }
    }, instance);

    const costs = getFeijingUnitCosts(playerState);
    createSelectCardQuery(
      gameState,
      playerState.uid,
      costs,
      '选择菲晶单位',
      '选择你的战场或手牌中的1张具有【菲晶】的单位卡送入墓地。',
      1,
      1,
      { sourceCardId: instance.gamecardId, effectId: '105120256_activate', step: 'COST' },
      card => card.cardlocation as any
    );
  },
  onQueryResolve: async (instance, gameState, playerState, selections, context) => {
    if (context?.step === 'COST') {
      const selected = selections[0] ? AtomicEffectExecutor.findCardById(gameState, selections[0]) : undefined;
      const ownerUid = selected ? AtomicEffectExecutor.findCardOwnerKey(gameState, selected.gamecardId) : undefined;
      if (
        !selected ||
        ownerUid !== playerState.uid ||
        !isFeijingUnit(selected) ||
        (selected.cardlocation !== 'UNIT' && selected.cardlocation !== 'HAND')
      ) {
        gameState.logs.push(`[${instance.fullName}] 选择的菲晶单位已不合法，效果中止。`);
        return;
      }

      moveCardAsCost(gameState, playerState.uid, selected, 'GRAVE', instance);

      const candidates = getAlchemyDeckCandidates(playerState, selected);
      if (candidates.length === 0) return;
      createSelectCardQuery(
        gameState,
        playerState.uid,
        candidates,
        '选择炼金单位',
        '选择你的卡组中的1张卡名含有《炼金》的非神蚀单位卡放置到单位区。',
        1,
        1,
        { sourceCardId: instance.gamecardId, effectId: '105120256_activate', step: 'PUT_UNIT' },
        () => 'DECK'
      );
      return;
    }

    if (context?.step !== 'PUT_UNIT') return;
    const selected = selections[0] ? AtomicEffectExecutor.findCardById(gameState, selections[0]) : undefined;
    if (
      !selected ||
      selected.cardlocation !== 'DECK' ||
      selected.type !== 'UNIT' ||
      selected.godMark ||
      !isAlchemyCard(selected) ||
      !canPutUnitOntoBattlefield(playerState, selected)
    ) {
      gameState.logs.push(`[${instance.fullName}] 选择的炼金单位已不合法，效果中止。`);
      return;
    }

    const moved = putUnitOntoField(gameState, playerState.uid, selected, instance);
    if (!moved) return;

    addTempDamage(selected, instance, 1);
    addTempPower(selected, instance, 500);
    await AtomicEffectExecutor.execute(gameState, playerState.uid, { type: 'SHUFFLE_DECK' }, instance);
  }
}];

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 105120256
 * Card2 Row: 365
 * Card Row: 296
 * Source CardNo: ST04-Y08
 * Package: ST04(TD)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 启动效果，卡名一回合一次，你的主要阶段，横置该卡：将你的战场或者手牌中一张具有菲晶的单位卡送去墓地，选择你的卡组一张卡名含有炼金的非神蚀单位卡放置到单位区，本回合，那个单位+1/+500
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '105120256',
  fullName: '菲晶炼金士「丽芙塔」',
  specialName: '丽芙塔',
  type: 'UNIT',
  color: 'YELLOW',
  gamecardId: null as any,
  colorReq: { YELLOW: 2 },
  faction: '永生之乡',
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
  rarity: 'U',
  availableRarities: ['U'],
  cardPackage: 'BT04',
  uniqueId: null as any,
};

export default card;
