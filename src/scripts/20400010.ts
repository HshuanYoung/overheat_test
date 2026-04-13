import { Card, GameState, PlayerState, CardEffect, TriggerLocation } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';

const effect_20400010_activation: CardEffect = {
  id: 'hensou_protection',
  type: 'ACTIVATE',
  description: '【起】选择我方单位区或道具区的一张卡牌。在本回合中，该卡牌下一次成为效果的对象时，该效果不被处理。',
  condition: (gameState: GameState, playerState: PlayerState) => {
    return playerState.isTurn && gameState.phase === 'MAIN';
  },
  execute: async (gameState: GameState, playerState: PlayerState, instance: Card) => {
    const targets: Card[] = [];
    playerState.unitZone.forEach(c => { if (c) targets.push(c); });
    playerState.itemZone.forEach(c => { if (c) targets.push(c); });

    if (targets.length > 0) {
      gameState.pendingQuery = {
        id: Math.random().toString(36).substring(7),
        type: 'SELECT_CARD',
        playerUid: playerState.uid,
        options: AtomicEffectExecutor.enrichQueryOptions(gameState, playerState.uid, targets.map(c => ({ card: c, source: c.cardlocation as TriggerLocation }))),
        title: '选择保护目标',
        description: '选择一张我方单位或道具，为其施加一次效果抵消护盾。',
        minSelections: 1,
        maxSelections: 1,
        callbackKey: 'EFFECT_RESOLVE',
        context: {
          effectId: 'hensou_protection',
          sourceCardId: instance.gamecardId
        }
      };
    } else {
      gameState.logs.push(`[${instance.fullName}] 未发现可用目标，施加失败。`);
    }
  },
  onQueryResolve: (instance: Card, gameState: GameState, playerState: PlayerState, selections: string[]) => {
    if (selections.length > 0) {
      const targetId = selections[0];
      const target = AtomicEffectExecutor.findCardById(gameState, targetId);
      if (target) {
        target.nextEffectProtection = true;
        gameState.logs.push(`[${instance.fullName}] 为 [${target.fullName}] 施加了效果抵消护盾！`);
      }
    }
  }
};

const card: Card = {
  id: '20400010',
  gamecardId: null as any,
  fullName: '变装',
  specialName: '',
  type: 'STORY',
  color: 'BLUE',
  colorReq: { 'BLUE': 1 },
  faction: '无',
  acValue: 2,
  power: 0,
  basePower: 0,
  damage: 0,
  baseDamage: 0,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  isExhausted: false,
  isrush: false,
  canAttack: false,
  feijingMark: false,
  canResetCount: 0,
  effects: [
    effect_20400010_activation
  ],
  rarity: 'U',
  availableRarities: ['U'],
  uniqueId: null,
};

export default card;
