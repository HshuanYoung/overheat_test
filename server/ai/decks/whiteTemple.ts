import { DeckAiProfile } from '../types';
import { cardCost, cardText, effectHasTag, hasAny, hasRole, opponentHasTrait, opponentIs, readyDefenders } from './strategyUtils';

export const whiteTempleProfile: DeckAiProfile = {
  id: 'white-temple',
  displayName: '纯白殿堂',
  shareCode: 'GiZGyewEgAHuKBCRHfBXL0ZqofebNZYwojMMXA',
  notes: '偏防守和资源续航，保留高价值单位，倾向稳健防御。',
  preferredFactions: ['殿堂', '圣王国'],
  effectPreferences: {
    preferredEffectIds: {
      '101130439_reset_hall': 6,
      '101130441_reset_boost': 6,
      '101130440_reset_boost': 5,
      '201000056_search': 4,
      '201130038_blessing': 3,
      '101000487_grave_exile_boost': 2,
      '101140152_silence_god': 3,
    },
    avoidEffectIds: {
      '101000159_protect': 8,
      '201000059_prevent_destroy': 8,
      '201100037_eclipse': 8,
    },
    tagBias: {
      reset: 3,
      resource: 1.5,
      search: 1.5,
      protection: 1,
      buff: 1,
      combat: 0.5,
    },
    phaseBias: {
      MAIN: 0.5,
      BATTLE_FREE: 1.5,
    },
    highCostTolerance: 1,
  },
  gamePlan: {
    mode: 'control',
    primaryGoal: 'boardControl',
    attackPriority: 0.3,
    defensePriority: 1.6,
    developmentPriority: 0.8,
    effectPriority: 0.8,
    closeGameBias: 0.2,
    defenderReserveBias: 1.1,
    notes: ['Stabilize the board, preserve high-value units, then attack when pressure is safe.'],
  },
  riskThresholds: {
    lowDeck: 12,
    criticalDeck: 4,
    stopSelfDrawAtDeck: 13,
    stopSearchAtDeck: 11,
    highErosion: 7,
    criticalErosion: 9,
    reserveDefendersAtDeck: 12,
  },
  softCompensation: {
    openingSmoothing: true,
    openingLookahead: 8,
    maxOpeningReplacements: 1,
    extremeBrickRescueChance: 0.28,
    fullOpponentDeckProfile: true,
    notes: ['Slightly smooth openings toward at least one early defender or control piece.'],
  },
  matchupPlans: {
    'red-dikai': {
      defenseBias: 0.8,
      defenderReserveBias: 1.2,
      closeGameBias: 0.3,
      notes: ['Keep ready defenders against red burst turns.'],
    },
    'blue-adventurer': {
      attackBias: 0.3,
      effectBias: 0.3,
      notes: ['Remove tempo pieces and attack once blue deck pressure rises.'],
    },
    'yellow-alchemy': {
      attackBias: 0.4,
      notes: ['Do not let yellow build engine uncontested.'],
    },
    'overlord-totem': {
      defenseBias: 0.5,
      effectBias: 0.4,
      notes: ['Prioritize board control into revived threats.'],
    },
  },
  weights: {
    unitPower: 1.15,
    unitDamage: 6.8,
    unitRush: 2.6,
    unitGodMark: 4.4,
    itemValue: 7.2,
    storyValue: 4.8,
    lowCost: 0.95,
    effectText: 1.15,
    attackBias: 0.95,
    defenseBias: 1.35,
    preserveHand: 1.25,
  },
  strategyHooks: {
    adjustTurnPlan: context => {
      if (context.opponentDeckProfile?.archetype === 'aggro' || context.opponentDeckProfile?.traits.includes('burst-damage')) {
        return {
          reserveDefendersDelta: 1,
          minBattleEffectScoreDelta: -0.4,
          notes: ['white hook: hold blockers into burst damage'],
        };
      }
      if (context.opponentDeckProfile?.archetype === 'engine' || context.opponentDeckProfile?.archetype === 'combo') {
        return {
          minMainEffectScoreDelta: -0.3,
          notes: ['white hook: use control effects before engine stabilizes'],
        };
      }
      return undefined;
    },
    adjustPlayableScore: context => {
      const card = context.card;
      const text = cardText(card);
      let score = 0;
      if (card.type === 'UNIT' && ((card.power || 0) >= 5000 || hasRole(card, 'defender'))) score += 3.5;
      if (hasRole(card, 'protection')) score += opponentIs(context, 'aggro', 'tempo') ? 3 : 1.2;
      if (hasRole(card, 'removal') && (opponentIs(context, 'engine', 'combo') || opponentHasTrait(context, 'large-defenders'))) score += 3;
      if (opponentIs(context, 'aggro') && card.type !== 'UNIT' && readyDefenders(context) === 0 && cardCost(card) > 2) score -= 4;
      if (hasAny(text, [/殿堂|圣王国/]) && cardCost(card) <= 4) score += 1.5;
      return score;
    },
    adjustAttackScore: context => {
      const damage = context.card.damage || 0;
      if (context.opponentDeckProfile?.archetype === 'aggro' && !context.matchupPlan?.closeGameBias) {
        return -damage * 1.6;
      }
      if (opponentIs(context, 'engine', 'combo')) return damage * 1.2;
      return 0;
    },
    adjustDefenseScore: context => {
      let score = 0;
      if (opponentIs(context, 'aggro', 'tempo') || opponentHasTrait(context, 'burst-damage')) score += 10;
      if (hasRole(context.card, 'defender') || hasRole(context.card, 'protection')) score += 4;
      if ((context.card.damage || 0) >= 2 && !opponentHasTrait(context, 'burst-damage')) score -= 2;
      return score;
    },
    adjustMulliganScore: context => {
      const card = context.card;
      let score = 0;
      if (card.type === 'UNIT' && cardCost(card) <= 4) score += 7;
      if (hasRole(card, 'protection') || hasRole(card, 'removal')) score += 4;
      if (opponentIs(context, 'aggro') && card.type !== 'UNIT') score -= 4;
      return score;
    },
    adjustEffectScore: context => {
      let score = 0;
      if ((effectHasTag(context, 'protection') || effectHasTag(context, 'removal')) && opponentIs(context, 'aggro', 'tempo')) score += 4;
      if (effectHasTag(context, 'reset') || effectHasTag(context, 'resource')) score += 1.5;
      if (effectHasTag(context, 'draw') && (context.player?.deck.length || 0) <= 12) score -= 4;
      return score;
    },
  },
};
