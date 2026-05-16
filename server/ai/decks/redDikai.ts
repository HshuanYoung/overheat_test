import { DeckAiProfile } from '../types';
import { cardCost, cardText, effectHasTag, hasAny, hasRole, opponentHasTrait, opponentIs } from './strategyUtils';

export const redDikaiProfile: DeckAiProfile = {
  id: 'red-dikai',
  displayName: '纯红迪凯',
  shareCode: 'GiZGyewEYc36VH-D_OFfRCRYj_pxghorWWk',
  notes: '偏进攻，优先推动伤害和战斗阶段，较少保守防御。',
  preferredFactions: ['迪凯'],
  effectPreferences: {
    preferredEffectIds: {
      '102050432_reset_attack_unit': 10,
      '102050427_cannot_defend': 7,
      '102000146_exile_destroy': 5,
      '202000035_destroy': 5,
      '202050034_destroy_god': 4,
      '102050089_damage_search': 3,
      '102060433_power_search': 3,
      '102060433_red_story_boost': 3,
    },
    avoidEffectIds: {
      '202000131_duel': 4,
    },
    tagBias: {
      reset: 5,
      combat: 3,
      finisher: 4,
      tempo: 3,
      removal: 2,
      buff: 2,
      search: 1,
    },
    phaseBias: {
      MAIN: 0.5,
      BATTLE_FREE: 3,
    },
    highCostTolerance: 2,
  },
  gamePlan: {
    mode: 'aggro',
    primaryGoal: 'damage',
    attackPriority: 2,
    defensePriority: -0.2,
    developmentPriority: 0.2,
    effectPriority: 0.9,
    closeGameBias: 2,
    defenderReserveBias: -0.8,
    notes: ['Convert board into damage quickly and use battle effects to force lethal windows.'],
  },
  riskThresholds: {
    lowDeck: 8,
    criticalDeck: 3,
    stopSelfDrawAtDeck: 8,
    stopSearchAtDeck: 7,
    highErosion: 8,
    criticalErosion: 9,
    reserveDefendersAtDeck: 6,
  },
  softCompensation: {
    openingSmoothing: true,
    openingLookahead: 8,
    maxOpeningReplacements: 1,
    extremeBrickRescueChance: 0.32,
    fullOpponentDeckProfile: true,
    notes: ['Slightly smooth openings toward early pressure without guaranteeing perfect curve.'],
  },
  matchupPlans: {
    'white-temple': {
      attackBias: 0.5,
      closeGameBias: 0.6,
      notes: ['Attack through white before defensive value overtakes damage race.'],
    },
    'blue-adventurer': {
      attackBias: 0.4,
      effectBias: 0.3,
      notes: ['Keep pressure high so blue cannot spend turns on engine choices.'],
    },
    'yellow-alchemy': {
      attackBias: 0.5,
      closeGameBias: 0.5,
      notes: ['Punish yellow setup turns with immediate battle pressure.'],
    },
    'overlord-totem': {
      attackBias: 0.4,
      effectBias: 0.4,
      notes: ['Use removal and cannot-defend effects before totem boards rebuild.'],
    },
  },
  weights: {
    unitPower: 0.9,
    unitDamage: 9.2,
    unitRush: 5.2,
    unitGodMark: 2.6,
    itemValue: 5.2,
    storyValue: 4.6,
    lowCost: 1.15,
    effectText: 1,
    attackBias: 1.5,
    defenseBias: 0.75,
    preserveHand: 0.85,
  },
  strategyHooks: {
    adjustTurnPlan: context => {
      if (context.plan.attackers > 0 && context.plan.opponentErosion >= 5) {
        return {
          attackBeforeDeveloping: true,
          reserveDefendersDelta: -1,
          minBattleEffectScoreDelta: -0.8,
          notes: ['red hook: push battle pressure near lethal range'],
        };
      }
      if (context.opponentDeckProfile?.archetype === 'engine' || context.opponentDeckProfile?.archetype === 'combo') {
        return {
          attackBeforeDeveloping: context.plan.attackers > 0,
          reserveDefendersDelta: -1,
          notes: ['red hook: race setup deck'],
        };
      }
      return undefined;
    },
    adjustPlayableScore: context => {
      const card = context.card;
      const text = cardText(card);
      let score = 0;
      if (card.type === 'UNIT') score += (card.damage || 0) * 4 + (card.isrush ? 6 : 0);
      if (card.type === 'UNIT' && cardCost(card) <= 3) score += 3;
      if (hasRole(card, 'removal') || hasRole(card, 'damage') || hasRole(card, 'finisher')) score += 3;
      if (hasAny(text, [/不能防御|cannot defend|重置|竖置|reset|ready/i])) score += 4;
      if (opponentIs(context, 'aggro') && card.type !== 'UNIT' && cardCost(card) > 3) score -= 3;
      return score;
    },
    adjustAttackScore: context => {
      const damage = context.card.damage || 0;
      let score = 6 + damage * 4;
      if (context.card.isrush) score += 3;
      if (opponentIs(context, 'control', 'engine', 'combo')) score += damage * 2;
      if (opponentHasTrait(context, 'large-defenders')) score += damage * 1.2;
      return score;
    },
    adjustDefenseScore: context => {
      const damage = context.card.damage || 0;
      let score = -6 - damage * 3;
      if ((context.player?.deck.length || 0) <= 5 || opponentHasTrait(context, 'burst-damage')) score += 12;
      return score;
    },
    adjustMulliganScore: context => {
      const card = context.card;
      let score = 0;
      if (card.type === 'UNIT' && cardCost(card) <= 3) score += 14;
      if (card.type === 'UNIT' && (card.damage || 0) >= 2) score += 8;
      if (card.isrush) score += 10;
      if (hasRole(card, 'finisher') && cardCost(card) <= 4) score += 5;
      if (cardCost(card) >= 5 && !card.isrush) score -= 14;
      return score;
    },
    adjustEffectScore: context => {
      let score = 0;
      if (effectHasTag(context, 'combat') || effectHasTag(context, 'finisher') || effectHasTag(context, 'buff')) score += 5;
      if (effectHasTag(context, 'removal') || effectHasTag(context, 'tempo')) score += opponentHasTrait(context, 'large-defenders') ? 5 : 2.5;
      if (effectHasTag(context, 'draw') && (context.player?.deck.length || 0) <= 8) score -= 5;
      if (opponentIs(context, 'engine', 'combo') && effectHasTag(context, 'finisher')) score += 3;
      return score;
    },
  },
};
