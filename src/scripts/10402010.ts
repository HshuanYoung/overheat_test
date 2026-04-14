import { Card, GameState, PlayerState, CardEffect, GameEvent } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';

const trigger_10402010: CardEffect = {
  id: '10402010_trigger',
  type: 'TRIGGER',
  description: '【诱发】[一回合一次] 当你进入女神化状态时，可以发动：选择对方单位区的一位单位横置。在接下来的对手回合开始时，该单位不能被纵置。',
  triggerLocation: ['UNIT'],
  triggerEvent: 'GODDESS_TRANSFORMATION',
  isMandatory: false,
  limitCount: 1,
  condition: (gameState: GameState, playerState: PlayerState, instance: Card, event?: GameEvent) => {
    // 1. Triggered by self entering Goddess Mode
    if (!event || event.type !== 'GODDESS_TRANSFORMATION' || event.playerUid !== playerState.uid) return false;

    // 2. Opponent must have units
    const opponentId = Object.keys(gameState.players).find(id => id !== playerState.uid)!;
    const opponent = gameState.players[opponentId];
    return opponent.unitZone.some(u => u !== null);
  },
  execute: async (instance: Card, gameState: GameState, playerState: PlayerState) => {
    const opponentId = Object.keys(gameState.players).find(id => id !== playerState.uid)!;
    const opponent = gameState.players[opponentId];
    const targets = opponent.unitZone.filter(u => u !== null) as Card[];

    if (targets.length > 0) {
      gameState.pendingQuery = {
        id: Math.random().toString(36).substring(7),
        type: 'SELECT_CARD',
        playerUid: playerState.uid,
        options: AtomicEffectExecutor.enrichQueryOptions(gameState, playerState.uid, targets.map(c => ({ card: c, source: 'UNIT' }))),
        title: '选择横置的单位',
        description: '请选择对方单位区的一张卡牌进行横置并阻碍调度',
        minSelections: 1,
        maxSelections: 1,
        callbackKey: 'EFFECT_RESOLVE',
        context: {
          sourceCardId: instance.gamecardId,
          effectId: '10402010_trigger',
          step: 1
        }
      };
    }
  },
  onQueryResolve: async (instance: Card, gameState: GameState, playerState: PlayerState, selections: string[], context: any) => {
    if (context.step === 1) {
      const targetId = selections[0];
      const targetCard = AtomicEffectExecutor.findTargets(gameState, { gamecardId: targetId })[0];
      
      if (targetCard) {
        // 1. Rotate horizontal
        await AtomicEffectExecutor.execute(gameState, playerState.uid, {
          type: 'ROTATE_HORIZONTAL',
          targetFilter: { gamecardId: targetId }
        }, instance);
        
        // 2. Lock reset for 1 turn (next turn start)
        await AtomicEffectExecutor.execute(gameState, playerState.uid, {
          type: 'SET_CAN_RESET_COUNT',
          targetFilter: { gamecardId: targetId },
          value: 1
        }, instance);
        
        gameState.logs.push(`[${instance.fullName}] 效果：横置了 ${targetCard.fullName} 并阻碍了其下一次调度。`);
      }
    }
  }
};

const card: Card = {
  id: '10402010',
  fullName: '[洛·李斯]',
  specialName: '洛·李斯',
  type: 'UNIT',
  color: 'BLUE',
  gamecardId: null as any,
  colorReq: { 'BLUE': 1 },
  faction: '九尾商会联盟',
  acValue: 2,
  power: 2000,
  basePower: 2000,
  damage: 2,
  baseDamage: 2,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  isExhausted: false,
  isrush: false,
  canAttack: true,
  feijingMark: false,
  canResetCount: 0,
  effects: [trigger_10402010],
  rarity: 'R',
  availableRarities: ['R'],
  uniqueId: null,
};

export default card;
