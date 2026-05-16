import { DeckAiProfile } from '../types';
import { cardText, effectHasTag, hasAny, hasRole, openUnitSlots, opponentErosion, opponentHasTrait, opponentIs, ownErosion, readyAttackers, readyDefenders } from './strategyUtils';

export const overlordTotemProfile: DeckAiProfile = {
  id: 'overlord-totem',
  displayName: '霸者图腾',
  shareCode: 'GiZGyewEgBU3mzFTW6iQg3U5uknjrogEhXPquA',
  notes: '偏站场和图腾协同，重视场面价值与关键单位存活。',
  preferredFactions: ['图腾', '霸者'],
  effectPreferences: {
    preferredEffectIds: {
      '103080211_rebirth': 9,
      '103080212_plan': 7,
      '103080184_granted_totem_revive': 8,
      '103080183_destroy': 5,
      '103080258_boost_return': 4,
      '103090180_exhaust_boost': 4,
      '103090180_ten_revive': 8,
      '203000075_choice': 8,
      '203000076_spirit_boost': 6,
      '203000126_ritual': 8,
      '203080083_prepare': 7,
      '203000129_trample': 5,
    },
    tagBias: {
      revive: 5,
      summon: 4,
      engine: 2,
      resource: 2,
      buff: 2,
      combat: 1.5,
      removal: 1.5,
      protection: 1,
    },
    phaseBias: {
      MAIN: 1,
      BATTLE_FREE: 1,
    },
    highCostTolerance: 2,
  },
  gamePlan: {
    mode: 'midrange',
    primaryGoal: 'comboSetup',
    attackPriority: 1.15,
    defensePriority: 1.25,
    developmentPriority: 0.9,
    effectPriority: 1.2,
    closeGameBias: 1.25,
    defenderReserveBias: 0.9,
    notes: ['Build recursive totem boards, preserve core units, then pressure once the engine is online.'],
  },
  riskThresholds: {
    lowDeck: 13,
    criticalDeck: 4,
    stopSelfDrawAtDeck: 13,
    stopSearchAtDeck: 12,
    highErosion: 7,
    criticalErosion: 9,
    reserveDefendersAtDeck: 12,
  },
  softCompensation: {
    openingSmoothing: true,
    openingLookahead: 9,
    maxOpeningReplacements: 1,
    extremeBrickRescueChance: 0.33,
    fullOpponentDeckProfile: true,
    notes: ['Slightly smooth openings toward a recursive unit or early board piece.'],
  },
  matchupPlans: {
    'red-dikai': {
      defenseBias: 0.7,
      defenderReserveBias: 1,
      notes: ['Reserve blockers and force red to spend attacks into recursive units.'],
    },
    'blue-adventurer': {
      attackBias: 0.4,
      closeGameBias: 0.5,
      notes: ['Pressure blue before its tempo engine finds repeated answers.'],
    },
    'white-temple': {
      effectBias: 0.4,
      developmentBias: 0.3,
      notes: ['Lean on recursion to overcome white board control.'],
    },
    'yellow-alchemy': {
      attackBias: 0.4,
      closeGameBias: 0.4,
      notes: ['Attack yellow setup turns before resource loops compound.'],
    },
  },
  weights: {
    unitPower: 1.25,
    unitDamage: 7.8,
    unitRush: 3.4,
    unitGodMark: 4,
    itemValue: 6.9,
    storyValue: 4.4,
    lowCost: 1.05,
    effectText: 1.2,
    attackBias: 1.2,
    defenseBias: 1.2,
    preserveHand: 1.2,
  },
  strategyHooks: {
    adjustTurnPlan: context => {
      const notes: string[] = [];
      let reserveDefendersDelta = 0;
      let minMainEffectScoreDelta = 0;
      let minBattleEffectScoreDelta = 0;
      let attackBeforeDeveloping: boolean | undefined;
      const boardOnline = context.plan.attackers >= 2 || context.plan.totalAvailableDamage >= 3;
      const pressureReady =
        boardOnline &&
        (
          context.plan.opponentErosion >= 5 ||
          context.opponentDeckProfile?.archetype === 'engine' ||
          context.opponentDeckProfile?.archetype === 'combo' ||
          context.opponentDeckProfile?.archetype === 'control'
        );

      if (context.opponentDeckProfile?.archetype === 'aggro') {
        reserveDefendersDelta += 1;
        notes.push('totem hook: trade recursive bodies into aggro pressure');
      }
      if (context.plan.attackers >= 2 && (context.opponentDeckProfile?.archetype === 'engine' || context.opponentDeckProfile?.archetype === 'combo')) {
        attackBeforeDeveloping = true;
        notes.push('totem hook: pressure setup decks once board is established');
      }
      if (pressureReady) {
        attackBeforeDeveloping = true;
        reserveDefendersDelta -= 1;
        minBattleEffectScoreDelta -= 0.5;
        notes.push('totem route: recursive board shifts from setup into pressure');
      }
      if (!pressureReady && context.plan.ownDeck <= 12) {
        minMainEffectScoreDelta -= 0.3;
        notes.push('totem route: low deck relies on recursion instead of raw payments');
      }
      return notes.length
        ? { attackBeforeDeveloping, reserveDefendersDelta, minMainEffectScoreDelta, minBattleEffectScoreDelta, notes }
        : undefined;
    },
    adjustPlayableScore: context => {
      const card = context.card;
      const text = cardText(card);
      let score = 0;
      if (hasAny(text, [/图腾|霸者|复生|复活|墓地|rebirth|revive|grave/i])) score += 4;
      if (card.type === 'UNIT' && openUnitSlots(context) > 0) score += 2;
      if (hasRole(card, 'engine') || hasRole(card, 'combo_piece')) score += 2.5;
      if (hasRole(card, 'removal') && (opponentHasTrait(context, 'large-defenders') || opponentHasTrait(context, 'engine-density'))) score += 3;
      if (card.type === 'UNIT' && opponentErosion(context) >= 5) score += (card.damage || 0) * 1.2;
      if ((context.player?.deck.length || 0) <= 12 && (hasRole(card, 'draw') || hasRole(card, 'search'))) score -= 4;
      return score;
    },
    adjustAttackScore: context => {
      const damage = context.card.damage || 0;
      let score = damage;
      const text = cardText(context.card);
      if (hasAny(text, [/复生|复活|图腾|rebirth|revive|totem/i])) score += damage * 1.2;
      if (readyDefenders(context) >= 2 || opponentIs(context, 'engine', 'combo', 'control')) score += damage * 1.4;
      if (opponentIs(context, 'aggro') && readyDefenders(context) <= 1) score -= damage * 1.4;
      return score;
    },
    adjustDefenseScore: context => {
      const text = cardText(context.card);
      let score = 0;
      if (hasAny(text, [/复生|复活|墓地|rebirth|revive|grave/i])) score += 5;
      if (opponentIs(context, 'aggro') || opponentHasTrait(context, 'burst-damage')) score += 8;
      if (hasRole(context.card, 'engine') && !opponentHasTrait(context, 'burst-damage')) score -= 4;
      return score;
    },
    adjustMulliganScore: context => {
      const card = context.card;
      const text = cardText(card);
      let score = 0;
      if (card.type === 'UNIT') score += 6;
      if (hasAny(text, [/图腾|霸者|复生|复活|墓地|rebirth|revive|grave/i])) score += 8;
      if (hasRole(card, 'engine') || hasRole(card, 'combo_piece')) score += 5;
      if (opponentIs(context, 'aggro') && card.type !== 'UNIT') score -= 5;
      return score;
    },
    adjustEffectScore: context => {
      let score = 0;
      if (effectHasTag(context, 'revive') || effectHasTag(context, 'summon')) score += openUnitSlots(context) > 0 ? 6 : -4;
      if (effectHasTag(context, 'buff') || effectHasTag(context, 'combat')) score += readyDefenders(context) >= 1 ? 2 : 0;
      if (effectHasTag(context, 'removal') && (opponentHasTrait(context, 'large-defenders') || opponentIs(context, 'engine', 'combo'))) score += 3;
      if ((effectHasTag(context, 'buff') || effectHasTag(context, 'combat')) && (opponentErosion(context) >= 6 || readyAttackers(context) >= 2)) score += 3;
      if ((effectHasTag(context, 'revive') || effectHasTag(context, 'summon')) && ownErosion(context) >= 6) score += 2;
      return score;
    },
  },
};
