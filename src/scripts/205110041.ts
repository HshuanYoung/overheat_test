import { Card, CardEffect } from '../types/game';
import { EventEngine } from '../services/EventEngine';

const effect_205110041_activate: CardEffect = {
  id: '205110041_activate',
  type: 'ACTIVATE',
  triggerLocation: ['HAND', 'PLAY'],
  description: 'Interrupt the current battle if one of your units is participating.',
  condition: (gameState, playerState) => {
    if (!gameState.battleState) return false;

    const attackers = gameState.battleState.attackers || [];
    const defenderId = gameState.battleState.defender;

    return (
      attackers.some(id => playerState.unitZone.some(unit => unit?.gamecardId === id)) ||
      playerState.unitZone.some(unit => unit?.gamecardId === defenderId)
    );
  },
  execute: async (instance, gameState) => {
    gameState.phase = 'BATTLE_END';
    gameState.battleState = undefined;
    gameState.previousPhase = undefined;
    gameState.logs.push(`[${instance.id}] interrupted the current battle.`);
    EventEngine.dispatchEvent(gameState, {
      type: 'PHASE_CHANGED',
      data: { phase: 'BATTLE_END', reason: 'BATTLE_INTERRUPTED' }
    });
  }
};

const card: Card = {
  id: '205110041',
  fullName: '逃脱',
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
  effects: [effect_205110041_activate],
  rarity: 'U',
  availableRarities: ['U'],
  cardPackage: 'BT01',
  uniqueId: null as any,
};

export default card;
