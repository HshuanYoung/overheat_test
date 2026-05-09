import { Card, CardEffect } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';
import { createSelectCardQuery, isVirtualGodMarkReveal, shuffleAndRevealTopCards } from './BaseUtil';
import { getOpponentBattlefieldNonGodCards } from './BaseUtil';

const effect_205000134_activate: CardEffect = {
  id: '205000134_activate',
  type: 'ACTIVATE',
  triggerLocation: ['PLAY'],
  description: '洗切你的卡组并展示卡组顶1张卡。若其为单位，横置对手战场上1张非神蚀卡。若其为神蚀卡，将对手战场上1张非神蚀卡返回手牌。',
  execute: async (instance, gameState, playerState) => {
    const revealedCard = (await shuffleAndRevealTopCards(gameState, playerState.uid, 1, instance))[0];
    if (!revealedCard) return;

    const canRotate = revealedCard.type === 'UNIT';
    const canBounce = isVirtualGodMarkReveal(gameState, revealedCard);
    if (!canRotate && !canBounce) return;

    const targets = getOpponentBattlefieldNonGodCards(gameState, playerState.uid);
    if (targets.length === 0) return;

    if (canRotate) {
      createSelectCardQuery(
        gameState,
        playerState.uid,
        targets,
        '选择卡牌',
        '选择对手1张非神蚀卡横置。',
        1,
        1,
        {
          sourceCardId: instance.gamecardId,
          effectId: '205000134_activate',
          step: 'ROTATE',
          doBounce: canBounce
        }
      );
      return;
    }

    createSelectCardQuery(
      gameState,
      playerState.uid,
      targets,
      '选择卡牌',
      '选择对手1张非神蚀卡返回手牌。',
      1,
      1,
      { sourceCardId: instance.gamecardId, effectId: '205000134_activate', step: 'BOUNCE' }
    );
  },
  onQueryResolve: async (instance, gameState, playerState, selections, context) => {
    if (context.step === 'ROTATE') {
      await AtomicEffectExecutor.execute(gameState, playerState.uid, {
        type: 'ROTATE_HORIZONTAL',
        targetFilter: { gamecardId: selections[0], onField: true }
      }, instance);

      if (!context.doBounce) return;
      const targets = getOpponentBattlefieldNonGodCards(gameState, playerState.uid);
      if (targets.length === 0) return;
      createSelectCardQuery(
        gameState,
        playerState.uid,
        targets,
        '选择卡牌',
        '选择对手1张非神蚀卡返回手牌。',
        1,
        1,
        { sourceCardId: instance.gamecardId, effectId: '205000134_activate', step: 'BOUNCE' }
      );
      return;
    }

    if (context.step !== 'BOUNCE') return;
    await AtomicEffectExecutor.execute(gameState, playerState.uid, {
      type: 'MOVE_FROM_FIELD',
      targetFilter: { gamecardId: selections[0], onField: true },
      destinationZone: 'HAND'
    }, instance);
  }
};

const card: Card = {
  id: '205000134',
  fullName: '魔偶姬的人偶术',
  specialName: '',
  type: 'STORY',
  color: 'YELLOW',
  gamecardId: null as any,
  colorReq: { YELLOW: 1 },
  faction: '无',
  acValue: 0,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  feijingMark: false,
  canResetCount: 0,
  effects: [effect_205000134_activate],
  rarity: 'C',
  availableRarities: ['C'],
  cardPackage: 'BT04',
  uniqueId: null as any,
};

export default card;
