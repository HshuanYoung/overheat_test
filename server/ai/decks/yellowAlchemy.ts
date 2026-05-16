import { DeckAiProfile } from '../types';
import { cardCost, effectHasTag, hasRole, openUnitSlots, opponentHasTrait, opponentIs, readyDefenders } from './strategyUtils';

export const yellowAlchemyProfile: DeckAiProfile = {
  id: 'yellow-alchemy',
  displayName: '纯黄炼金',
  shareCode: 'GiZGyewEmGvwiDA8EzjGhhYsxlzWwjocHi8BbiA',
  notes: '偏组合和资源利用，保留手牌质量，优先发挥效果牌。',
  preferredFactions: ['炼金'],
  effectPreferences: {
    preferredEffectIds: {
      '105110113_use_erosion_item': 7,
      '105110113_reveal_top': 3,
      '105120167_activate': 8,
      '105120168_activate': 6,
      '105120468_activate': 5,
      '305120030_activate': 7,
      '105110112_activate': 5,
      '105110108_activate': 4,
      '305110029_activate': 3,
      '205110042_activate': 2,
    },
    avoidEffectIds: {
      '105120167_last_resort': 20,
    },
    lowDeckAvoidEffectIds: {
      '105110108_activate': 12,
      '305120030_activate': 8,
      '105120167_activate': 6,
      '105120168_activate': 6,
      '105120468_activate': 6,
    },
    tagBias: {
      engine: 2,
      resource: 3,
      draw: 2,
      search: 2,
      summon: 3,
      removal: 1.5,
      tempo: 1,
    },
    phaseBias: {
      MAIN: 1.5,
      BATTLE_FREE: 0.5,
    },
    highCostTolerance: 3,
  },
  gamePlan: {
    mode: 'engine',
    primaryGoal: 'resourceLoop',
    attackPriority: 0.95,
    defensePriority: 0.95,
    developmentPriority: 1.2,
    effectPriority: 1.35,
    closeGameBias: 1.15,
    defenderReserveBias: 0.7,
    notes: ['Prioritize engine setup, then convert resource loops into board and damage.'],
  },
  riskThresholds: {
    lowDeck: 14,
    criticalDeck: 4,
    stopSelfDrawAtDeck: 14,
    stopSearchAtDeck: 13,
    highErosion: 7,
    criticalErosion: 9,
    reserveDefendersAtDeck: 12,
  },
  softCompensation: {
    openingSmoothing: true,
    openingLookahead: 10,
    maxOpeningReplacements: 1,
    extremeBrickRescueChance: 0.35,
    fullOpponentDeckProfile: true,
    notes: ['Slightly smooth openings toward one engine, resource, or playable stabilizer.'],
  },
  matchupPlans: {
    'red-dikai': {
      defenseBias: 0.6,
      defenderReserveBias: 0.9,
      developmentBias: -0.2,
      notes: ['Slow development slightly and keep blockers against red pressure.'],
    },
    'blue-adventurer': {
      attackBias: 0.4,
      closeGameBias: 0.4,
      stopSelfDrawAtDeck: 13,
      notes: ['Match blue tempo while avoiding late self-decking.'],
    },
    'white-temple': {
      effectBias: 0.4,
      developmentBias: 0.3,
      notes: ['Out-resource white before committing attacks into defenders.'],
    },
    'overlord-totem': {
      effectBias: 0.4,
      defenseBias: 0.3,
      notes: ['Use removal/resource effects to keep pace with graveyard recursion.'],
    },
  },
  weights: {
    unitPower: 0.85,
    unitDamage: 7.4,
    unitRush: 3.2,
    unitGodMark: 3.4,
    itemValue: 6.9,
    storyValue: 5.8,
    lowCost: 1.15,
    effectText: 1.55,
    attackBias: 1.15,
    defenseBias: 1,
    preserveHand: 1.45,
  },
  strategyHooks: {
    adjustTurnPlan: context => {
      if (context.opponentDeckProfile?.archetype === 'aggro') {
        return {
          reserveDefendersDelta: 1,
          minMainEffectScoreDelta: 0.2,
          notes: ['yellow hook: slow engine line until blockers are stable'],
        };
      }
      if (context.opponentDeckProfile?.archetype === 'control' || context.opponentDeckProfile?.archetype === 'midrange') {
        return {
          minMainEffectScoreDelta: -0.4,
          notes: ['yellow hook: lean into resource engine against slower decks'],
        };
      }
      return undefined;
    },
    adjustPlayableScore: context => {
      const card = context.card;
      let score = 0;
      if (hasRole(card, 'engine') || hasRole(card, 'resource')) score += 5;
      if (hasRole(card, 'draw') || hasRole(card, 'search')) score += (context.player?.deck.length || 0) > 14 ? 3.5 : -4;
      if (card.type === 'ITEM') score += 2.5;
      if (card.type === 'UNIT' && openUnitSlots(context) > 0 && hasRole(card, 'combo_piece')) score += 2;
      if (opponentIs(context, 'aggro') && readyDefenders(context) === 0 && card.type !== 'UNIT') score -= 5;
      return score;
    },
    adjustAttackScore: context => {
      const damage = context.card.damage || 0;
      let score = 0;
      if ((context.player?.hand.length || 0) >= 5 || opponentIs(context, 'control', 'engine')) score += damage * 1.5;
      if (opponentIs(context, 'aggro') && readyDefenders(context) <= 1) score -= damage * 2;
      return score;
    },
    adjustDefenseScore: context => {
      let score = 0;
      if (hasRole(context.card, 'engine') || hasRole(context.card, 'resource')) score -= opponentHasTrait(context, 'burst-damage') ? 2 : 8;
      if (opponentIs(context, 'aggro') || opponentHasTrait(context, 'burst-damage')) score += 9;
      return score;
    },
    adjustMulliganScore: context => {
      const card = context.card;
      let score = 0;
      if (hasRole(card, 'engine') || hasRole(card, 'resource')) score += 10;
      if ((hasRole(card, 'draw') || hasRole(card, 'search')) && (context.earlyUnitsInHand || 0) > 0) score += 5;
      if (card.type === 'ITEM' && cardCost(card) <= 3) score += 4;
      if (opponentIs(context, 'aggro') && card.type !== 'UNIT' && (context.earlyUnitsInHand || 0) === 0) score -= 10;
      return score;
    },
    adjustEffectScore: context => {
      let score = 0;
      if (effectHasTag(context, 'engine') || effectHasTag(context, 'resource') || effectHasTag(context, 'summon')) score += 4;
      if (effectHasTag(context, 'draw') || effectHasTag(context, 'search')) score += (context.player?.deck.length || 0) > 14 ? 3 : -6;
      if (effectHasTag(context, 'removal') && (opponentIs(context, 'aggro') || opponentHasTrait(context, 'large-defenders'))) score += 3;
      return score;
    },
  },
};
