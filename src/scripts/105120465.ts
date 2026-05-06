import { Card, CardEffect, PlayerState } from '../types/game';
import { AtomicEffectExecutor, createSelectCardQuery, isAlchemyCard, moveCard } from './BaseUtil';

const getDecomposeTargets = (playerState: PlayerState) =>
  playerState.unitZone.filter((unit): unit is Card =>
    !!unit &&
    unit.type === 'UNIT' &&
    isAlchemyCard(unit) &&
    (unit as any).data?.lastMovedFromZone === 'DECK' &&
    (unit as any).data?.lastMovedToZone === 'UNIT'
  );

const cardEffects: CardEffect[] = [{
  id: '105120465_decompose',
  type: 'ACTIVATE',
  triggerLocation: ['UNIT'],
  limitCount: 1,
  limitNameType: true,
  description: '同名1回合1次，你的主要阶段：将你的战场上1张从卡组放置到战场的《炼金》单位放置到卡组底，洗切卡组后抽2张卡。',
  condition: (gameState, playerState) =>
    gameState.phase === 'MAIN' &&
    playerState.isTurn &&
    getDecomposeTargets(playerState).length > 0,
  execute: async (instance, gameState, playerState) => {
    createSelectCardQuery(
      gameState,
      playerState.uid,
      getDecomposeTargets(playerState),
      '选择炼金单位',
      '选择你的战场上1张从卡组放置到战场的卡名含有《炼金》的单位，将其放置到卡组底。之后洗切卡组并抽2张卡。',
      1,
      1,
      { sourceCardId: instance.gamecardId, effectId: '105120465_decompose' },
      () => 'UNIT'
    );
  },
  onQueryResolve: async (instance, gameState, playerState, selections, context) => {
    if (context?.effectId !== '105120465_decompose') return;

    const target = selections[0] ? AtomicEffectExecutor.findCardById(gameState, selections[0]) : undefined;
    const ownerUid = target ? AtomicEffectExecutor.findCardOwnerKey(gameState, target.gamecardId) : undefined;
    if (
      !target ||
      ownerUid !== playerState.uid ||
      target.cardlocation !== 'UNIT' ||
      target.type !== 'UNIT' ||
      !isAlchemyCard(target) ||
      (target as any).data?.lastMovedFromZone !== 'DECK' ||
      (target as any).data?.lastMovedToZone !== 'UNIT'
    ) {
      gameState.logs.push(`[${instance.fullName}] 选择的炼金单位已不合法，效果中止。`);
      return;
    }

    moveCard(gameState, playerState.uid, target, 'DECK', instance, { insertAtBottom: true });
    await AtomicEffectExecutor.execute(gameState, playerState.uid, { type: 'SHUFFLE_DECK' }, instance);
    await AtomicEffectExecutor.execute(gameState, playerState.uid, { type: 'DRAW', value: 2 }, instance);
  }
}];

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 105120465
 * Card2 Row: 352
 * Card Row: 592
 * Source CardNo: ST03-Y09
 * Package: ST04(TD)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 启动效果，卡名一回合一次，你的主要阶段：将你的战场上的一张从卡组放置到战场的卡名带有炼金的单位放置到卡组底，将你卡组洗切之后抽两张卡。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '105120465',
  fullName: '炼金分解士「妮妮」',
  specialName: '妮妮',
  type: 'UNIT',
  color: 'YELLOW',
  gamecardId: null as any,
  colorReq: { YELLOW: 2 },
  faction: '永生之乡',
  acValue: 3,
  power: 3000,
  basePower: 3000,
  damage: 3,
  baseDamage: 3,
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
