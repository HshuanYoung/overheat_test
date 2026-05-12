import { Card, GameState, PlayerState, CardEffect } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';

const effect_204000046_activation: CardEffect = {
  id: 'hensou_protection',
  type: 'ACTIVATE',
  triggerLocation: ['HAND'],
  description: '【启】选择我方单位区或道具区的一张卡牌。在本回合中，该卡牌下一次成为效果的对象时，该效果不被处理。',
  condition: (gameState: GameState, playerState: PlayerState, instance: Card) => {
    if (instance.cardlocation !== 'HAND') {
      return false;
    }
    const hasTargets =
      playerState.unitZone.some(c => !!c) ||
      playerState.itemZone.some(c => !!c);
    const sharedPhases = ['MAIN', 'BATTLE_DECLARATION', 'BATTLE_FREE'];
    return hasTargets && (sharedPhases.includes(gameState.phase) || gameState.phase === 'COUNTERING');
  },
  targetSpec: {
    title: '选择保护目标',
    description: '选择一张我方单位或道具，为其施加一次效果抵消护盾。',
    minSelections: 1,
    maxSelections: 1,
    controller: 'SELF',
    zones: ['UNIT', 'ITEM'],
    getCandidates: (_gameState, playerState) => [
      ...playerState.unitZone.filter((card): card is Card => !!card).map(card => ({ card, source: 'UNIT' as const })),
      ...playerState.itemZone.filter((card): card is Card => !!card).map(card => ({ card, source: 'ITEM' as const }))
    ]
  },
  execute: async (instance: Card, gameState: GameState, _playerState: PlayerState, _event?: any, declaredSelections?: string[]) => {
    const targetId = declaredSelections?.[0];
    const target = targetId ? AtomicEffectExecutor.findCardById(gameState, targetId) : undefined;
    if (target) {
      target.nextEffectProtection = true;
      gameState.logs.push(`[${instance.fullName}] 为 [${target.fullName}] 施加了效果抵消护盾！`);
    }
  },
  onQueryResolve: async (instance: Card, gameState: GameState, playerState: PlayerState, selections: string[]) => {
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
  id: '204000046',
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
    effect_204000046_activation
  ],
  rarity: 'U',
  availableRarities: ['U'],
  cardPackage: 'BT02',
  uniqueId: null,
};

export default card;
