import { Card, CardEffect } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';
import { canPutUnitOntoBattlefield, createSelectCardQuery } from './BaseUtil';

const effect_305000073_continuous: CardEffect = {
  id: '305000073_continuous',
  type: 'CONTINUOUS',
  description: '因这个道具的效果放置到战场的单位伤害+4、力量+4000，并获得【英勇】【歼灭】与不受对手卡牌效果影响。',
  applyContinuous: (gameState, instance) => {
    const ownerUid = AtomicEffectExecutor.findCardOwnerKey(gameState, instance.gamecardId);
    if (!ownerUid) return;

    const player = gameState.players[ownerUid];
    player.unitZone.forEach(unit => {
      if (!unit) return;
      if ((unit as any).data?.mysteryWorkshopSourceCardId !== instance.gamecardId) return;

      unit.power = (unit.power || 0) + 4000;
      unit.damage = (unit.damage || 0) + 4;
      unit.isHeroic = true;
      unit.isAnnihilation = true;
      unit.temporaryImmuneToUnitEffects = true;
      (unit as any).data = {
        ...((unit as any).data || {}),
        unaffectedByOpponentCardEffects: true
      };
      if (!unit.influencingEffects) unit.influencingEffects = [];
      unit.influencingEffects.push({
        sourceCardName: instance.fullName,
        description: '神秘工坊加成：+4伤害 / +4000力量 / 英勇 / 歼灭 / 不受对手卡牌效果影响。'
      });
    });
  }
};

const effect_305000073_activate: CardEffect = {
  id: '305000073_activate',
  type: 'ACTIVATE',
  triggerLocation: ['ITEM'],
  limitCount: 1,
  limitGlobal: true,
  description: '每局游戏一次：横置这个道具，将你的3个从卡组放置到战场的单位送入墓地，之后从卡组将1个炼金单位放置到战场。',
  condition: (_gameState, playerState, instance) =>
    !instance.isExhausted &&
    playerState.unitZone.filter(unit => unit && (unit as any).data?.lastMovedFromZone === 'DECK').length >= 3 &&
    playerState.deck.some(card => card.type === 'UNIT' && card.fullName.includes('炼金') && canPutUnitOntoBattlefield(playerState, card)),
  execute: async (instance, gameState, playerState) => {
    await AtomicEffectExecutor.execute(gameState, playerState.uid, {
      type: 'ROTATE_HORIZONTAL',
      targetFilter: { gamecardId: instance.gamecardId }
    }, instance);

    const targets = playerState.unitZone.filter((unit): unit is Card =>
      !!unit && (unit as any).data?.lastMovedFromZone === 'DECK'
    );
    createSelectCardQuery(
      gameState,
      playerState.uid,
      targets,
      '选择3个单位',
      '选择你的3个从卡组放置到战场的单位。',
      3,
      3,
      { sourceCardId: instance.gamecardId, effectId: '305000073_activate', step: 'SEND_UNITS' }
    );
  },
  onQueryResolve: async (instance, gameState, playerState, selections, context) => {
    if (context.step === 'SEND_UNITS') {
      for (const targetId of selections) {
        await AtomicEffectExecutor.execute(gameState, playerState.uid, {
          type: 'MOVE_FROM_FIELD',
          targetFilter: { gamecardId: targetId, type: 'UNIT' },
          destinationZone: 'GRAVE'
        }, instance);
      }

      const candidates = playerState.deck.filter(card =>
        card.type === 'UNIT' &&
        card.fullName.includes('炼金') &&
        canPutUnitOntoBattlefield(playerState, card)
      );
      if (candidates.length === 0) return;

      createSelectCardQuery(
        gameState,
        playerState.uid,
        candidates,
        '选择炼金单位',
        '从你的卡组选择1个卡名含有《炼金》的单位。',
        1,
        1,
        { sourceCardId: instance.gamecardId, effectId: '305000073_activate', step: 'PUT_UNIT' },
        () => 'DECK'
      );
      return;
    }

    if (context.step !== 'PUT_UNIT') return;
    await AtomicEffectExecutor.execute(gameState, playerState.uid, {
      type: 'MOVE_FROM_DECK',
      targetFilter: { gamecardId: selections[0] },
      destinationZone: 'UNIT'
    }, instance);

    const moved = AtomicEffectExecutor.findCardById(gameState, selections[0]);
    if (!moved) return;
    (moved as any).data = {
      ...((moved as any).data || {}),
      mysteryWorkshopSourceCardId: instance.gamecardId
    };
  }
};

const card: Card = {
  id: '305000073',
  fullName: '「神秘工坊」',
  specialName: '神秘工坊',
  type: 'ITEM',
  color: 'YELLOW',
  gamecardId: null as any,
  colorReq: { YELLOW: 1 },
  faction: '无',
  acValue: 1,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  feijingMark: false,
  canResetCount: 0,
  effects: [effect_305000073_continuous, effect_305000073_activate],
  rarity: 'R',
  availableRarities: ['R'],
  cardPackage: 'BT04',
  uniqueId: null as any,
};

export default card;
