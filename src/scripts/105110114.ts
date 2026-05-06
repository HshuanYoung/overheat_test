import { Card, CardEffect, GameEvent } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';
import { moveCard } from './BaseUtil';

const effect_105110114_indestructible: CardEffect = {
  id: '105110114_indestructible',
  type: 'CONTINUOUS',
  description: '这个单位不能组成联军，也不会被破坏。',
  applyContinuous: (gameState, instance) => {
    const ownerUid = AtomicEffectExecutor.findCardOwnerKey(gameState, instance.gamecardId);
    if (!ownerUid) return;

    (instance as any).data = {
      ...((instance as any).data || {}),
      cannotAllianceByEffect: true,
      indestructibleByEffect: true
    };

    instance.influencingEffects = instance.influencingEffects || [];
    instance.influencingEffects.push({
      sourceCardName: instance.fullName,
      description: '不能联军 / 不能被破坏'
    });
  }
};

const effect_105110114_goddess_mark: CardEffect = {
  id: '105110114_goddess_mark',
  type: 'TRIGGER',
  triggerLocation: ['UNIT'],
  triggerEvent: 'GODDESS_TRANSFORMATION',
  isMandatory: true,
  erosionTotalLimit: [10, 10],
  description: '如果在本回合中你进入女神化状态，将这个单位标记为在回合结束时送入墓地。',
  condition: (_gameState, playerState, instance, event?: GameEvent) =>
    instance.cardlocation === 'UNIT' &&
    event?.type === 'GODDESS_TRANSFORMATION' &&
    event.playerUid === playerState.uid,
  execute: async (instance, gameState) => {
    (instance as any).data = {
      ...((instance as any).data || {}),
      enteredGoddessTurn_105110114: gameState.turnCount
    };
  }
};

const effect_105110114_end: CardEffect = {
  id: '105110114_end',
  type: 'TRIGGER',
  triggerLocation: ['UNIT'],
  triggerEvent: 'TURN_END' as any,
  isMandatory: true,
  description: '回合结束时，若本回合中你进入过女神化状态，将这个单位送入墓地。',
  condition: (gameState, _playerState, instance, event?: GameEvent) =>
    instance.cardlocation === 'UNIT' &&
    event?.type === ('TURN_END' as any) &&
    (instance as any).data?.enteredGoddessTurn_105110114 === gameState.turnCount,
  execute: async (instance, gameState, playerState) => {
    moveCard(gameState, playerState.uid, instance, 'GRAVE', instance);
    gameState.logs.push(`[${instance.fullName}] 进入女神化状态的回合结束，被送入墓地。`);
  }
};

const effect_105110114_ten_plus: CardEffect = {
  id: '105110114_ten_plus',
  type: 'CONTINUOUS',
  erosionTotalLimit: [10, 10],
  description: '10+: This unit gets +2 damage and +1500 power.',
  applyContinuous: (gameState, instance) => {
    const ownerUid = AtomicEffectExecutor.findCardOwnerKey(gameState, instance.gamecardId);
    if (!ownerUid) return;

    const owner = gameState.players[ownerUid];
    const pseudoGoddessActive = (instance as any).data?.pseudoGoddessTenPlusTurn === gameState.turnCount;
    if (!owner.isGoddessMode && !pseudoGoddessActive) return;

    instance.damage = (instance.damage || 0) + 2;
    instance.power = (instance.power || 0) + 1500;
    instance.influencingEffects = instance.influencingEffects || [];
    instance.influencingEffects.push({
      sourceCardName: instance.fullName,
      description: `${pseudoGoddessActive && !owner.isGoddessMode ? '伪神化' : '女神化'}：+2伤害 / +1500力量`
    });
  }
};

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 105110114
 * Card2 Row: 80
 * Card Row: 80
 * Source CardNo: BT01-Y08
 * Package: BT01(SR,ESR)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 【英勇】【歼灭】【速攻】
 * 【永】：这个单位不能组成联军，也不会被破坏。
 * 【诱】：回合结束时，若本回合中，你进入过女神化状态，将这个单位送入墓地。
 * 〖10+〗【永】：这个单位〖伤害+2〗〖力量+1500〗。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '105110114',
  fullName: '「瓦尔基里」ZERO',
  specialName: '瓦尔基里',
  type: 'UNIT',
  color: 'YELLOW',
  gamecardId: null as any,
  colorReq: { YELLOW: 2 },
  faction: '学院要塞',
  acValue: 4,
  power: 3500,
  basePower: 3500,
  damage: 2,
  baseDamage: 2,
  godMark: true,
  displayState: 'FRONT_UPRIGHT',
  isExhausted: false,
  isrush: true,
  baseIsrush: true,
  isAnnihilation: true,
  baseAnnihilation: true,
  isHeroic: true,
  baseHeroic: true,
  canAttack: true,
  feijingMark: false,
  canResetCount: 0,
  effects: [
    effect_105110114_indestructible,
    effect_105110114_goddess_mark,
    effect_105110114_end,
    effect_105110114_ten_plus
  ],
  rarity: 'SR',
  availableRarities: ['SR'],
  cardPackage: 'BT01',
  uniqueId: null as any,
};

export default card;
