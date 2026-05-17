import {
  buildTurnPlan,
  chooseDefender,
  choosePlayableCard,
  chooseQuerySelections,
  scoreActivatableEffect,
  scorePlayableCard,
  scorePaymentSacrificeValue,
  scorePaymentExhaustValue,
} from '../server/ai/hardStrategy';
import { getDeckAiProfile } from '../server/ai/deckProfiles';
import { scoreEffectTimingWindow } from '../server/ai/effectTimingKnowledge';
import { getComboAllianceAttack, KNOWN_COMBO_CARD_IDS } from '../server/ai/comboKnowledge';
import { ServerGameService } from '../server/ServerGameService';

type ScenarioResult = {
  name: string;
  passed: boolean;
  detail: string;
};

type ScenarioRun = () => ScenarioResult | Promise<ScenarioResult>;

let seq = 0;

function unit(overrides: Record<string, any> = {}) {
  seq += 1;
  const id = overrides.id || `TEST_UNIT_${seq}`;
  return {
    id,
    uniqueId: overrides.uniqueId || `${id}:N`,
    gamecardId: overrides.gamecardId || `${id}_${seq}`,
    fullName: overrides.fullName || id,
    type: 'UNIT',
    color: overrides.color || 'WHITE',
    cardlocation: 'UNIT',
    power: overrides.power ?? 1000,
    basePower: overrides.basePower ?? overrides.power ?? 1000,
    damage: overrides.damage ?? 1,
    baseDamage: overrides.baseDamage ?? overrides.damage ?? 1,
    acValue: overrides.acValue ?? 1,
    baseAcValue: overrides.baseAcValue ?? overrides.acValue ?? 1,
    canAttack: overrides.canAttack ?? true,
    isExhausted: overrides.isExhausted ?? false,
    playedTurn: overrides.playedTurn ?? 1,
    godMark: !!overrides.godMark,
    effects: overrides.effects || [],
    ...overrides,
  };
}

function story(overrides: Record<string, any> = {}) {
  seq += 1;
  const id = overrides.id || `TEST_STORY_${seq}`;
  return {
    id,
    uniqueId: overrides.uniqueId || `${id}:N`,
    gamecardId: overrides.gamecardId || `${id}_${seq}`,
    fullName: overrides.fullName || id,
    type: 'STORY',
    color: overrides.color || 'WHITE',
    cardlocation: overrides.cardlocation || 'HAND',
    acValue: overrides.acValue ?? 1,
    baseAcValue: overrides.baseAcValue ?? overrides.acValue ?? 1,
    effects: overrides.effects || [],
    ...overrides,
  };
}

function effect(overrides: Record<string, any> = {}) {
  seq += 1;
  return {
    id: overrides.id || `TEST_EFFECT_${seq}`,
    type: overrides.type || 'ACTIVATE',
    description: overrides.description || '',
    content: overrides.content || '',
    ...overrides,
  };
}

function deckCards(count: number, prefix: string) {
  return Array.from({ length: count }, (_, index) => story({
    id: `${prefix}_${index}`,
    gamecardId: `${prefix}_${index}`,
    cardlocation: 'DECK',
  }));
}

function erosionCards(count: number, prefix: string) {
  return deckCards(count, prefix).map(card => ({ ...card, cardlocation: 'EROSION_BACK' }));
}

function player(uid: string, overrides: Record<string, any> = {}) {
  return {
    uid,
    displayName: uid,
    deck: overrides.deck || deckCards(20, `${uid}_D`),
    hand: overrides.hand || [],
    grave: overrides.grave || [],
    exile: overrides.exile || [],
    unitZone: overrides.unitZone || [null, null, null, null, null, null],
    itemZone: overrides.itemZone || [],
    erosionFront: overrides.erosionFront || [],
    erosionBack: overrides.erosionBack || [],
    playZone: overrides.playZone || [],
    isTurn: overrides.isTurn ?? uid === 'BOT',
    isFirst: false,
    mulliganDone: true,
    hasExhaustedThisTurn: [],
    timeRemaining: 0,
    ...overrides,
  };
}

function game(botOverrides: Record<string, any> = {}, opponentOverrides: Record<string, any> = {}, stateOverrides: Record<string, any> = {}) {
  const bot = player('BOT', botOverrides);
  const opponent = player('P1', { isTurn: false, ...opponentOverrides });
  return {
    gameId: 'hard_ai_scenario',
    phase: stateOverrides.phase || 'MAIN',
    currentTurnPlayer: 0,
    turnCount: stateOverrides.turnCount ?? 5,
    playerIds: ['BOT', 'P1'],
    players: {
      BOT: bot,
      P1: opponent,
    },
    counterStack: [],
    passCount: 0,
    gameStatus: 1,
    logs: [],
    triggeredEffectsQueue: [],
    pendingResolutions: [],
    ...stateOverrides,
  } as any;
}

function assertScenario(name: string, condition: boolean, detail: string): ScenarioResult {
  return { name, passed: condition, detail };
}

function testLethalTurnPlan(): ScenarioResult {
  const profile = getDeckAiProfile('white-temple');
  const attackerA = unit({ damage: 2, power: 2000, playedTurn: 1 });
  const attackerB = unit({ damage: 1, power: 1000, playedTurn: 1 });
  const state = game(
    { unitZone: [attackerA, attackerB, null, null, null, null] },
    { deck: deckCards(2, 'P1_LOW'), erosionFront: [], erosionBack: [] }
  );
  const plan = buildTurnPlan(state, state.players.BOT, profile);
  return assertScenario(
    'lethal turn plan attacks before developing',
    plan.mode === 'lethal' && plan.attackBeforeDeveloping && plan.reserveDefenders === 0,
    `mode=${plan.mode}, attackBeforeDeveloping=${plan.attackBeforeDeveloping}, reserve=${plan.reserveDefenders}`
  );
}

function testSmileEclipseCombo(): ScenarioResult {
  const profile = getDeckAiProfile('white-temple');
  const smile = unit({
    id: KNOWN_COMBO_CARD_IDS.smileKoriel,
    uniqueId: `${KNOWN_COMBO_CARD_IDS.smileKoriel}:N`,
    fullName: 'Smile Koriel',
    damage: 1,
    color: 'WHITE',
    playedTurn: 1,
    godMark: true,
  });
  const partner = unit({
    id: 'WHITE_PARTNER',
    fullName: 'White Partner',
    damage: 2,
    power: 2500,
    color: 'WHITE',
    playedTurn: 1,
  });
  const eclipse = story({
    id: KNOWN_COMBO_CARD_IDS.eclipse,
    uniqueId: `${KNOWN_COMBO_CARD_IDS.eclipse}:N`,
    fullName: 'Eclipse',
    effects: [{ id: KNOWN_COMBO_CARD_IDS.eclipseEffect, type: 'ACTIVATE', description: 'combo board wipe' }],
  });
  const state = game(
    {
      hand: [eclipse],
      unitZone: [smile, partner, null, null, null, null],
      erosionBack: deckCards(3, 'BOT_BACK').map(card => ({ ...card, cardlocation: 'EROSION_BACK' })),
    },
    {},
    { phase: 'BATTLE_DECLARATION' }
  );
  const plan = getComboAllianceAttack(state, state.players.BOT, profile, [smile, partner] as any);
  return assertScenario(
    'smile alliance eclipse chooses protected alliance attack',
    !!plan && plan.attackers.some(card => card.id === KNOWN_COMBO_CARD_IDS.smileKoriel),
    plan ? `attackers=${plan.attackers.map(card => card.id).join(',')}` : 'no combo alliance plan'
  );
}

function testProtectHighValueFromSelfDestroy(): ScenarioResult {
  const profile = getDeckAiProfile('white-temple');
  const god = unit({ id: 'GOD_VALUE', fullName: 'God Value', godMark: true, power: 5000, damage: 2 });
  const low = unit({ id: 'LOW_VALUE', fullName: 'Low Value', power: 500, damage: 0 });
  const state = game({ unitZone: [god, low, null, null, null, null] });
  const query = {
    id: 'destroy_own',
    type: 'SELECT_CARD',
    playerUid: 'BOT',
    title: 'destroy unit',
    description: 'destroy selected unit',
    callbackKey: 'DUMMY_DESTROY_UNIT',
    minSelections: 1,
    maxSelections: 1,
    context: { effectId: 'dummy_destroy', step: 'DESTROY_UNIT' },
    options: [
      { card: god, isMine: true },
      { card: low, isMine: true },
    ],
  };
  const selected = chooseQuerySelections(state, 'BOT', query as any, profile, 'hard');
  return assertScenario(
    'self destructive query preserves god/high value unit',
    selected[0] === low.gamecardId,
    `selected=${selected.join(',') || 'none'}`
  );
}

function testOnlyHighValueSelfDestroyAborts(): ScenarioResult {
  const profile = getDeckAiProfile('white-temple');
  const god = unit({ id: 'ONLY_GOD_VALUE', fullName: 'Only God Value', godMark: true, power: 5000, damage: 2 });
  const state = game({ unitZone: [god, null, null, null, null, null] });
  const query = {
    id: 'destroy_only_god',
    type: 'SELECT_CARD',
    playerUid: 'BOT',
    title: 'destroy unit',
    description: 'destroy selected unit',
    callbackKey: 'DUMMY_DESTROY_UNIT',
    minSelections: 1,
    maxSelections: 1,
    context: { effectId: 'dummy_destroy', step: 'DESTROY_UNIT' },
    options: [{ card: god, isMine: true }],
  };
  const selected = chooseQuerySelections(state, 'BOT', query as any, profile, 'hard');
  return assertScenario(
    'only high value self destruction aborts instead of sacrificing key unit',
    selected.length === 0,
    `selected=${selected.join(',') || 'none'}`
  );
}

function testElementInstructorAvoidsDestroyMode(): ScenarioResult {
  const profile = getDeckAiProfile('yellow-alchemy');
  const ownWeak = unit({ id: 'OWN_WEAK', power: 1000, damage: 1 });
  const state = game({ unitZone: [ownWeak, null, null, null, null, null] });
  const query = {
    id: 'element_mode',
    type: 'SELECT_CHOICE',
    playerUid: 'BOT',
    title: 'choose mode',
    description: 'choose effect mode',
    callbackKey: 'DECLARE_EFFECT_TARGET_MODE',
    minSelections: 1,
    maxSelections: 1,
    context: { effectId: '105110112_activate', step: 'CHOOSE_MODE' },
    options: [
      { id: 'DRAW', label: 'DRAW' },
      { id: 'DAMAGE', label: 'DAMAGE' },
      { id: 'DESTROY', label: 'DESTROY' },
    ],
  };
  const selected = chooseQuerySelections(state, 'BOT', query as any, profile, 'hard');
  return assertScenario(
    'element instructor avoids destroy mode when only own weak unit exists',
    selected[0] !== 'DESTROY',
    `selected=${selected.join(',') || 'none'}`
  );
}

function testEffectTimingWindows(): ScenarioResult {
  const card = unit({ id: 'TIMING_SOURCE', effects: [] });
  const drawEffect = { id: 'draw_test', type: 'ACTIVATE', description: 'draw 1 card search deck', content: 'DRAW_CARD SEARCH_DECK' };
  const combatEffect = { id: 'combat_test', type: 'ACTIVATE', description: 'add power during battle and prevent destroy', content: 'ADD_POWER PREVENT COMBAT' };
  const mainState = game({ unitZone: [card, null, null, null, null, null] }, {}, { phase: 'MAIN' });
  const battleState = game(
    { unitZone: [card, null, null, null, null, null] },
    {},
    { phase: 'BATTLE_FREE', battleState: { attackers: [card.gamecardId] } }
  );
  const drawMain = scoreEffectTimingWindow(mainState, mainState.players.BOT, card as any, drawEffect as any).score;
  const drawBattle = scoreEffectTimingWindow(battleState, battleState.players.BOT, card as any, drawEffect as any).score;
  const combatBattle = scoreEffectTimingWindow(battleState, battleState.players.BOT, card as any, combatEffect as any).score;
  return assertScenario(
    'effect timing prefers setup in main and combat in battle',
    drawMain > 0 && drawBattle < 0 && combatBattle > 0 && combatBattle > drawBattle,
    `drawMain=${drawMain}, drawBattle=${drawBattle}, combatBattle=${combatBattle}`
  );
}

function testBattleFreeHoldsSetupStory(): ScenarioResult {
  const profile = getDeckAiProfile('blue-adventurer');
  const attacker = unit({ id: 'BATTLE_ATTACKER', damage: 1, playedTurn: 1 });
  const setupStory = story({
    id: 'SETUP_STORY',
    fullName: 'Setup Story',
    effects: [{
      id: 'setup_story_draw',
      type: 'ACTIVATE',
      description: 'draw 1 card and search the deck',
      content: 'DRAW_CARD SEARCH_DECK',
    }],
  });
  const state = game(
    { hand: [setupStory], unitZone: [attacker, null, null, null, null, null] },
    {},
    { phase: 'BATTLE_FREE', battleState: { attackers: [attacker.gamecardId] } }
  );
  const score = scorePlayableCard(state, state.players.BOT, setupStory as any, profile);
  return assertScenario(
    'battle free holds setup/draw story without combo purpose',
    score < 0,
    `score=${score.toFixed(1)}`
  );
}

function testMainRemovalStoryNeedsTarget(): ScenarioResult {
  const profile = getDeckAiProfile('red-dikai');
  const removalStory = story({
    id: 'TARGETLESS_REMOVAL_STORY',
    fullName: 'Targetless Removal Story',
    effects: [{
      id: 'targetless_destroy',
      type: 'ACTIVATE',
      description: 'destroy target opponent unit',
      content: 'DESTROY_UNIT',
      targetSpec: {
        title: 'choose opponent unit',
        description: 'destroy target opponent unit',
        minSelections: 1,
        maxSelections: 1,
        zones: ['UNIT'],
        controller: 'OPPONENT',
        getCandidates: (gameState: any, playerState: any) =>
          gameState.players[gameState.playerIds.find((uid: string) => uid !== playerState.uid)].unitZone
            .filter(Boolean)
            .map((card: any) => ({ card, source: 'UNIT' })),
      },
    }],
  });
  const state = game({ hand: [removalStory] }, { unitZone: [null, null, null, null, null, null] }, { phase: 'MAIN' });
  const score = scorePlayableCard(state, state.players.BOT, removalStory as any, profile);
  return assertScenario(
    'main removal story is held when there is no opposing target',
    score < 0,
    `score=${score.toFixed(1)}`
  );
}

function testBattleCombatStoryBeatsSetupStory(): ScenarioResult {
  const profile = getDeckAiProfile('white-temple');
  const attacker = unit({ id: 'COMBAT_ATTACKER', damage: 2, playedTurn: 1 });
  const combatStory = story({
    id: 'COMBAT_STORY',
    fullName: 'Combat Story',
    effects: [{
      id: 'combat_story_boost',
      type: 'ACTIVATE',
      description: 'during battle add power prevent destroy and add damage',
      content: 'COMBAT ADD_POWER PREVENT ADD_DAMAGE',
    }],
  });
  const setupStory = story({
    id: 'BATTLE_SETUP_STORY',
    fullName: 'Battle Setup Story',
    effects: [{
      id: 'battle_setup_draw',
      type: 'ACTIVATE',
      description: 'draw and search deck',
      content: 'DRAW_CARD SEARCH_DECK',
    }],
  });
  const state = game(
    {
      hand: [combatStory, setupStory],
      unitZone: [attacker, null, null, null, null, null],
    },
    {},
    { phase: 'BATTLE_FREE', battleState: { attackers: [attacker.gamecardId] } }
  );
  const combatScore = scorePlayableCard(state, state.players.BOT, combatStory as any, profile);
  const setupScore = scorePlayableCard(state, state.players.BOT, setupStory as any, profile);
  return assertScenario(
    'battle story discipline prefers combat trick over setup story',
    combatScore > 0 && combatScore > setupScore + 40,
    `combat=${combatScore.toFixed(1)}, setup=${setupScore.toFixed(1)}`
  );
}

function testEclipseWaitsForProtectedAllianceWindow(): ScenarioResult {
  const profile = getDeckAiProfile('white-temple');
  const smile = unit({
    id: KNOWN_COMBO_CARD_IDS.smileKoriel,
    uniqueId: `${KNOWN_COMBO_CARD_IDS.smileKoriel}:N`,
    fullName: 'Smile Koriel',
    damage: 1,
    color: 'WHITE',
    playedTurn: 1,
    godMark: true,
  });
  const partner = unit({ id: 'ECLIPSE_PARTNER', fullName: 'White Partner', damage: 2, color: 'WHITE', playedTurn: 1 });
  const eclipseEffect = effect({
    id: KNOWN_COMBO_CARD_IDS.eclipseEffect,
    description: 'combo board wipe destroy all opponent units',
    content: 'DESTROY_CARD COMBO',
  });
  const eclipse = story({
    id: KNOWN_COMBO_CARD_IDS.eclipse,
    uniqueId: `${KNOWN_COMBO_CARD_IDS.eclipse}:N`,
    fullName: 'Eclipse',
    effects: [eclipseEffect],
  });
  const opponentA = unit({ id: 'ECLIPSE_TARGET_A', power: 2500, damage: 2 });
  const opponentB = unit({ id: 'ECLIPSE_TARGET_B', power: 1500, damage: 1 });
  const mainState = game(
    {
      hand: [eclipse],
      unitZone: [smile, partner, null, null, null, null],
      erosionBack: erosionCards(3, 'BOT_ECLIPSE_MAIN'),
    },
    { unitZone: [opponentA, opponentB, null, null, null, null] },
    { phase: 'MAIN' }
  );
  const battleState = game(
    {
      hand: [eclipse],
      unitZone: [smile, partner, null, null, null, null],
      erosionBack: erosionCards(3, 'BOT_ECLIPSE_BATTLE'),
    },
    { unitZone: [opponentA, opponentB, null, null, null, null] },
    {
      phase: 'BATTLE_FREE',
      battleState: { isAlliance: true, attackers: [smile.gamecardId, partner.gamecardId] },
    }
  );
  const mainPlayable = scorePlayableCard(mainState, mainState.players.BOT, eclipse as any, profile);
  const battleEffect = scoreActivatableEffect(
    battleState,
    battleState.players.BOT,
    eclipse as any,
    eclipseEffect as any,
    profile,
    { opponent: battleState.players.P1, targetCount: 2, hasTargetSpec: false }
  ).score;
  return assertScenario(
    'eclipse waits for protected smile alliance window',
    mainPlayable < 0 && battleEffect > 80 && battleEffect > mainPlayable + 100,
    `mainPlayable=${mainPlayable.toFixed(1)}, battleEffect=${battleEffect.toFixed(1)}`
  );
}

function testBlueCounterStoryRequiresCounterWindow(): ScenarioResult {
  const profile = getDeckAiProfile('blue-adventurer');
  const counterEffect = effect({
    id: '204000145_counter_silence',
    description: 'counter target effect and silence it',
    content: 'COUNTER_EFFECT SILENCE',
  });
  const counterStory = story({
    id: '204000145',
    fullName: 'Counter Silence Story',
    color: 'BLUE',
    effects: [counterEffect],
  });
  const mainState = game({ hand: [counterStory] }, {}, { phase: 'MAIN' });
  const counterState = game({ hand: [counterStory] }, {}, { phase: 'COUNTERING', currentTurnPlayer: 1 });
  const mainScore = scorePlayableCard(mainState, mainState.players.BOT, counterStory as any, profile);
  const counterScore = scoreActivatableEffect(
    counterState,
    counterState.players.BOT,
    counterStory as any,
    counterEffect as any,
    profile,
    { opponent: counterState.players.P1, targetCount: 1, hasTargetSpec: true }
  ).score;
  return assertScenario(
    'blue counter story is held outside counter window',
    mainScore < 0 && counterScore > 20 && counterScore > mainScore + 40,
    `main=${mainScore.toFixed(1)}, counter=${counterScore.toFixed(1)}`
  );
}

async function testHardAiUsesConfrontationStory(): Promise<ScenarioResult> {
  const counterEffect = effect({
    id: '204000145_counter_silence',
    description: 'counter target effect and silence it',
    content: 'COUNTER_EFFECT SILENCE',
  });
  const counterStory = story({
    id: '204000145',
    fullName: 'Counter Silence Story',
    color: 'BLUE',
    acValue: 0,
    baseAcValue: 0,
    effects: [counterEffect],
  });
  const opponentSource = story({
    id: 'P1_STACK_STORY',
    gamecardId: 'P1_STACK_STORY',
    fullName: 'Opponent Stack Story',
    cardlocation: 'PLAY',
    effects: [effect({ id: 'p1_stack_effect', type: 'ACTIVATE', description: 'opponent stack effect' })],
  });
  const state = game(
    { isTurn: false, hand: [counterStory], botDifficulty: 'hard', botDeckProfileId: 'blue-adventurer' },
    { isTurn: true, playZone: [opponentSource] },
    {
      phase: 'COUNTERING',
      previousPhase: 'MAIN',
      currentTurnPlayer: 1,
      priorityPlayerId: 'BOT',
      botDifficulty: 'hard',
      counterStack: [{ card: opponentSource, ownerUid: 'P1', type: 'PLAY', timestamp: Date.now() }],
    }
  );

  const used = await ServerGameService.tryUseBotConfrontationAction(state, 'BOT', 18);
  const action = state.aiDecisionLogs?.at(-1)?.action;
  return assertScenario(
    'hard AI uses high-value story in confrontation',
    used && action === 'PLAY_CONFRONTATION_STORY' && state.phase === 'COUNTERING' && state.priorityPlayerId === 'P1' && state.counterStack.length === 2,
    `used=${used}, action=${action}, priority=${state.priorityPlayerId}, stack=${state.counterStack.length}`
  );
}

async function testHardAiPassesLowValueConfrontationStory(): Promise<ScenarioResult> {
  const setupStory = story({
    id: 'LOW_VALUE_SETUP_STORY',
    fullName: 'Low Value Setup Story',
    acValue: 0,
    baseAcValue: 0,
    effects: [effect({
      id: 'low_value_setup_draw',
      type: 'ACTIVATE',
      description: 'draw 1 card and search deck for setup',
      content: 'DRAW_CARD SEARCH_DECK RESOURCE SETUP',
    })],
  });
  const state = game(
    { isTurn: false, hand: [setupStory], botDifficulty: 'hard', botDeckProfileId: 'blue-adventurer' },
    { isTurn: true },
    {
      phase: 'COUNTERING',
      previousPhase: 'MAIN',
      currentTurnPlayer: 1,
      priorityPlayerId: 'BOT',
      botDifficulty: 'hard',
      counterStack: [{ type: 'PHASE_END', ownerUid: 'P1', timestamp: Date.now() }],
    }
  );

  const hasAction = ServerGameService.playerHasAvailableConfrontationAction(state, 'BOT');
  const candidateScore = ServerGameService.getBotStoryPlayCandidates(state, 'BOT')[0]?.score ?? -999;
  const used = await ServerGameService.tryUseBotConfrontationAction(state, 'BOT', 18);
  await ServerGameService.botMoveForPlayer(state, 'BOT');

  return assertScenario(
    'hard AI passes low-value confrontation story without stalling',
    hasAction && !used && candidateScore < 18 && state.phase === 'MAIN' && state.counterStack.length === 0,
    `hasAction=${hasAction}, used=${used}, score=${candidateScore.toFixed(1)}, phase=${state.phase}, stack=${state.counterStack.length}`
  );
}

async function testHardAiChoosesConfrontationFieldEffect(): Promise<ScenarioResult> {
  const tempoEffect = effect({
    id: 'counter_tempo_field_effect',
    type: 'ACTIVATE',
    description: 'countering silence target opponent unit and prevent damage',
    content: 'COUNTER SILENCE PREVENT DAMAGE',
    targetSpec: {
      title: 'choose opponent unit',
      description: 'choose opponent unit',
      minSelections: 1,
      maxSelections: 1,
      zones: ['UNIT'],
      controller: 'OPPONENT',
    },
  });
  const source = unit({
    id: 'COUNTER_FIELD_SOURCE',
    fullName: 'Counter Field Source',
    color: 'BLUE',
    effects: [tempoEffect],
  });
  const target = unit({ id: 'COUNTER_FIELD_TARGET', power: 3500, damage: 2 });
  const state = game(
    { isTurn: false, unitZone: [source, null, null, null, null, null], botDifficulty: 'hard', botDeckProfileId: 'blue-adventurer' },
    { isTurn: true, unitZone: [target, null, null, null, null, null] },
    {
      phase: 'COUNTERING',
      previousPhase: 'BATTLE_FREE',
      currentTurnPlayer: 1,
      priorityPlayerId: 'BOT',
      botDifficulty: 'hard',
      battleState: { attackers: [target.gamecardId] },
      counterStack: [{ type: 'ATTACK', ownerUid: 'P1', timestamp: Date.now(), card: target }],
    }
  );

  const candidates = ServerGameService.getBotActivatableEffectCandidates(state, 'BOT');
  const used = await ServerGameService.tryUseBotConfrontationAction(state, 'BOT', 18);
  return assertScenario(
    'hard AI chooses useful field effect in confrontation',
    candidates.length > 0 && candidates[0].effect.id === tempoEffect.id && candidates[0].score >= 18 && used && state.pendingQuery?.context?.sourceCardId === source.gamecardId,
    `candidates=${candidates.length}, top=${candidates[0]?.effect.id}, score=${(candidates[0]?.score ?? 0).toFixed(1)}, used=${used}, query=${state.pendingQuery?.callbackKey}`
  );
}

function testPreventDestroyWaitsForThreatWindow(): ScenarioResult {
  const profile = getDeckAiProfile('white-temple');
  const defender = unit({ id: 'PROTECTED_UNIT', damage: 2, power: 3000, playedTurn: 1 });
  const attacker = unit({ id: 'THREAT_ATTACKER', damage: 2, power: 3500 });
  const preventEffect = effect({
    id: '201000059_prevent_destroy',
    description: 'prevent destroy and protect unit during battle',
    content: 'PREVENT_DESTROY PROTECT COMBAT',
  });
  const preventStory = story({ id: '201000059', fullName: 'Prevent Destroy Story', effects: [preventEffect] });
  const mainState = game({ hand: [preventStory], unitZone: [defender, null, null, null, null, null] }, {}, { phase: 'MAIN' });
  const battleState = game(
    { hand: [preventStory], unitZone: [defender, null, null, null, null, null] },
    { unitZone: [attacker, null, null, null, null, null] },
    { phase: 'BATTLE_FREE', battleState: { attackers: [defender.gamecardId] } }
  );
  const mainScore = scoreActivatableEffect(
    mainState,
    mainState.players.BOT,
    preventStory as any,
    preventEffect as any,
    profile,
    { opponent: mainState.players.P1, targetCount: 1, hasTargetSpec: true }
  ).score;
  const battleScore = scoreActivatableEffect(
    battleState,
    battleState.players.BOT,
    preventStory as any,
    preventEffect as any,
    profile,
    { opponent: battleState.players.P1, targetCount: 1, hasTargetSpec: true }
  ).score;
  return assertScenario(
    'prevent-destroy story waits for real threat window',
    mainScore < 0 && battleScore > 20 && battleScore > mainScore + 35,
    `main=${mainScore.toFixed(1)}, battle=${battleScore.toFixed(1)}`
  );
}

function testRedCannotDefendNeedsTargetInClosingWindow(): ScenarioResult {
  const profile = getDeckAiProfile('red-dikai');
  const source = unit({ id: '102050427', color: 'RED', damage: 2, power: 2500, playedTurn: 1 });
  const helper = unit({ id: 'RED_HELPER_ATTACKER', color: 'RED', damage: 1, power: 1500, playedTurn: 1 });
  const blocker = unit({ id: 'TARGET_BLOCKER', power: 4000, damage: 1 });
  const cannotDefend = effect({
    id: '102050427_cannot_defend',
    description: 'target opponent unit cannot defend this turn',
    content: 'CANNOT_DEFEND FINISHER',
    targetSpec: { controller: 'OPPONENT', zones: ['UNIT'], minSelections: 1, maxSelections: 1 },
  });
  const targetState = game(
    { unitZone: [source, helper, null, null, null, null] },
    { unitZone: [blocker, null, null, null, null, null], erosionBack: erosionCards(7, 'P1_RED_CLOSE') },
    { phase: 'BATTLE_DECLARATION' }
  );
  const noTargetState = game(
    { unitZone: [source, helper, null, null, null, null] },
    { unitZone: [null, null, null, null, null, null], erosionBack: erosionCards(7, 'P1_RED_CLOSE_EMPTY') },
    { phase: 'BATTLE_DECLARATION' }
  );
  const targetScore = scoreActivatableEffect(
    targetState,
    targetState.players.BOT,
    source as any,
    cannotDefend as any,
    profile,
    { opponent: targetState.players.P1, targetCount: 1, hasTargetSpec: true }
  ).score;
  const noTargetScore = scoreActivatableEffect(
    noTargetState,
    noTargetState.players.BOT,
    source as any,
    cannotDefend as any,
    profile,
    { opponent: noTargetState.players.P1, targetCount: 0, hasTargetSpec: true }
  ).score;
  return assertScenario(
    'red cannot-defend effect needs a target and rewards closing window',
    targetScore > 20 && noTargetScore < 0 && targetScore > noTargetScore + 35,
    `target=${targetScore.toFixed(1)}, noTarget=${noTargetScore.toFixed(1)}`
  );
}

function testYellowReviveMainPhaseNotBattleSetup(): ScenarioResult {
  const profile = getDeckAiProfile('yellow-alchemy');
  const attacker = unit({ id: 'YELLOW_ATTACKER_FOR_REVIVE', color: 'YELLOW', damage: 1, playedTurn: 1 });
  const reviveTarget = unit({ id: 'YELLOW_REVIVE_TARGET', color: 'YELLOW', damage: 2, cardlocation: 'GRAVE' });
  const reviveEffect = effect({
    id: '305110028_revive',
    description: 'revive unit from graveyard to field',
    content: 'REVIVE SUMMON GRAVE_TO_FIELD',
    targetSpec: { controller: 'SELF', zones: ['GRAVE'], minSelections: 1, maxSelections: 1 },
  });
  const memoryDoll = story({ id: '305110028', fullName: 'Memory Doll', type: 'ITEM', effects: [reviveEffect] });
  const mainState = game(
    { hand: [memoryDoll], grave: [reviveTarget], unitZone: [null, null, null, null, null, null] },
    {},
    { phase: 'MAIN' }
  );
  const battleState = game(
    { hand: [memoryDoll], grave: [reviveTarget], unitZone: [attacker, null, null, null, null, null] },
    {},
    { phase: 'BATTLE_FREE', battleState: { attackers: [attacker.gamecardId] } }
  );
  const mainScore = scoreActivatableEffect(
    mainState,
    mainState.players.BOT,
    memoryDoll as any,
    reviveEffect as any,
    profile,
    { opponent: mainState.players.P1, targetCount: 1, hasTargetSpec: true }
  ).score;
  const battleScore = scoreActivatableEffect(
    battleState,
    battleState.players.BOT,
    memoryDoll as any,
    reviveEffect as any,
    profile,
    { opponent: battleState.players.P1, targetCount: 1, hasTargetSpec: true }
  ).score;
  return assertScenario(
    'yellow revive setup is main-phase memory, not battle free filler',
    mainScore > 20 && battleScore < mainScore - 30,
    `main=${mainScore.toFixed(1)}, battle=${battleScore.toFixed(1)}`
  );
}

function testTotemPrepareStoryMainNotBattleFiller(): ScenarioResult {
  const profile = getDeckAiProfile('overlord-totem');
  const attacker = unit({ id: 'TOTEM_ATTACKER_FOR_PREPARE', damage: 2, playedTurn: 1 });
  const prepareEffect = effect({
    id: '203080083_prepare',
    description: 'search deck for totem resource setup',
    content: 'SEARCH DECK_TO_HAND RESOURCE SETUP',
  });
  const prepareStory = story({ id: '203080083', fullName: 'Totem Prepare', effects: [prepareEffect] });
  const mainState = game({ hand: [prepareStory], unitZone: [null, null, null, null, null, null] }, {}, { phase: 'MAIN' });
  const battleState = game(
    { hand: [prepareStory], unitZone: [attacker, null, null, null, null, null] },
    {},
    { phase: 'BATTLE_FREE', battleState: { attackers: [attacker.gamecardId] } }
  );
  const mainScore = scorePlayableCard(mainState, mainState.players.BOT, prepareStory as any, profile);
  const battleScore = scorePlayableCard(battleState, battleState.players.BOT, prepareStory as any, profile);
  return assertScenario(
    'totem preparation story is main-phase setup, not battle filler',
    mainScore > 0 && battleScore < 0 && mainScore > battleScore + 40,
    `main=${mainScore.toFixed(1)}, battle=${battleScore.toFixed(1)}`
  );
}

function testWhiteTemplePrefersKeyResetTargets(): ScenarioResult {
  const profile = getDeckAiProfile('white-temple');
  const source = unit({ id: '101130439', fullName: 'Hall Knight Source', damage: 1, isExhausted: false });
  const other = unit({ id: '101130155', fullName: 'Other Temple Unit', damage: 1, isExhausted: true });
  const magicSpear = unit({ id: '101130440', fullName: 'Temple Knight Magic Spear', damage: 2, isExhausted: true });
  const heroSword = unit({ id: '101130458', fullName: 'Temple Knight Hero Sword', damage: 2, isExhausted: true });
  const state = game({
    unitZone: [source, other, magicSpear, heroSword, null, null],
  });
  const query = {
    id: 'white_temple_reset',
    type: 'SELECT_CARD',
    playerUid: 'BOT',
    title: 'choose reset unit',
    description: 'choose a Temple unit to reset',
    callbackKey: 'EFFECT_RESOLVE',
    minSelections: 1,
    maxSelections: 1,
    context: { sourceCardId: source.gamecardId, effectId: '101130439_reset_hall' },
    options: [
      { card: other, isMine: true },
      { card: magicSpear, isMine: true },
      { card: heroSword, isMine: true },
    ],
  };
  const selected = chooseQuerySelections(state, 'BOT', query as any, profile, 'hard');
  const selectedCard = [other, magicSpear, heroSword].find(card => card.gamecardId === selected[0]);
  return assertScenario(
    'white temple reset prefers magic spear or hero sword',
    selectedCard?.id === '101130440' || selectedCard?.id === '101130458',
    `selected=${selectedCard?.fullName || selected.join(',') || 'none'}`
  );
}

function testWhiteTempleMultiResetTakesBothKeyTargets(): ScenarioResult {
  const profile = getDeckAiProfile('white-temple');
  const other = unit({ id: '101130155', fullName: 'Other Temple Unit', damage: 1, isExhausted: true });
  const magicSpear = unit({ id: '101130440', fullName: 'Temple Knight Magic Spear', damage: 2, isExhausted: true });
  const heroSword = unit({ id: '101130458', fullName: 'Temple Knight Hero Sword', damage: 2, isExhausted: true });
  const state = game({
    unitZone: [other, magicSpear, heroSword, null, null, null],
  });
  const query = {
    id: 'white_temple_multi_reset',
    type: 'SELECT_CARD',
    playerUid: 'BOT',
    title: 'choose reset units',
    description: 'choose two non-god units to reset',
    callbackKey: 'EFFECT_RESOLVE',
    minSelections: 2,
    maxSelections: 2,
    context: { effectId: '101000063_ten_reset_units' },
    options: [
      { card: other, isMine: true },
      { card: magicSpear, isMine: true },
      { card: heroSword, isMine: true },
    ],
  };
  const selected = chooseQuerySelections(state, 'BOT', query as any, profile, 'hard');
  const selectedIds = selected
    .map(id => [other, magicSpear, heroSword].find(card => card.gamecardId === id)?.id)
    .filter(Boolean);
  return assertScenario(
    'white temple multi reset chooses magic spear and hero sword first',
    selectedIds.includes('101130440') && selectedIds.includes('101130458'),
    `selected=${selectedIds.join(',') || 'none'}`
  );
}

function testWhiteTemplePlaysArcherBeforeHandTargets(): ScenarioResult {
  const profile = getDeckAiProfile('white-temple');
  const archer = unit({
    id: '101130202',
    fullName: '南征军的弓兵',
    faction: '圣王国',
    acValue: 3,
    baseAcValue: 3,
    damage: 2,
    cardlocation: 'HAND',
  });
  const rookie = unit({
    id: '101130233',
    fullName: '坚定的新人卫士',
    faction: '圣王国',
    acValue: 3,
    baseAcValue: 3,
    damage: 1,
    feijingMark: true,
    cardlocation: 'HAND',
  });
  const shield = unit({
    id: '101130200',
    fullName: '圣王国的盾兵',
    faction: '圣王国',
    acValue: 2,
    baseAcValue: 2,
    damage: 1,
    cardlocation: 'HAND',
  });
  const state = game({ hand: [rookie, shield, archer], unitZone: [null, null, null, null, null, null] });
  const chosen = choosePlayableCard(state, state.players.BOT, profile, 'hard', () => true);
  const archerScore = scorePlayableCard(state, state.players.BOT, archer as any, profile);
  const rookieScore = scorePlayableCard(state, state.players.BOT, rookie as any, profile);
  return assertScenario(
    'white temple plays archer before its hand-to-field targets',
    chosen?.id === '101130202' && archerScore > rookieScore + 25,
    `chosen=${chosen?.fullName || 'none'}, archer=${archerScore.toFixed(1)}, rookie=${rookieScore.toFixed(1)}`
  );
}

function testWhiteTempleOptionalArcherTriggerSelectsTarget(): ScenarioResult {
  const profile = getDeckAiProfile('white-temple');
  const archer = unit({
    id: '101130202',
    fullName: '南征军的弓兵',
    faction: '圣王国',
    cardlocation: 'UNIT',
  });
  const rookie = unit({
    id: '101130233',
    fullName: '坚定的新人卫士',
    faction: '圣王国',
    acValue: 3,
    baseAcValue: 3,
    damage: 1,
    cardlocation: 'HAND',
  });
  const magicSpear = unit({
    id: '101130440',
    fullName: '殿堂骑士·魔枪',
    faction: '圣王国',
    acValue: 2,
    baseAcValue: 2,
    damage: 2,
    cardlocation: 'HAND',
  });
  const state = game({
    hand: [rookie, magicSpear],
    unitZone: [archer, null, null, null, null, null],
  });
  const query = {
    id: 'white_archer_hand_to_field',
    type: 'SELECT_CARD',
    playerUid: 'BOT',
    title: '选择放置到战场的单位',
    description: '选择你的手牌中的1张AC+3以下<圣王国>非神蚀单位卡，将其放置到战场。',
    callbackKey: 'EFFECT_RESOLVE',
    minSelections: 0,
    maxSelections: 1,
    context: { sourceCardId: archer.gamecardId, effectId: '101130202_hand_to_field' },
    options: [
      { card: rookie, isMine: true },
      { card: magicSpear, isMine: true },
    ],
  };
  const selected = chooseQuerySelections(state, 'BOT', query as any, profile, 'hard');
  const selectedCard = [rookie, magicSpear].find(card => card.gamecardId === selected[0]);
  return assertScenario(
    'white temple optional archer trigger chooses the best hand target',
    selectedCard?.id === '101130440',
    `selected=${selectedCard?.fullName || selected.join(',') || 'none'}`
  );
}

function testWhiteTempleProtectsArcherLineFromPayment(): ScenarioResult {
  const profile = getDeckAiProfile('white-temple');
  const archer = unit({
    id: '101130202',
    fullName: '南征军的弓兵',
    faction: '圣王国',
    cardlocation: 'HAND',
  });
  const rookie = unit({
    id: '101130233',
    fullName: '坚定的新人卫士',
    faction: '圣王国',
    acValue: 3,
    baseAcValue: 3,
    damage: 1,
    feijingMark: true,
    cardlocation: 'HAND',
  });
  const expendableFeijing = unit({
    id: 'WHITE_EXPENDABLE_FEIJING',
    fullName: 'Expendable Feijing',
    faction: '女神教会',
    acValue: 3,
    baseAcValue: 3,
    damage: 1,
    feijingMark: true,
    cardlocation: 'HAND',
  });
  const state = game({ hand: [archer, rookie, expendableFeijing] });
  const rookieScore = scorePaymentSacrificeValue(rookie as any, profile, state, state.players.BOT);
  const expendableScore = scorePaymentSacrificeValue(expendableFeijing as any, profile, state, state.players.BOT);
  return assertScenario(
    'white temple payment keeps archer hand-to-field target in hand',
    rookieScore > expendableScore + 20,
    `rookie=${rookieScore.toFixed(1)}, expendable=${expendableScore.toFixed(1)}`
  );
}

function testWhiteTempleEscortTargetsOpponentFirst(): ScenarioResult {
  const profile = getDeckAiProfile('white-temple');
  const escort = unit({ id: '101140151', fullName: '教会的押送人', faction: '女神教会', cardlocation: 'UNIT' });
  const ownKeyUnit = unit({
    id: '101130440',
    fullName: '殿堂骑士·魔枪',
    faction: '圣王国',
    damage: 2,
    power: 2500,
    cardlocation: 'UNIT',
  });
  const opponentThreat = unit({
    id: 'OPPONENT_THREAT',
    fullName: 'Opponent Threat',
    damage: 2,
    power: 3000,
    cardlocation: 'UNIT',
  });
  const state = game(
    { unitZone: [escort, ownKeyUnit, null, null, null, null] },
    { unitZone: [opponentThreat, null, null, null, null, null] }
  );
  const query = {
    id: 'white_escort_exile',
    type: 'SELECT_CARD',
    playerUid: 'BOT',
    title: '选择放逐目标',
    description: '选择战场上的1张《教会的押送人》以外的卡。',
    callbackKey: 'EFFECT_RESOLVE',
    minSelections: 1,
    maxSelections: 1,
    context: { sourceCardId: escort.gamecardId, effectId: '101140151_enter_exile' },
    options: [
      { card: ownKeyUnit, isMine: true },
      { card: opponentThreat, isMine: false },
    ],
  };
  const selected = chooseQuerySelections(state, 'BOT', query as any, profile, 'hard');
  const selectedCard = [ownKeyUnit, opponentThreat].find(card => card.gamecardId === selected[0]);
  return assertScenario(
    'white temple escort exiles opponent target before own unit',
    selectedCard?.gamecardId === opponentThreat.gamecardId,
    `selected=${selectedCard?.fullName || selected.join(',') || 'none'}`
  );
}

function testBotDoesNotAlwaysSpendFeijing(): ScenarioResult {
  const profile = getDeckAiProfile('white-temple');
  const feijing = unit({
    id: '101130233',
    fullName: '坚定的新人卫士',
    faction: '圣王国',
    color: 'WHITE',
    feijingMark: true,
    cardlocation: 'HAND',
  });
  const sourceCard = story({
    id: 'WHITE_COST_ONE_STORY',
    fullName: 'White Cost One Story',
    color: 'WHITE',
    acValue: 1,
    baseAcValue: 1,
    cardlocation: 'HAND',
  });
  const state = game({
    hand: [sourceCard, feijing],
    deck: deckCards(20, 'BOT_FEIJING_PAYMENT'),
    botDifficulty: 'hard',
    botDeckProfileId: profile.id,
  }, {}, {
    botDifficulty: 'hard',
    botDeckProfiles: { BOT: profile.id },
  });
  const payment = ServerGameService.buildBotPaymentSelectionForPlayer(state, 'BOT', {
    paymentCost: 1,
    paymentColor: 'WHITE',
    context: {
      cardId: sourceCard.gamecardId,
      sourceCardId: sourceCard.gamecardId,
      paymentTargetId: sourceCard.gamecardId,
    },
  }) as any;
  return assertScenario(
    'hard AI does not spend feijing for every small payment',
    !payment.feijingCardId,
    `payment=${JSON.stringify(payment)}`
  );
}

function testPaymentProtectsGodMark(): ScenarioResult {
  const profile = getDeckAiProfile('white-temple');
  const god = unit({ id: 'PAY_GOD', fullName: 'Pay God', godMark: true, power: 5000, damage: 2 });
  const low = unit({ id: 'PAY_LOW', fullName: 'Pay Low', power: 500, damage: 0 });
  const state = game({ unitZone: [god, low, null, null, null, null] });
  const godScore = scorePaymentExhaustValue(state, god as any, profile, 'hard');
  const lowScore = scorePaymentExhaustValue(state, low as any, profile, 'hard');
  return assertScenario(
    'payment scoring protects god/high value unit',
    godScore > lowScore + 100,
    `god=${Math.round(godScore)}, low=${Math.round(lowScore)}`
  );
}

function testDefenseDoesNotThrowGodMarkOnNonLethalHit(): ScenarioResult {
  const profile = getDeckAiProfile('white-temple');
  const god = unit({ id: 'DEF_GOD', fullName: 'Def God', godMark: true, power: 1000, damage: 2 });
  const low = unit({ id: 'DEF_LOW', fullName: 'Def Low', power: 1000, damage: 0 });
  const attacker = unit({ id: 'ATTACKER', fullName: 'Attacker', power: 1000, damage: 1 });
  const state = game(
    { unitZone: [god, low, null, null, null, null], erosionFront: [], erosionBack: [] },
    { unitZone: [attacker, null, null, null, null, null] },
    { phase: 'DEFENSE_DECLARATION' }
  );
  const chosen = chooseDefender(state, state.players.BOT, [attacker] as any, [god, low] as any, profile, 'hard');
  return assertScenario(
    'defense avoids trading god mark on non-lethal hit',
    !chosen || chosen.gamecardId !== god.gamecardId,
    `chosen=${chosen?.fullName || 'none'}`
  );
}

function testFiveDeckProfilesProduceTurnPlans(): ScenarioResult {
  const ids = ['white-temple', 'blue-adventurer', 'red-dikai', 'yellow-alchemy', 'overlord-totem'];
  const failures: string[] = [];
  for (const id of ids) {
    const profile = getDeckAiProfile(id);
    const attacker = unit({ id: `${id}_ATTACKER`, damage: id === 'red-dikai' ? 2 : 1, playedTurn: 1 });
    const state = game({ unitZone: [attacker, null, null, null, null, null] });
    const plan = buildTurnPlan(state, state.players.BOT, profile);
    if (!plan.tacticalLine || !plan.mode) failures.push(id);
  }
  return assertScenario(
    'all five hard AI deck profiles produce tactical turn plans',
    failures.length === 0,
    failures.length ? `failed=${failures.join(',')}` : `profiles=${ids.length}`
  );
}

function testWhiteTempleConvertsHallPressure(): ScenarioResult {
  const profile = getDeckAiProfile('white-temple');
  const spear = unit({ id: '101130440', fullName: 'Temple Knight Magic Spear', damage: 2, power: 2500, playedTurn: 1 });
  const sword = unit({ id: '101130458', fullName: 'Temple Knight Hero Sword', damage: 2, power: 2500, playedTurn: 1 });
  const state = game(
    { unitZone: [spear, sword, null, null, null, null] },
    { erosionBack: erosionCards(6, 'P1_WHITE_ROUTE') }
  );
  const plan = buildTurnPlan(state, state.players.BOT, profile);
  const hasRouteNote = plan.notes.some(note => note.includes('white route:'));
  return assertScenario(
    'white temple route turns hall board into reset pressure',
    plan.attackBeforeDeveloping && hasRouteNote,
    `attackBefore=${plan.attackBeforeDeveloping}, notes=${plan.notes.join('|')}`
  );
}

function testBlueAdventurerConvertsTempoPressure(): ScenarioResult {
  const profile = getDeckAiProfile('blue-adventurer');
  const adventurer = unit({ id: 'BLUE_ROUTE_ATTACKER', color: 'BLUE', damage: 2, power: 2000, playedTurn: 1 });
  const state = game(
    { unitZone: [adventurer, null, null, null, null, null] },
    { erosionBack: erosionCards(4, 'P1_BLUE_ROUTE') }
  );
  const plan = buildTurnPlan(state, state.players.BOT, profile);
  const hasRouteNote = plan.notes.some(note => note.includes('blue route:'));
  return assertScenario(
    'blue adventurer route converts tempo unit into erosion pressure',
    plan.attackBeforeDeveloping && hasRouteNote,
    `attackBefore=${plan.attackBeforeDeveloping}, notes=${plan.notes.join('|')}`
  );
}

function testRedDikaiCommitsNearKillPressure(): ScenarioResult {
  const profile = getDeckAiProfile('red-dikai');
  const dikaiA = unit({ id: 'RED_ROUTE_A', color: 'RED', damage: 2, power: 2500, playedTurn: 1 });
  const dikaiB = unit({ id: 'RED_ROUTE_B', color: 'RED', damage: 1, power: 1500, playedTurn: 1 });
  const state = game(
    { unitZone: [dikaiA, dikaiB, null, null, null, null], deck: deckCards(5, 'BOT_RED_ROUTE') },
    { erosionBack: erosionCards(7, 'P1_RED_ROUTE') }
  );
  const plan = buildTurnPlan(state, state.players.BOT, profile);
  const hasRouteNote = plan.notes.some(note => note.includes('red route: commit'));
  return assertScenario(
    'red dikai route commits attackers in near-kill window',
    plan.attackBeforeDeveloping && plan.reserveDefenders === 0 && hasRouteNote,
    `attackBefore=${plan.attackBeforeDeveloping}, reserve=${plan.reserveDefenders}, notes=${plan.notes.join('|')}`
  );
}

function testYellowAlchemyConvertsEnginePressure(): ScenarioResult {
  const profile = getDeckAiProfile('yellow-alchemy');
  const alchemistA = unit({ id: 'YELLOW_ROUTE_A', color: 'YELLOW', damage: 1, power: 1500, playedTurn: 1 });
  const alchemistB = unit({ id: 'YELLOW_ROUTE_B', color: 'YELLOW', damage: 2, power: 2000, playedTurn: 1 });
  const state = game(
    {
      unitZone: [alchemistA, alchemistB, null, null, null, null],
      deck: deckCards(14, 'BOT_YELLOW_ROUTE'),
      hand: [story({ id: 'YELLOW_RESOURCE_CARD', color: 'YELLOW' })],
    },
    { erosionBack: erosionCards(5, 'P1_YELLOW_ROUTE') }
  );
  const plan = buildTurnPlan(state, state.players.BOT, profile);
  const hasRouteNote = plan.notes.some(note => note.includes('yellow route:'));
  return assertScenario(
    'yellow alchemy route converts engine resources before deck pressure',
    plan.attackBeforeDeveloping && hasRouteNote,
    `attackBefore=${plan.attackBeforeDeveloping}, notes=${plan.notes.join('|')}`
  );
}

function testOverlordTotemConvertsRecursiveBoard(): ScenarioResult {
  const profile = getDeckAiProfile('overlord-totem');
  const totemA = unit({ id: 'TOTEM_ROUTE_A', color: 'WHITE', damage: 1, power: 1500, playedTurn: 1 });
  const totemB = unit({ id: 'TOTEM_ROUTE_B', color: 'WHITE', damage: 2, power: 2000, playedTurn: 1 });
  const state = game(
    { unitZone: [totemA, totemB, null, null, null, null] },
    { erosionBack: erosionCards(5, 'P1_TOTEM_ROUTE') }
  );
  const plan = buildTurnPlan(state, state.players.BOT, profile);
  const hasRouteNote = plan.notes.some(note => note.includes('totem route:'));
  return assertScenario(
    'overlord totem route shifts recursive board into pressure',
    plan.attackBeforeDeveloping && hasRouteNote,
    `attackBefore=${plan.attackBeforeDeveloping}, notes=${plan.notes.join('|')}`
  );
}

function testYellowTurretTargetsOpponentUnit(): ScenarioResult {
  const profile = getDeckAiProfile('yellow-alchemy');
  const ownCore = unit({ id: '105120167', color: 'YELLOW', fullName: 'Great Alchemist Core', power: 2000, damage: 1, godMark: true });
  const opponentThreat = unit({ id: 'OPP_TURRET_TARGET', color: 'RED', fullName: 'Opponent Attacker', power: 3500, damage: 3 });
  const state = game(
    { unitZone: [ownCore, null, null, null, null, null], botDeckProfileId: 'yellow-alchemy' },
    { unitZone: [opponentThreat, null, null, null, null, null] }
  );
  const query = {
    type: 'SELECT_CARD',
    options: [
      { card: ownCore, source: 'UNIT', isMine: true },
      { card: opponentThreat, source: 'UNIT', isMine: false },
    ],
    minSelections: 1,
    maxSelections: 1,
    context: { effectId: '305110029_activate' },
  };
  const selected = chooseQuerySelections(state, 'BOT', query as any, profile, 'hard');
  return assertScenario(
    'yellow turret targets opponent instead of own core',
    selected[0] === opponentThreat.gamecardId,
    `selected=${selected[0]}`
  );
}

function testYellowAlchemyCostPreservesCore(): ScenarioResult {
  const profile = getDeckAiProfile('yellow-alchemy');
  const core = unit({ id: '105120167', color: 'YELLOW', fullName: 'Great Alchemist Core', power: 2000, damage: 1, godMark: true });
  const expendable = unit({ id: '105110224', color: 'YELLOW', fullName: 'Alchemy Feijing Material', power: 500, damage: 0, feijingMark: true });
  const state = game(
    { unitZone: [core, expendable, null, null, null, null], botDeckProfileId: 'yellow-alchemy' },
    {}
  );
  const query = {
    type: 'SELECT_CARD',
    options: [
      { card: core, source: 'UNIT', isMine: true },
      { card: expendable, source: 'UNIT', isMine: true },
    ],
    minSelections: 1,
    maxSelections: 1,
    context: { effectId: '305120030_activate', step: 'SEND_UNIT' },
  };
  const selected = chooseQuerySelections(state, 'BOT', query as any, profile, 'hard');
  return assertScenario(
    'yellow alchemy cost preserves engine core',
    selected[0] === expendable.gamecardId,
    `selected=${selected[0]}`
  );
}

function testRedDuelKeepsCommander(): ScenarioResult {
  const profile = getDeckAiProfile('red-dikai');
  const commander = unit({ id: '102050432', color: 'RED', fullName: 'Knight Captain Dikai', power: 3500, damage: 4, godMark: true });
  const small = unit({ id: '102050085', color: 'RED', fullName: 'Pursuit Troop', power: 1000, damage: 1 });
  const state = game(
    { unitZone: [small, commander, null, null, null, null], botDeckProfileId: 'red-dikai' },
    {}
  );
  const query = {
    type: 'SELECT_CARD',
    options: [
      { card: small, source: 'UNIT', isMine: true },
      { card: commander, source: 'UNIT', isMine: true },
    ],
    minSelections: 1,
    maxSelections: 1,
    context: { effectId: '202000131_duel', step: 'SELF' },
  };
  const selected = chooseQuerySelections(state, 'BOT', query as any, profile, 'hard');
  return assertScenario(
    'red duel keeps the commander',
    selected[0] === commander.gamecardId,
    `selected=${selected[0]}`
  );
}

function testBlueSwapChoosesErosionPayoff(): ScenarioResult {
  const profile = getDeckAiProfile('blue-adventurer');
  const lowValue = unit({ id: 'BLUE_LOW_EROSION', color: 'BLUE', fullName: 'Low Erosion Unit', power: 500, damage: 0, cardlocation: 'EROSION_FRONT' });
  const batla = unit({ id: '104030453', color: 'BLUE', fullName: 'Batla Payoff', power: 2500, damage: 2, cardlocation: 'EROSION_FRONT' });
  const state = game(
    { erosionFront: [lowValue, batla], botDeckProfileId: 'blue-adventurer' },
    {}
  );
  const query = {
    type: 'SELECT_CARD',
    options: [
      { card: lowValue, source: 'EROSION_FRONT', isMine: true },
      { card: batla, source: 'EROSION_FRONT', isMine: true },
    ],
    minSelections: 1,
    maxSelections: 1,
    context: { effectId: '104030459_swap_activate', step: 'TARGET' },
  };
  const selected = chooseQuerySelections(state, 'BOT', query as any, profile, 'hard');
  return assertScenario(
    'blue swap chooses erosion payoff',
    selected[0] === batla.gamecardId,
    `selected=${selected[0]}`
  );
}

function testTotemRitualChoosesOverlord(): ScenarioResult {
  const profile = getDeckAiProfile('overlord-totem');
  const lowTotem = unit({ id: '103080312', color: 'GREEN', fullName: 'Winged Totem', power: 1000, damage: 1, cardlocation: 'DECK' });
  const overlord = unit({ id: '103000139', color: 'GREEN', fullName: 'Jungle Overlord', power: 4000, damage: 3, cardlocation: 'DECK' });
  const state = game(
    { deck: [lowTotem, overlord], botDeckProfileId: 'overlord-totem' },
    {}
  );
  const query = {
    type: 'SELECT_CARD',
    options: [
      { card: lowTotem, source: 'DECK', isMine: true },
      { card: overlord, source: 'DECK', isMine: true },
    ],
    minSelections: 1,
    maxSelections: 1,
    context: { effectId: '203000126_ritual' },
  };
  const selected = chooseQuerySelections(state, 'BOT', query as any, profile, 'hard');
  return assertScenario(
    'totem ritual chooses overlord payoff',
    selected[0] === overlord.gamecardId,
    `selected=${selected[0]}`
  );
}

const scenarios: ScenarioRun[] = [
  testLethalTurnPlan,
  testSmileEclipseCombo,
  testProtectHighValueFromSelfDestroy,
  testOnlyHighValueSelfDestroyAborts,
  testElementInstructorAvoidsDestroyMode,
  testEffectTimingWindows,
  testBattleFreeHoldsSetupStory,
  testMainRemovalStoryNeedsTarget,
  testBattleCombatStoryBeatsSetupStory,
  testEclipseWaitsForProtectedAllianceWindow,
  testBlueCounterStoryRequiresCounterWindow,
  testHardAiUsesConfrontationStory,
  testHardAiPassesLowValueConfrontationStory,
  testHardAiChoosesConfrontationFieldEffect,
  testPreventDestroyWaitsForThreatWindow,
  testRedCannotDefendNeedsTargetInClosingWindow,
  testYellowReviveMainPhaseNotBattleSetup,
  testTotemPrepareStoryMainNotBattleFiller,
  testWhiteTemplePrefersKeyResetTargets,
  testWhiteTempleMultiResetTakesBothKeyTargets,
  testWhiteTemplePlaysArcherBeforeHandTargets,
  testWhiteTempleOptionalArcherTriggerSelectsTarget,
  testWhiteTempleProtectsArcherLineFromPayment,
  testWhiteTempleEscortTargetsOpponentFirst,
  testBotDoesNotAlwaysSpendFeijing,
  testPaymentProtectsGodMark,
  testDefenseDoesNotThrowGodMarkOnNonLethalHit,
  testFiveDeckProfilesProduceTurnPlans,
  testWhiteTempleConvertsHallPressure,
  testBlueAdventurerConvertsTempoPressure,
  testRedDikaiCommitsNearKillPressure,
  testYellowAlchemyConvertsEnginePressure,
  testOverlordTotemConvertsRecursiveBoard,
  testYellowTurretTargetsOpponentUnit,
  testYellowAlchemyCostPreservesCore,
  testRedDuelKeepsCommander,
  testBlueSwapChoosesErosionPayoff,
  testTotemRitualChoosesOverlord,
];

const results: ScenarioResult[] = [];
for (const run of scenarios) {
  results.push(await run());
}
for (const result of results) {
  console.log(`${result.passed ? 'PASS' : 'FAIL'} ${result.name}: ${result.detail}`);
}

const failed = results.filter(result => !result.passed);
if (failed.length > 0) {
  console.error(`Hard AI scenario tests failed: ${failed.length}/${results.length}`);
  process.exit(1);
}

console.log(`Hard AI scenario tests passed: ${results.length}/${results.length}`);
