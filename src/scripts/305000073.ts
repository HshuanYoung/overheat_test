import { Card, CardEffect } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';
import { canPutUnitOntoBattlefield, createSelectCardQuery } from './_bt03YellowUtils';

const effect_305000073_continuous: CardEffect = {
  id: '305000073_continuous',
  type: 'CONTINUOUS',
  description: 'Units put onto the battlefield by this item effect are unaffected by opponent card effects, become 4000 power / 4 damage, and gain Heroic and Annihilation.',
  applyContinuous: (gameState, instance) => {
    const ownerUid = AtomicEffectExecutor.findCardOwnerKey(gameState, instance.gamecardId);
    if (!ownerUid) return;

    const player = gameState.players[ownerUid];
    player.unitZone.forEach(unit => {
      if (!unit) return;
      if ((unit as any).data?.bt04MysteryWorkshopSourceCardId !== instance.gamecardId) return;

      unit.power = 4000;
      unit.damage = 4;
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
        description: 'Mystery Workshop buff: 4000 power / 4 damage / Heroic / Annihilation / unaffected by opponent card effects.'
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
  description: 'Once per game: exhaust this item, send 3 of your units that were put from deck onto the battlefield to the grave, then put an alchemy unit from your deck onto the battlefield.',
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
      'Choose 3 Units',
      'Choose 3 of your units that were put from your deck onto the battlefield.',
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
        'Choose An Alchemy Unit',
        'Choose 1 unit whose name contains 《炼金》 from your deck.',
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
      bt04MysteryWorkshopSourceCardId: instance.gamecardId
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
