import { Card, CardEffect } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';
import { EventEngine } from '../services/EventEngine';
import { createSelectCardQuery, ensureData, getTopDeckCards, isAlchemyCard, markExileAtEndOfTurn } from './BaseUtil';

const effect_205000064_activate: CardEffect = {
  id: '205000064_activate',
  type: 'ACTIVATE',
  triggerLocation: ['HAND', 'PLAY'],
  description: '展示你的卡组顶3张卡。从其中选择1个非神蚀单位放置到战场，其获得【速攻】。回合结束时，若其不是炼金单位，将其放逐。',
  execute: async (instance, gameState, playerState) => {
    const revealed = getTopDeckCards(playerState, 3);
    if (revealed.length > 0) {
      gameState.logs.push(`[${instance.fullName}] 公开了卡组顶的 ${revealed.length} 张卡: ${revealed.map(card => card.fullName).join(', ')}。`);
      EventEngine.dispatchEvent(gameState, {
        type: 'REVEAL_DECK',
        playerUid: playerState.uid,
        data: { cards: revealed, sourceCardId: instance.gamecardId, sourceCardName: instance.fullName }
      });
    }

    const candidates = revealed.filter(card =>
      card.type === 'UNIT' &&
      !card.godMark &&
      (!card.specialName || !playerState.unitZone.some(unit => unit?.specialName === card.specialName))
    );

    if (candidates.length === 0 || !playerState.unitZone.some(card => card === null)) return;

    createSelectCardQuery(
      gameState,
      playerState.uid,
      candidates,
      '选择单位',
      '从你的卡组顶3张卡中选择1个非神蚀单位。',
      1,
      1,
      { sourceCardId: instance.gamecardId, effectId: '205000064_activate' },
      () => 'DECK'
    );
  },
  onQueryResolve: async (instance, gameState, playerState, selections) => {
    const targetId = selections[0];
    await AtomicEffectExecutor.execute(gameState, playerState.uid, {
      type: 'MOVE_FROM_DECK',
      targetFilter: { gamecardId: targetId },
      destinationZone: 'UNIT'
    }, instance);

    const moved = AtomicEffectExecutor.findCardById(gameState, targetId);
    if (!moved) return;

    moved.temporaryRush = true;
    moved.temporaryBuffSources = {
      ...(moved.temporaryBuffSources || {}),
      rush: instance.fullName
    };
    const data = ensureData(moved);
    data.forbiddenAlchemySourceName = instance.fullName;
    data.forbiddenAlchemyBanishTurn = gameState.turnCount;
    data.forbiddenAlchemyWillExileAtEndOfTurn = !isAlchemyCard(moved);

    if (!isAlchemyCard(moved)) {
      markExileAtEndOfTurn(gameState, playerState.uid, moved, instance, `205000064_end_exile_${moved.gamecardId}`);
    }

    EventEngine.recalculateContinuousEffects(gameState);
  }
};

const card: Card = {
  id: '205000064',
  fullName: '禁忌炼金',
  specialName: '',
  type: 'STORY',
  color: 'YELLOW',
  gamecardId: null as any,
  colorReq: { YELLOW: 1 },
  faction: '无',
  acValue: 2,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  feijingMark: false,
  canResetCount: 0,
  effects: [effect_205000064_activate],
  rarity: 'R',
  availableRarities: ['R'],
  cardPackage: 'BT02',
  uniqueId: null as any,
};

export default card;
