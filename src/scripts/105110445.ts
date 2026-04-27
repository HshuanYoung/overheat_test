import { Card, CardEffect, TriggerLocation } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';
import { canPutItemOntoBattlefield, canPutUnitOntoBattlefield, countItemTypes, createChoiceQuery, createSelectCardQuery, moveCard } from './BaseUtil';

const getTruthGodmarkCards = (playerState: any) => {
  const zones: { zone: (Card | null)[]; source: TriggerLocation }[] = [
    { zone: playerState.hand, source: 'HAND' },
    { zone: playerState.deck, source: 'DECK' },
    { zone: playerState.grave, source: 'GRAVE' }
  ];
  return zones.flatMap(({ zone, source }) =>
    zone
      .filter((card): card is Card => !!card && card.godMark && (card.specialName === '真理' || card.fullName.includes('真理')))
      .map(card => ({ card, source }))
  );
};

const effect_105110445_limit: CardEffect = {
  id: '105110445_limit',
  type: 'CONTINUOUS',
  description: 'You can only have 1 god-mark unit on the battlefield.',
  limitGodmarkCount: 1
};

const effect_105110445_end: CardEffect = {
  id: '105110445_end',
  type: 'TRIGGER',
  triggerEvent: 'TURN_END' as any,
  triggerLocation: ['UNIT'],
  description: 'At the end of your turn, you may draw up to X cards. X is the number of different item types you control.',
  condition: (_gameState, playerState, instance) =>
    instance.cardlocation === 'UNIT' &&
    playerState.isTurn &&
    countItemTypes(playerState) > 0,
  execute: async (instance, gameState, playerState) => {
    const maxDraw = countItemTypes(playerState);
    createChoiceQuery(
      gameState,
      playerState.uid,
      'Choose Draw Count',
      `Choose a number from 0 to ${maxDraw}.`,
      Array.from({ length: maxDraw + 1 }, (_, idx) => ({ id: String(idx), label: String(idx) })),
      { sourceCardId: instance.gamecardId, effectId: '105110445_end' }
    );
  },
  onQueryResolve: async (instance, gameState, playerState, selections) => {
    const drawCount = Number(selections[0] || '0');
    if (drawCount <= 0) return;
    await AtomicEffectExecutor.execute(gameState, playerState.uid, { type: 'DRAW', value: drawCount }, instance);
  }
};

const effect_105110445_activate: CardEffect = {
  id: '105110445_activate',
  type: 'ACTIVATE',
  triggerLocation: ['UNIT'],
  limitCount: 1,
  limitNameType: true,
  description: 'Main phase only. Banish 2 Truth god-mark cards from your hand, deck, and/or grave. Put 1 non-god card with AC up to X from your deck onto the battlefield. X is the number of different item types you control.',
  condition: (gameState, playerState) =>
    gameState.phase === 'MAIN' &&
    countItemTypes(playerState) > 0 &&
    getTruthGodmarkCards(playerState).length >= 2,
  execute: async (instance, gameState, playerState) => {
    const truthCards = getTruthGodmarkCards(playerState);
    createSelectCardQuery(
      gameState,
      playerState.uid,
      truthCards.map(entry => entry.card),
      'Choose 2 Truth Cards',
      'Choose 2 Truth god-mark cards from your hand, deck, and/or grave to banish.',
      2,
      2,
      { sourceCardId: instance.gamecardId, effectId: '105110445_activate', step: 'BANISH_COST' },
      card => (truthCards.find(entry => entry.card.gamecardId === card.gamecardId)?.source || card.cardlocation) as TriggerLocation
    );
  },
  onQueryResolve: async (instance, gameState, playerState, selections, context) => {
    if (context.step === 'BANISH_COST') {
      const targets = selections
        .map(id => AtomicEffectExecutor.findCardById(gameState, id))
        .filter((card): card is Card => !!card);

      targets.forEach(card => moveCard(gameState, playerState.uid, card, 'EXILE', instance));

      const maxAc = countItemTypes(playerState);
      const candidates = playerState.deck.filter(card => {
        if (card.godMark || (card.baseAcValue ?? card.acValue) > maxAc) return false;
        if (card.type === 'UNIT') return canPutUnitOntoBattlefield(playerState, card);
        if (card.type === 'ITEM') return canPutItemOntoBattlefield(playerState, card);
        return false;
      });
      if (candidates.length === 0) return;

      createSelectCardQuery(
        gameState,
        playerState.uid,
        candidates,
        'Choose A Card',
        `Choose 1 non-god card with AC ${maxAc} or less from your deck.`,
        1,
        1,
        { sourceCardId: instance.gamecardId, effectId: '105110445_activate', step: 'PUT_CARD' },
        () => 'DECK'
      );
      return;
    }

    if (context.step !== 'PUT_CARD') return;

    const card = AtomicEffectExecutor.findCardById(gameState, selections[0]);
    if (!card) return;
    await AtomicEffectExecutor.execute(gameState, playerState.uid, {
      type: 'MOVE_FROM_DECK',
      targetFilter: { gamecardId: selections[0] },
      destinationZone: card.type === 'UNIT' ? 'UNIT' : 'ITEM'
    }, instance);
  }
};

const card: Card = {
  id: '105110445',
  fullName: '彼岸共鸣「真理」',
  specialName: '真理',
  type: 'UNIT',
  color: 'YELLOW',
  gamecardId: null as any,
  colorReq: { YELLOW: 2 },
  faction: '学院要塞',
  acValue: 5,
  power: 4000,
  basePower: 4000,
  damage: 4,
  baseDamage: 4,
  godMark: true,
  displayState: 'FRONT_UPRIGHT',
  isExhausted: false,
  isrush: false,
  baseIsrush: false,
  canAttack: true,
  feijingMark: false,
  canResetCount: 0,
  effects: [effect_105110445_limit, effect_105110445_end, effect_105110445_activate],
  rarity: 'SER',
  availableRarities: ['SER'],
  cardPackage: 'BT04',
  uniqueId: null as any,
};

export default card;
