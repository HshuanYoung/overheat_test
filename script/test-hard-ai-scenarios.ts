import {
  buildTurnPlan,
  chooseDefender,
  chooseQuerySelections,
  scorePlayableCard,
  scorePaymentExhaustValue,
} from '../server/ai/hardStrategy';
import { getDeckAiProfile } from '../server/ai/deckProfiles';
import { scoreEffectTimingWindow } from '../server/ai/effectTimingKnowledge';
import { getComboAllianceAttack, KNOWN_COMBO_CARD_IDS } from '../server/ai/comboKnowledge';

type ScenarioResult = {
  name: string;
  passed: boolean;
  detail: string;
};

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

const scenarios = [
  testLethalTurnPlan,
  testSmileEclipseCombo,
  testProtectHighValueFromSelfDestroy,
  testOnlyHighValueSelfDestroyAborts,
  testElementInstructorAvoidsDestroyMode,
  testEffectTimingWindows,
  testBattleFreeHoldsSetupStory,
  testMainRemovalStoryNeedsTarget,
  testBattleCombatStoryBeatsSetupStory,
  testWhiteTemplePrefersKeyResetTargets,
  testWhiteTempleMultiResetTakesBothKeyTargets,
  testPaymentProtectsGodMark,
  testDefenseDoesNotThrowGodMarkOnNonLethalHit,
  testFiveDeckProfilesProduceTurnPlans,
  testWhiteTempleConvertsHallPressure,
  testBlueAdventurerConvertsTempoPressure,
  testRedDikaiCommitsNearKillPressure,
  testYellowAlchemyConvertsEnginePressure,
  testOverlordTotemConvertsRecursiveBoard,
];

const results = scenarios.map(run => run());
for (const result of results) {
  console.log(`${result.passed ? 'PASS' : 'FAIL'} ${result.name}: ${result.detail}`);
}

const failed = results.filter(result => !result.passed);
if (failed.length > 0) {
  console.error(`Hard AI scenario tests failed: ${failed.length}/${results.length}`);
  process.exit(1);
}

console.log(`Hard AI scenario tests passed: ${results.length}/${results.length}`);
