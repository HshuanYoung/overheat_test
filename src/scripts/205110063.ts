import { Card, CardEffect } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';
import { createSelectCardQuery, isValkyrieUnit } from './BaseUtil';

const effect_205110063_item_discount: CardEffect = {
  id: '205110063_item_discount',
  type: 'CONTINUOUS',
  content: 'SELF_HAND_COST',
  description: 'Your item zone reduces this card AC by 1 for each item, to a minimum of 0.',
  applyContinuous: (gameState, instance) => {
    const ownerUid = AtomicEffectExecutor.findCardOwnerKey(gameState, instance.gamecardId);
    if (!ownerUid) return;

    const baseCost = instance.baseAcValue ?? instance.acValue ?? 0;
    const itemCount = gameState.players[ownerUid].itemZone.filter(Boolean).length;
    instance.acValue = Math.max(0, baseCost - itemCount);
  }
};

const effect_205110063_activate: CardEffect = {
  id: '205110063_activate',
  type: 'ACTIVATE',
  triggerLocation: ['PLAY'],
  description: 'Choose 1 Valkyrie unit from your deck and put it onto the battlefield.',
  condition: (_gameState, playerState) => playerState.unitZone.some(card => card === null) && playerState.deck.some(isValkyrieUnit),
  execute: async (instance, gameState, playerState) => {
    const candidates = playerState.deck.filter(card =>
      isValkyrieUnit(card) &&
      (!card.specialName || !playerState.unitZone.some(unit => unit?.specialName === card.specialName))
    );
    if (candidates.length === 0) return;

    createSelectCardQuery(
      gameState,
      playerState.uid,
      candidates,
      'Choose A Valkyrie',
      'Choose 1 Valkyrie unit from your deck.',
      1,
      1,
      { sourceCardId: instance.gamecardId, effectId: '205110063_activate' },
      () => 'DECK'
    );
  },
  onQueryResolve: async (instance, gameState, playerState, selections) => {
    await AtomicEffectExecutor.execute(gameState, playerState.uid, {
      type: 'MOVE_FROM_DECK',
      targetFilter: { gamecardId: selections[0] },
      destinationZone: 'UNIT'
    }, instance);
  }
};

const card: Card = {
  id: '205110063',
  fullName: '瓦尔基里计划',
  specialName: '',
  type: 'STORY',
  color: 'YELLOW',
  gamecardId: null as any,
  colorReq: { YELLOW: 2 },
  faction: '学院要塞',
  acValue: 5,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  feijingMark: false,
  canResetCount: 0,
  effects: [effect_205110063_activate, effect_205110063_item_discount],
  rarity: 'R',
  availableRarities: ['R'],
  cardPackage: 'BT02',
  uniqueId: null as any,
};

export default card;
