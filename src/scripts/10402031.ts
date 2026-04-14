import { Card, GameState, PlayerState, CardEffect } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';

const card: Card = {
  id: '10402031',
  fullName: '牛头人护卫',
  specialName: '',
  type: 'UNIT',
  color: 'BLUE',
  gamecardId: null as any,
  colorReq: { BLUE: 1 },
  faction: '九尾商会联盟',
  acValue: 3,
  power: 2500,
  basePower: 2500,
  damage: 2,
  baseDamage: 2,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  isExhausted: false,
  isrush: false,
  canAttack: true,
  feijingMark: false,
  canResetCount: 0,
  effects: [
    {
      id: 'minotaur_guard_trigger',
      type: 'TRIGGER',
      triggerEvent: 'CARD_ENTERED_ZONE',
      description: '【诱发】：当这个单位进入单位区时，如果你单位区中包含3个或3个以上「九尾商会联盟」的单位，你可以选择发动，选择对手的一个横置状态的力量值少于1500点的一个单位并将其破坏。',
      condition: (gameState, playerState, instance, event) => {
        if (event?.sourceCardId !== instance.gamecardId || event?.data?.zone !== 'UNIT') return false;

        const guildCount = playerState.unitZone.filter(u =>
          u !== null && u.faction === '九尾商会联盟'
        ).length;

        return guildCount >= 3;
      },
      execute: async (card, gameState, playerState) => {
        const opponentUid = Object.keys(gameState.players).find(uid => uid !== playerState.uid);
        if (!opponentUid) return;
        const opponent = gameState.players[opponentUid];

        const eligibleTargets = opponent.unitZone.filter(u =>
          u !== null && u.isExhausted && (u.power || 0) < 1500
        ) as Card[];

        if (eligibleTargets.length > 0) {
          gameState.pendingQuery = {
            id: Math.random().toString(36).substring(7),
            type: 'SELECT_CARD',
            playerUid: playerState.uid,
            options: AtomicEffectExecutor.enrichQueryOptions(gameState, playerState.uid, eligibleTargets.map(u => ({ card: u, source: 'UNIT' as any }))),
            title: '效果发动选择',
            description: '【诱发】：你可以选择破坏一个对手横置且力量<1500的单位。',
            minSelections: 0, // Effectively "choose to activate"
            maxSelections: 1,
            callbackKey: 'EFFECT_RESOLVE',
            context: { sourceCardId: card.gamecardId, effectIndex: 0, step: 1 }
          };
        }
      },
      onQueryResolve: async (card, gameState, playerState, selections, context) => {
        if (selections.length > 0) {
          const targetId = selections[0];

          await AtomicEffectExecutor.execute(gameState, playerState.uid, {
            type: 'DESTROY_CARD',
            targetFilter: { gamecardId: targetId }
          }, card);

          gameState.logs.push(`[牛头人护卫] 触发效果：破坏了对手的单位 ${targetId}。`);
        }
      }
    }
  ],
  rarity: 'C',
  availableRarities: ['C'],
  uniqueId: null as any,
};

export default card;
