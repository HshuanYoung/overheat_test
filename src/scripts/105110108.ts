import { Card, CardEffect, PlayerState } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';
import { createChoiceQuery, createSelectCardQuery } from './BaseUtil';
import { ensureDeckHasCardsForMove, getTopDeckCards, moveCard, moveCardsToBottom } from './BaseUtil';

const getDeclaredNameOptions = (playerState: PlayerState) => {
  const uniqueNames = Array.from(
    new Set(playerState.deck.map((card: Card) => card.fullName).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));

  return uniqueNames.map(name => ({ id: name, label: name }));
};

const effect_105110108_activate: CardEffect = {
  id: '105110108_activate',
  type: 'ACTIVATE',
  triggerLocation: ['UNIT'],
  limitCount: 1,
  limitNameType: true,
  description: '主要阶段：宣言1个卡名，将你的卡组顶的1张卡送入墓地。若那张卡的卡名和宣言一致，你可以选择你的墓地中的2张卡，放置到卡组底。',
  condition: (_gameState, playerState, instance) =>
    playerState.isTurn &&
    _gameState.phase === 'MAIN' &&
    instance.cardlocation === 'UNIT' &&
    playerState.deck.length > 0,
  execute: async (instance, gameState, playerState) => {
    const options = getDeclaredNameOptions(playerState);
    if (options.length === 0) return;

    createChoiceQuery(
      gameState,
      playerState.uid,
      '宣言卡名',
      '宣言一个卡名',
      options,
      {
        sourceCardId: instance.gamecardId,
        effectId: '105110108_activate',
        step: 'DECLARE_NAME'
      }
    );
  },
  onQueryResolve: async (instance, gameState, playerState, selections, context) => {
    if (context?.step === 'DECLARE_NAME') {
      const declaredName = selections[0];
      if (!ensureDeckHasCardsForMove(gameState, playerState.uid, 1, instance)) return;
      const topCard = getTopDeckCards(playerState, 1)[0];
      if (!topCard) return;

      moveCard(gameState, playerState.uid, topCard, 'GRAVE', instance);
      gameState.logs.push(`[${instance.fullName}] declared [${declaredName}] and milled [${topCard.fullName}].`);

      if (topCard.fullName !== declaredName) return;
      if (playerState.grave.length < 2) return;

      createChoiceQuery(
        gameState,
        playerState.uid,
        '结算命中',
        '宣言的名称匹配。是否将2张卡从墓地放到卡组底？',
        [
          { id: 'YES', label: '是' },
          { id: 'NO', label: '否' }
        ],
        {
          sourceCardId: instance.gamecardId,
          effectId: '105110108_activate',
          step: 'ASK_BOTTOM'
        }
      );
      return;
    }

    if (context?.step === 'ASK_BOTTOM') {
      if (selections[0] !== 'YES') return;
      if (playerState.grave.length < 2) return;

      createSelectCardQuery(
        gameState,
        playerState.uid,
        [...playerState.grave],
        '选择2张卡',
        '选择2张卡放回卡组底',
        2,
        2,
        {
          sourceCardId: instance.gamecardId,
          effectId: '105110108_activate',
          step: 'SELECT_GRAVE'
        },
        () => 'GRAVE'
      );
      return;
    }

    if (context?.step !== 'SELECT_GRAVE' || selections.length !== 2) return;

    const targets = selections
      .map(id => AtomicEffectExecutor.findCardById(gameState, id))
      .filter((card): card is Card => !!card && card.cardlocation === 'GRAVE');

    if (targets.length !== 2) return;
    moveCardsToBottom(gameState, playerState.uid, targets, instance);
    gameState.logs.push(`[${instance.fullName}] put 2 cards from the graveyard on the bottom of the deck.`);
  }
};

const effect_105110108_continuous: CardEffect = {
  id: '105110108_continuous',
  type: 'CONTINUOUS',
  erosionTotalLimit: [3, 5],
  description: '侵蚀区数量3-5：这个单位+1/+500。',
  applyContinuous: (gameState, instance) => {
    const ownerUid = AtomicEffectExecutor.findCardOwnerKey(gameState, instance.gamecardId);
    if (!ownerUid) return;

    const owner = gameState.players[ownerUid];
    const erosionTotal =
      owner.erosionFront.filter(card => !!card).length +
      owner.erosionBack.filter(card => !!card).length;

    if (erosionTotal < 3 || erosionTotal > 5) return;

    instance.damage = (instance.damage || 0) + 1;
    instance.power = (instance.power || 0) + 500;
    instance.influencingEffects = instance.influencingEffects || [];
    instance.influencingEffects.push({
      sourceCardName: instance.fullName,
      description: '侵蚀区数量3-5：这个单位+1/+500'
    });
  }
};

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 105110108
 * Card2 Row: 74
 * Card Row: 74
 * Source CardNo: BT01-Y02
 * Package: BT01(U)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 【启】〖同名1回合1次〗:这个能力只能在你的主要阶段中发动。宣言1个卡名，将你的卡组顶的1张卡送入墓地。若那张卡的卡名和宣言一致，你可以选择你的墓地中的2张卡，放置到卡组底。
 * 〖3~5〗【永】:这个单位+1/+500。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '105110108',
  fullName: '治疗术学徒',
  specialName: '',
  type: 'UNIT',
  color: 'YELLOW',
  gamecardId: null as any,
  colorReq: {},
  faction: '学院要塞',
  acValue: 1,
  power: 1000,
  basePower: 1000,
  damage: 0,
  baseDamage: 0,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  isExhausted: false,
  isrush: false,
  canAttack: true,
  feijingMark: false,
  canResetCount: 0,
  effects: [effect_105110108_activate, effect_105110108_continuous],
  rarity: 'U',
  availableRarities: ['U'],
  cardPackage: 'BT01',
  uniqueId: null as any,
};

export default card;
