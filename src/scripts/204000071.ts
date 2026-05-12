import { Card, GameState, PlayerState } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';

const card: Card = {
  id: '204000071',
  fullName: '明镜止水',
  specialName: '',
  type: 'STORY',
  color: 'BLUE',
  gamecardId: null as any,
  colorReq: { BLUE: 1 },
  faction: '无',
  acValue: 3,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  feijingMark: false,
  canResetCount: 0,
  effects: [
    {
      id: 'clear_mirror_activate',
      type: 'ACTIVATE',
      triggerLocation: ['PLAY'],
      erosionBackLimit: [2, 10],
      description: '若你的侵蚀区背面结算卡在2张及以上，选择战场上的一个单位。在本回合中，该单位的所有效果无效（不影响其他卡牌赋予该单位的效果），且不受该单位以外的单位效果影响。',
      condition: (gameState, playerState) => {
        // Check if there is at least one unit on the battlefield
        return Object.values(gameState.players).some(p => p.unitZone.some(u => u !== null));
      },
      execute: async (card, gameState, playerState) => {
        const targets: Card[] = [];
        Object.values(gameState.players).forEach(p => {
          p.unitZone.forEach(u => {
            if (u !== null) targets.push(u);
          });
        });

        if (targets.length === 0) {
          gameState.logs.push(`[明镜止水] 没有合法目标。`);
          return;
        }

        gameState.pendingQuery = {
          id: Math.random().toString(36).substring(7),
          type: 'SELECT_CARD',
          playerUid: playerState.uid,
          options: AtomicEffectExecutor.enrichQueryOptions(gameState, playerState.uid, targets.map(t => ({ card: t, source: 'UNIT' as any }))),
          title: '选择目标单位',
          description: '请选择一个单位进行效果屏蔽与单位效果免疫。',
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
        const targetCard = AtomicEffectExecutor.findCardById(gameState, targetId);

        // 1. Silence (Negate instance effects for the turn)
        await AtomicEffectExecutor.execute(gameState, playerState.uid, {
          type: 'CHANGE_CAN_ACTIVATE',
          value: 0, // 0 means false/silenced
          turnDuration: 1, // Current turn
          targetFilter: { gamecardId: targetId }
        }, card);

        // 2. Unit Immunity (Immune to OTHER unit effects for the turn)
        await AtomicEffectExecutor.execute(gameState, playerState.uid, {
          type: 'IMMUNE_UNIT_EFFECTS',
          value: 1, // 1 means true/immune
          turnDuration: 1, // Current turn
          targetFilter: { gamecardId: targetId }
        }, card);

        if (targetCard) {
          (targetCard as any).data = {
            ...((targetCard as any).data || {}),
            clearMirrorActiveTurn: gameState.turnCount
          };
        }

        gameState.logs.push(`[明镜止水] 已对目标单位生效。`);
      },
      targetSpec: {
        title: '选择目标单位',
        description: '请选择一个单位进行效果屏蔽与单位效果免疫。',
        minSelections: 1,
        maxSelections: 1,
        zones: ['UNIT'],
        getCandidates: gameState => Object.values(gameState.players)
          .flatMap(player => player.unitZone.filter((card): card is Card => !!card))
          .map(card => ({ card, source: 'UNIT' as any }))
      }
    }
  ],
  rarity: 'C',
  availableRarities: ['C'],
  cardPackage: 'BT03',
  uniqueId: null as any,
};

export default card;
