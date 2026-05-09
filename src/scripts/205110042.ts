import { Card, CardEffect } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';

const effect_205110042_activate: CardEffect = {
  id: '205110042_activate',
  type: 'ACTIVATE',
  limitCount: 1,
  limitNameType: true,
  triggerLocation: ['HAND', 'PLAY'],
  description: '只能在主要阶段发动。各玩家舍弃全部手牌，之后抽等量的卡。',
  condition: (gameState, playerState, instance) =>
    instance.cardlocation === 'PLAY' ||
    (gameState.phase === 'MAIN' && playerState.isTurn),
  execute: async (instance, gameState) => {
    for (const player of Object.values(gameState.players)) {
      const discardIds = player.hand.map(card => card.gamecardId);
      const drawCount = discardIds.length;

      for (const cardId of discardIds) {
        await AtomicEffectExecutor.execute(gameState, player.uid, {
          type: 'DISCARD_CARD',
          targetFilter: { gamecardId: cardId }
        }, instance);
      }

      if (drawCount > 0) {
        await AtomicEffectExecutor.execute(gameState, player.uid, {
          type: 'DRAW',
          value: drawCount
        }, instance);
      }

      gameState.logs.push(`[${instance.id}] made ${player.displayName} discard ${drawCount} cards and redraw the same amount.`);
    }
  }
};

const card: Card = {
  id: '205110042',
  fullName: '重新准备',
  specialName: '',
  type: 'STORY',
  color: 'YELLOW',
  gamecardId: null as any,
  colorReq: { YELLOW: 1 },
  faction: '学院要塞',
  acValue: 0,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  feijingMark: false,
  canResetCount: 0,
  effects: [effect_205110042_activate],
  rarity: 'R',
  availableRarities: ['R'],
  cardPackage: 'BT01',
  uniqueId: null as any,
};

export default card;
