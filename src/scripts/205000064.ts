import { Card, CardEffect } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';
import { EventEngine } from '../services/EventEngine';
import { createSelectCardQuery, getTopDeckCards, isAlchemyCard } from './_bt02YellowUtils';

const effect_205000064_activate: CardEffect = {
  id: '205000064_activate',
  type: 'ACTIVATE',
  triggerLocation: ['HAND', 'PLAY'],
  description: 'Reveal the top 3 cards of your deck. Choose a non-god unit from among them, put it onto the battlefield, and it gains Rush. At end of turn, if it is not an alchemy unit, banish it.',
  execute: async (instance, gameState, playerState) => {
    const revealed = getTopDeckCards(playerState, 3);
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
      'Choose A Unit',
      'Choose 1 non-god unit from the top 3 cards of your deck.',
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
    (moved as any).data = {
      ...((moved as any).data || {}),
      forbiddenAlchemySourceName: instance.fullName,
      forbiddenAlchemyBanishTurn: gameState.turnCount,
      forbiddenAlchemyWillExileAtEndOfTurn: !isAlchemyCard(moved)
    };

    (instance as any).data = {
      ...((instance as any).data || {}),
      delayedBanishTargetId: moved.gamecardId,
      delayedBanishTurn: gameState.turnCount
    };

    EventEngine.recalculateContinuousEffects(gameState);
  },
  resolve: async (instance, gameState, playerState) => {
    if ((instance as any).data?.delayedBanishTurn !== gameState.turnCount) return;

    const targetId = (instance as any).data?.delayedBanishTargetId;
    if (!targetId) return;

    const target = AtomicEffectExecutor.findCardById(gameState, targetId);
    if (target) {
      (target as any).data = {
        ...((target as any).data || {}),
        forbiddenAlchemyWillExileAtEndOfTurn: false
      };
    }
    if (!target || target.cardlocation !== 'UNIT' || isAlchemyCard(target)) return;

    const ownerUid = AtomicEffectExecutor.findCardOwnerKey(gameState, target.gamecardId);
    if (!ownerUid) return;

    AtomicEffectExecutor.moveCard(gameState, ownerUid, 'UNIT', ownerUid, 'EXILE', target.gamecardId, true, {
      effectSourcePlayerUid: playerState.uid,
      effectSourceCardId: instance.gamecardId
    });
    gameState.logs.push(`[${instance.fullName}] 在回合结束时放逐了 [${target.fullName}]。`);
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
