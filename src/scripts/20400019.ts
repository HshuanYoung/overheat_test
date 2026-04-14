import { Card, GameState, PlayerState } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';

const card: Card = {
  id: '20400019',
  fullName: '拳法训练',
  specialName: '',
  type: 'STORY',
  color: 'BLUE',
  gamecardId: null as any,
  colorReq: { BLUE: 1 },
  faction: '无',
  acValue: 1,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  feijingMark: false,
  canResetCount: 0,
  effects: [
    {
      id: 'boxing_training_activate',
      type: 'ACTIVATE',
      description: '选择战场上一张除蓝色以外的非神蚀单位卡，将其横置。',
      condition: (gameState, playerState) => {
        // Must have at least one valid target on the battlefield
        let found = false;
        Object.values(gameState.players).forEach(p => {
          p.unitZone.forEach(u => {
            if (u && !u.godMark && u.color !== 'BLUE') found = true;
          });
        });
        return found;
      },
      execute: async (card, gameState, playerState) => {
        const targets: Card[] = [];
        Object.values(gameState.players).forEach(p => {
          p.unitZone.forEach(u => {
            if (u && !u.godMark && u.color !== 'BLUE') {
              targets.push(u);
            }
          });
        });

        if (targets.length === 0) return;

        gameState.pendingQuery = {
          id: Math.random().toString(36).substring(7),
          type: 'SELECT_CARD',
          playerUid: playerState.uid,
          options: AtomicEffectExecutor.enrichQueryOptions(gameState, playerState.uid, targets.map(t => ({ card: t, source: 'UNIT' as any }))),
          title: '选择目标单位横置',
          description: '请选择一张除蓝色以外的非神蚀单位。',
          minSelections: 1,
          maxSelections: 1,
          callbackKey: 'EFFECT_RESOLVE',
          context: {
            sourceCardId: card.gamecardId,
            effectIndex: 0,
            step: 1
          }
        };
      },
      onQueryResolve: async (card, gameState, playerState, selections) => {
        const targetId = selections[0];
        
        await AtomicEffectExecutor.execute(gameState, playerState.uid, {
          type: 'ROTATE_HORIZONTAL',
          targetFilter: { gamecardId: targetId }
        }, card);

        gameState.logs.push(`[拳法训练] 将单位横置。`);
      }
    }
  ],
  rarity: 'C',
  availableRarities: ['C'],
  uniqueId: null as any,
};

export default card;
