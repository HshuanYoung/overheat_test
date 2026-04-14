import { Card, GameState, PlayerState } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';

const card: Card = {
  id: '20403006',
  fullName: '接受委托',
  specialName: '',
  type: 'STORY',
  color: 'BLUE',
  gamecardId: null as any,
  colorReq: { 'BLUE': 1 },
  faction: '冒险家工会',
  acValue: 2,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  feijingMark: false,
  canResetCount: 0,
  effects: [
    {
      id: 'accept_commission_activate',
      type: 'ACTIVATE',
      triggerLocation: ['PLAY'],
      description: '从你的侵蚀区正面选择一张AC为2或以下的且不具有「神蚀」的单位卡，将其正面向上的纵置摆放到战场。',
      condition: (gameState, playerState) => {
        return playerState.erosionFront.some(c =>
          c !== null &&
          c.type === 'UNIT' &&
          !c.godMark &&
          (c.acValue ?? 0) <= 2
        );
      },
      execute: async (card, gameState, playerState) => {
        const eligibleUnits = playerState.erosionFront.filter(c =>
          c !== null &&
          c.type === 'UNIT' &&
          !c.godMark &&
          (c.acValue ?? 0) <= 2
        ) as Card[];

        if (eligibleUnits.length === 0) return;

        gameState.pendingQuery = {
          id: Math.random().toString(36).substring(7),
          type: 'SELECT_CARD',
          playerUid: playerState.uid,
          options: eligibleUnits.map(u => ({ card: u, source: 'EROSION_FRONT' as any })),
          title: '选择入场单位',
          description: '从你的侵蚀区正面选择一个AC<=2且非神蚀单位进入战场。',
          minSelections: 1,
          maxSelections: 1,
          callbackKey: 'EFFECT_RESOLVE',
          context: { sourceCardId: card.gamecardId, effectIndex: 0 }
        };
      },
      onQueryResolve: async (card, gameState, playerState, selections) => {
        const targetId = selections[0];
        
        await AtomicEffectExecutor.execute(gameState, playerState.uid, {
          type: 'MOVE_FROM_EROSION',
          destinationZone: 'UNIT',
          targetFilter: { gamecardId: targetId }
        }, card);

        // Ensure vertical state
        const targetCard = AtomicEffectExecutor.findCardById(gameState, targetId);
        if (targetCard) {
          targetCard.isExhausted = false;
          targetCard.displayState = 'FRONT_UPRIGHT';
          gameState.logs.push(`${playerState.displayName} 接受委托，将 ${targetCard.fullName} 召集至战场。`);
        }
      }
    }
  ],
  rarity: 'R',
  availableRarities: ['R'],
  uniqueId: null,
};

export default card;
