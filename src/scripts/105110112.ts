import { Card, CardEffect, GameState, PlayerState, TriggerLocation } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';
import { addInfluence, canActivateDefaultTiming, createChoiceQuery, createSelectCardQuery, getBattlefieldUnits } from './BaseUtil';

const EFFECT_ID = '105110112_activate';

const hasLostActivate = (instance: Card) => !!(instance as any).data?.lostActivateEffect_105110112;

const markActivateLost = (instance: Card) => {
  (instance as any).data = {
    ...((instance as any).data || {}),
    lostActivateEffect_105110112: true
  };
  addInfluence(instance, instance, '已使用效果，失去此能力');
};

const createPlayerSelectQuery = (
  gameState: GameState,
  playerState: PlayerState,
  instance: Card,
  step: string,
  title: string,
  description: string
) => {
  gameState.pendingQuery = {
    id: Math.random().toString(36).substring(7),
    type: 'SELECT_CARD',
    playerUid: playerState.uid,
    options: AtomicEffectExecutor.enrichQueryOptions(gameState, playerState.uid, [
      {
        card: {
          gamecardId: 'PLAYER_SELF',
          id: 'PLAYER_SELF',
          fullName: '我方玩家',
          type: 'UNIT',
          color: 'NONE'
        } as any,
        source: 'UNIT' as TriggerLocation
      },
      {
        card: {
          gamecardId: 'PLAYER_OPPONENT',
          id: 'PLAYER_OPPONENT',
          fullName: '对手玩家',
          type: 'UNIT',
          color: 'NONE'
        } as any,
        source: 'UNIT' as TriggerLocation
      }
    ]),
    title,
    description,
    minSelections: 1,
    maxSelections: 1,
    callbackKey: 'EFFECT_RESOLVE',
    context: {
      sourceCardId: instance.gamecardId,
      effectId: EFFECT_ID,
      step
    }
  };
};

const effect_105110112_activate: CardEffect = {
  id: EFFECT_ID,
  type: 'ACTIVATE',
  triggerLocation: ['UNIT'],
  description: '从下列效果选择一个，执行后这个单位失去这个【启】能力：\n◆抽1张卡。\n◆选择1名玩家，给予他1点伤害。\n◆选择你的1张手牌舍弃，选择1个〖力量1500〗以下的单位，将其破坏。',
  condition: (gameState, playerState, instance) =>
    canActivateDefaultTiming(gameState, playerState) &&
    instance.cardlocation === 'UNIT' &&
    !hasLostActivate(instance),
  execute: async (instance, gameState, playerState) => {
    const weakUnits = getBattlefieldUnits(gameState).filter(unit => (unit.power || 0) <= 1500);
    const optionList = [
      { id: 'DRAW', label: '抽1张卡' },
      { id: 'DAMAGE', label: '选择1名玩家，给予他1点伤害' }
    ];

    if (playerState.hand.length > 0 && weakUnits.length > 0) {
      optionList.push({
        id: 'DESTROY',
        label: '舍弃1张手牌，破坏1个力量1500以下的单位'
      });
    }

    createChoiceQuery(
      gameState,
      playerState.uid,
      '选择效果',
      '选择1项效果并执行。之后，这个单位失去这个【启】能力。',
      optionList,
      {
        sourceCardId: instance.gamecardId,
        effectId: EFFECT_ID,
        step: 'CHOOSE_MODE'
      }
    );
  },
  onQueryResolve: async (instance, gameState, playerState, selections, context) => {
    if (context?.effectId !== EFFECT_ID || selections.length === 0) return;

    if (context.step === 'CHOOSE_MODE') {
      const choice = selections[0];

      if (choice === 'DRAW') {
        markActivateLost(instance);
        await AtomicEffectExecutor.execute(gameState, playerState.uid, { type: 'DRAW', value: 1 }, instance);
        gameState.logs.push(`[${instance.fullName}] 抽了1张卡。`);
        return;
      }

      if (choice === 'DAMAGE') {
        markActivateLost(instance);
        createPlayerSelectQuery(
          gameState,
          playerState,
          instance,
          'DEAL_DAMAGE',
          'Choose A Player',
          '选择1名玩家，给予他1点伤害。'
        );
        return;
      }

      if (choice === 'DESTROY') {
        const weakUnits = getBattlefieldUnits(gameState).filter(unit => (unit.power || 0) <= 1500);
        if (playerState.hand.length === 0 || weakUnits.length === 0) return;

        markActivateLost(instance);
        createSelectCardQuery(
          gameState,
          playerState.uid,
          [...playerState.hand],
          '选择要舍弃的卡',
          '选择1张手牌舍弃。',
          1,
          1,
          {
            sourceCardId: instance.gamecardId,
            effectId: EFFECT_ID,
            step: 'DISCARD_HAND'
          },
          () => 'HAND'
        );
      }
      return;
    }

    if (context.step === 'DEAL_DAMAGE') {
      const targetUid =
        selections[0] === 'PLAYER_SELF'
          ? playerState.uid
          : gameState.playerIds.find(uid => uid !== playerState.uid)!;

      if (targetUid === playerState.uid) {
        await AtomicEffectExecutor.execute(gameState, playerState.uid, { type: 'DEAL_EFFECT_DAMAGE_SELF', value: 1 }, instance);
      } else {
        await AtomicEffectExecutor.execute(gameState, playerState.uid, { type: 'DEAL_EFFECT_DAMAGE', value: 1 }, instance);
      }

      gameState.logs.push(`[${instance.fullName}] 给予了 ${targetUid === playerState.uid ? '自己' : '对手'} 1点效果伤害。`);
      return;
    }

    if (context.step === 'DISCARD_HAND') {
      const discardId = selections[0];
      const discardCard = AtomicEffectExecutor.findCardById(gameState, discardId);
      if (!discardCard || discardCard.cardlocation !== 'HAND') return;

      await AtomicEffectExecutor.execute(
        gameState,
        playerState.uid,
        {
          type: 'DISCARD_CARD',
          targetFilter: { gamecardId: discardId }
        },
        instance
      );

      const weakUnits = getBattlefieldUnits(gameState).filter(unit => (unit.power || 0) <= 1500);
      if (weakUnits.length === 0) {
        gameState.logs.push(`[${instance.fullName}] discarded a card, but there was no valid unit to destroy.`);
        return;
      }

      createSelectCardQuery(
        gameState,
        playerState.uid,
        weakUnits,
        '选择单位',
        '选择1个力量1500以下的单位，将其破坏。',
        1,
        1,
        {
          sourceCardId: instance.gamecardId,
          effectId: EFFECT_ID,
          step: 'DESTROY_UNIT'
        },
        () => 'UNIT'
      );
      return;
    }

    if (context.step !== 'DESTROY_UNIT') return;

    const target = AtomicEffectExecutor.findCardById(gameState, selections[0]);
    if (!target || target.cardlocation !== 'UNIT' || (target.power || 0) > 1500) return;

    const ownerUid = AtomicEffectExecutor.findCardOwnerKey(gameState, target.gamecardId);
    if (!ownerUid) return;

    await AtomicEffectExecutor.execute(
      gameState,
      ownerUid,
      {
        type: 'DESTROY_CARD',
        targetFilter: { gamecardId: target.gamecardId }
      },
      instance
    );

    gameState.logs.push(`[${instance.fullName}] 破坏了 [${target.fullName}] `);
  }
};

const effect_105110112_lost_display: CardEffect = {
  id: '105110112_lost_display',
  type: 'CONTINUOUS',
  description: '使用过【启】效果后，在影响来源中显示已失去此能力。',
  applyContinuous: (_gameState, instance) => {
    if (!hasLostActivate(instance)) return;
    addInfluence(instance, instance, '已使用效果，失去此能力');
  }
};

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 105110112
 * Card2 Row: 78
 * Card Row: 78
 * Source CardNo: BT01-Y06
 * Package: BT01(R),ST04(TD)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 【启】:你选择下列的1项效果并执行。之后，失去这个【启】能力。
 * ◆抽1张卡。
 * ◆选择1名玩家，给予他1点伤害。
 * ◆选择你的1张手牌舍弃，选择1个〖力量1500〗以下的单位，将其破坏。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '105110112',
  fullName: '元素魔法教官',
  specialName: '',
  type: 'UNIT',
  color: 'YELLOW',
  gamecardId: null as any,
  colorReq: { YELLOW: 1 },
  faction: '学院要塞',
  acValue: 3,
  power: 2500,
  basePower: 2500,
  damage: 1,
  baseDamage: 1,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  isExhausted: false,
  isrush: false,
  canAttack: true,
  feijingMark: false,
  canResetCount: 0,
  effects: [effect_105110112_activate, effect_105110112_lost_display],
  rarity: 'R',
  availableRarities: ['R'],
  cardPackage: 'BT01',
  uniqueId: null as any,
};

export default card;
