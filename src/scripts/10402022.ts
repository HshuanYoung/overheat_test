import { Card, GameState, PlayerState, CardEffect } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';

const card: Card = {
  id: '10402022',
  fullName: '牛头人保镖领队',
  specialName: '',
  type: 'UNIT',
  color: 'BLUE',
  gamecardId: null as any,
  colorReq: { BLUE: 2 },
  faction: '九尾商会联盟',
  acValue: 4,
  power: 3000,
  basePower: 3000,
  damage: 3,
  baseDamage: 3,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  isExhausted: false,
  isrush: false,
  canAttack: true,
  feijingMark: false,
  canResetCount: 0,
  effects: [
    {
      id: 'minotaur_leader_activate',
      type: 'ACTIVATE',
      limitCount: 1,
      limitNameType: true,
      triggerLocation: ['UNIT'],
      description: '【同名回合1次】舍弃1张手牌：选择单位区中1张名字包含「牛头人」的单位，在本回合中力量值+1000。',
      condition: (gameState, playerState) => {
        return playerState.hand.length > 0;
      },
      execute: async (card, gameState, playerState) => {
        // Step 1: Discard selection
        gameState.pendingQuery = {
          id: Math.random().toString(36).substring(7),
          type: 'SELECT_CARD',
          playerUid: playerState.uid,
          options: AtomicEffectExecutor.enrichQueryOptions(gameState, playerState.uid, playerState.hand.map(h => ({ card: h, source: 'HAND' as any }))),
          title: '选择舍弃的手牌',
          description: '效果消耗：请选择一张手牌舍弃。',
          minSelections: 1,
          maxSelections: 1,
          callbackKey: 'EFFECT_RESOLVE',
          context: { sourceCardId: card.gamecardId, effectIndex: 0, step: 1 }
        };
      },
      onQueryResolve: async (card, gameState, playerState, selections, context) => {
        const step = context?.step || 1;

        if (step === 1) {
          const discardId = selections[0];
          // Execute discard
          await AtomicEffectExecutor.execute(gameState, playerState.uid, {
            type: 'DISCARD_CARD',
            targetFilter: { gamecardId: discardId }
          }, card);
          gameState.logs.push(`${playerState.displayName} 舍弃了卡牌以触发效果。`);

          // Step 2: Target selection
          const minotaurs: any[] = [];
          Object.values(gameState.players).forEach(p => {
            p.unitZone.forEach(u => {
              if (u && u.fullName.includes('牛头人')) {
                minotaurs.push({ card: u, source: 'UNIT' as any });
              }
            });
          });

          if (minotaurs.length > 0) {
            gameState.pendingQuery = {
              id: Math.random().toString(36).substring(7),
              type: 'SELECT_CARD',
              playerUid: playerState.uid,
              options: AtomicEffectExecutor.enrichQueryOptions(gameState, playerState.uid, minotaurs),
              title: '选择目标单位',
              description: '效果结算：请选择一个名字包含「牛头人」的单位，使其获得力量+1000。',
              minSelections: 1,
              maxSelections: 1,
              callbackKey: 'EFFECT_RESOLVE',
              context: { sourceCardId: card.gamecardId, effectIndex: 0, step: 2 }
            };
          }
        } else if (step === 2) {
          const targetId = selections[0];
          const targetUnit = AtomicEffectExecutor.findCardById(gameState, targetId);

          if (targetUnit) {
            await AtomicEffectExecutor.execute(gameState, playerState.uid, {
              type: 'CHANGE_POWER',
              targetFilter: { gamecardId: targetId },
              value: 1000,
              turnDuration: 1
            }, card);
            gameState.logs.push(`[牛头人保镖领队] 效果生效：${targetUnit.fullName} 获得了本回合力量+1000。`);
          }
        }
      }
    }
  ],
  rarity: 'C',
  availableRarities: ['C'],
  uniqueId: null as any,
};

export default card;
