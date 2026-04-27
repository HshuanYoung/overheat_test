import { Card, CardEffect } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';
import { canPutUnitOntoBattlefield, createSelectCardQuery, moveCard } from './BaseUtil';

const effect_205000143_activate: CardEffect = {
  id: '205000143_activate',
  type: 'ACTIVATE',
  triggerLocation: ['PLAY'],
  description: 'Main phase only. Send 1 of your units to grave, then put a non-god unit from your deck onto the battlefield with AC 1 greater.',
  condition: (gameState, playerState) =>
    gameState.phase === 'MAIN' &&
    playerState.unitZone.some(unit => !!unit) &&
    playerState.deck.some(card => card.type === 'UNIT' && !card.godMark),
  execute: async (instance, gameState, playerState) => {
    const targets = playerState.unitZone.filter((unit): unit is Card => !!unit);
    createSelectCardQuery(
      gameState,
      playerState.uid,
      targets,
      'Choose A Unit',
      'Choose 1 of your units to send to the grave.',
      1,
      1,
      { sourceCardId: instance.gamecardId, effectId: '205000143_activate', step: 'SEND_UNIT' }
    );
  },
  onQueryResolve: async (instance, gameState, playerState, selections, context) => {
    if (context.step === 'SEND_UNIT') {
      const target = AtomicEffectExecutor.findCardById(gameState, selections[0]);
      if (!target) return;

      const targetAc = (target.baseAcValue ?? target.acValue) + 1;
      moveCard(gameState, playerState.uid, target, 'GRAVE', instance);

      const candidates = playerState.deck.filter(card =>
        card.type === 'UNIT' &&
        !card.godMark &&
        (card.baseAcValue ?? card.acValue) === targetAc &&
        canPutUnitOntoBattlefield(playerState, card)
      );
      if (candidates.length === 0) return;

      createSelectCardQuery(
        gameState,
        playerState.uid,
        candidates,
        'Choose A Unit',
        'Choose 1 non-god unit from your deck.',
        1,
        1,
        { sourceCardId: instance.gamecardId, effectId: '205000143_activate', step: 'PUT_UNIT' },
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
  }
};

const card: Card = {
  id: '205000143',
  fullName: '简易炼金炉',
  specialName: '',
  type: 'STORY',
  color: 'YELLOW',
  gamecardId: null as any,
  colorReq: { YELLOW: 1 },
  faction: '无',
  acValue: 3,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  feijingMark: false,
  canResetCount: 0,
  effects: [effect_205000143_activate],
  rarity: 'R',
  availableRarities: ['R'],
  cardPackage: 'BT03',
  uniqueId: null as any,
};

export default card;
