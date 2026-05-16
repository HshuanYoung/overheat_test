import { DeckAiProfile } from '../types';
import { cardCost, cardText, effectHasTag, hasAny, hasRole, openUnitSlots, opponentHasTrait, opponentIs } from './strategyUtils';

export const blueAdventurerProfile: DeckAiProfile = {
  id: 'blue-adventurer',
  displayName: '纯蓝冒险家',
  shareCode: 'GiZGyewEtT6lckR2Hcp99EgcA8tX2-BW6Hx6NI_c',
  notes: '偏节奏和手牌质量，重视低费展开与效果牌选择。',
  preferredFactions: ['冒险家'],
  effectPreferences: {
    preferredEffectIds: {
      'aketi_play_from_erosion': 5,
      'aketi_goddess_bounce': 5,
      'seii_from_erosion': 5,
      'seii_to_erosion': 3,
      '104030459_swap_activate': 6,
      '104020066_activate_1': 4,
      '104020066_activate_2': 1,
      '104030453_swap': 4,
      'wen_swap_activate': 4,
      'freya_ranger_activate': 4,
      'dragon_wing_receptionist_activate': 4,
      'accept_commission_activate': 5,
      '304020009_activate': 1,
      '204020024_activate': 4,
    },
    tagBias: {
      search: 3,
      draw: 1,
      summon: 3,
      resource: 2,
      tempo: 1.5,
      engine: 1,
    },
    phaseBias: {
      MAIN: 1,
      BATTLE_FREE: 0.5,
    },
    highCostTolerance: 2,
  },
  gamePlan: {
    mode: 'tempo',
    primaryGoal: 'deckPressure',
    attackPriority: 1.2,
    defensePriority: 0.8,
    developmentPriority: 1.1,
    effectPriority: 1.2,
    closeGameBias: 1.4,
    defenderReserveBias: 0.5,
    notes: ['Use early tempo to pressure erosion, but stop spending deck once the library is low.'],
  },
  riskThresholds: {
    lowDeck: 13,
    criticalDeck: 5,
    stopSelfDrawAtDeck: 14,
    stopSearchAtDeck: 12,
    highErosion: 7,
    criticalErosion: 9,
    reserveDefendersAtDeck: 12,
  },
  softCompensation: {
    openingSmoothing: true,
    openingLookahead: 9,
    maxOpeningReplacements: 1,
    extremeBrickRescueChance: 0.3,
    fullOpponentDeckProfile: true,
    notes: ['Slightly smooth openings toward one low-cost tempo unit or selection engine.'],
  },
  matchupPlans: {
    'red-dikai': {
      defenseBias: 0.6,
      defenderReserveBias: 1,
      stopSelfDrawAtDeck: 15,
      notes: ['Respect red burst damage and keep one extra ready unit when possible.'],
    },
    'white-temple': {
      attackBias: 0.6,
      effectBias: 0.3,
      closeGameBias: 0.5,
      notes: ['Push damage before white stabilizes behind higher-value defenders.'],
    },
    'yellow-alchemy': {
      attackBias: 0.5,
      closeGameBias: 0.4,
      notes: ['Pressure yellow before its engine snowballs.'],
    },
    'overlord-totem': {
      defenseBias: 0.4,
      defenderReserveBias: 0.5,
      notes: ['Preserve blockers against revived board pressure.'],
    },
  },
  weights: {
    unitPower: 0.95,
    unitDamage: 7.5,
    unitRush: 4.8,
    unitGodMark: 3.2,
    itemValue: 6.4,
    storyValue: 5.6,
    lowCost: 1.35,
    effectText: 1.35,
    attackBias: 1.32,
    defenseBias: 0.95,
    preserveHand: 1.1,
  },
  strategyHooks: {
    adjustTurnPlan: context => {
      if (context.opponentDeckProfile?.archetype === 'engine' || context.opponentDeckProfile?.archetype === 'combo') {
        return {
          attackBeforeDeveloping: context.plan.attackers > 0,
          minMainEffectScoreDelta: -0.3,
          notes: ['blue hook: convert tempo into pressure against setup decks'],
        };
      }
      if (context.opponentDeckProfile?.archetype === 'aggro') {
        return {
          reserveDefendersDelta: 1,
          notes: ['blue hook: preserve tempo blocker against aggro'],
        };
      }
      return undefined;
    },
    adjustPlayableScore: context => {
      const card = context.card;
      const text = cardText(card);
      let score = 0;
      if (card.type === 'UNIT' && cardCost(card) <= 3) score += 4.5;
      if (card.type === 'UNIT' && openUnitSlots(context) > 0 && hasAny(text, [/冒险家|委托|erosion|侵蚀/])) score += 2;
      if (hasRole(card, 'search') || hasRole(card, 'draw')) score += context.player && context.player.hand.length <= 5 ? 3 : 0.8;
      if (hasRole(card, 'tempo') || hasRole(card, 'removal')) score += opponentHasTrait(context, 'large-defenders') ? 3 : 1.5;
      if (opponentIs(context, 'aggro') && cardCost(card) >= 5) score -= 5;
      return score;
    },
    adjustAttackScore: context => {
      const damage = context.card.damage || 0;
      let score = damage * 0.8;
      if (opponentIs(context, 'engine', 'combo', 'control')) score += damage * 1.6;
      if (opponentIs(context, 'aggro') && (context.player?.deck.length || 0) <= 12) score -= damage * 1.2;
      return score;
    },
    adjustDefenseScore: context => {
      if (opponentIs(context, 'aggro') || opponentHasTrait(context, 'burst-damage')) return 6;
      if (hasRole(context.card, 'engine') || hasRole(context.card, 'search')) return -3;
      return 0;
    },
    adjustMulliganScore: context => {
      const card = context.card;
      let score = 0;
      if (card.type === 'UNIT' && cardCost(card) <= 3) score += 12;
      if (hasRole(card, 'search') && (context.earlyUnitsInHand || 0) > 0) score += 6;
      if (hasRole(card, 'tempo')) score += 4;
      if (cardCost(card) >= 5) score -= 8;
      return score;
    },
    adjustEffectScore: context => {
      let score = 0;
      if (effectHasTag(context, 'search') || effectHasTag(context, 'summon')) score += 3;
      if (effectHasTag(context, 'tempo') && opponentHasTrait(context, 'large-defenders')) score += 4;
      if (effectHasTag(context, 'draw') && (context.player?.deck.length || 0) <= 13) score -= 4;
      if (opponentIs(context, 'engine', 'combo') && (effectHasTag(context, 'tempo') || effectHasTag(context, 'removal'))) score += 3;
      return score;
    },
  },
};
