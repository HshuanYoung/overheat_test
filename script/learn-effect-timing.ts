import fs from 'fs';
import path from 'path';
import { AiDecisionLog, Card, CardEffect, GamePhase } from '../src/types/game';
import { inferEffectTimingProfile } from '../server/ai/effectTimingKnowledge';
import { initServerCardLibrary, SERVER_CARD_LIBRARY } from '../server/card_loader';

type EffectObservation = {
  effectId: string;
  activated: number;
  failed: number;
  phases: Record<string, { activated: number; failed: number }>;
  scores: number[];
  subjects: Record<string, number>;
  decks: Record<string, number>;
  examples: string[];
};

type StaticEffectInfo = {
  effectId: string;
  cardIds: Set<string>;
  cardNames: Set<string>;
  types: Set<string>;
  inferredTags: Set<string>;
  preferredPhases: Set<GamePhase>;
  avoidPhases: Set<GamePhase>;
  reasons: Set<string>;
};

const argValue = (name: string) => {
  const raw = process.argv.find(arg => arg.startsWith(`--${name}=`));
  return raw ? raw.slice(name.length + 3) : undefined;
};

function readJson(filePath: string) {
  if (!fs.existsSync(filePath)) return undefined;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function escapeMarkdown(text: unknown) {
  return String(text ?? '')
    .replace(/\|/g, '\\|')
    .replace(/\r?\n/g, ' ');
}

function markdownTable(headers: string[], rows: Array<Array<string | number>>) {
  return [
    `| ${headers.map(escapeMarkdown).join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map(row => `| ${row.map(escapeMarkdown).join(' | ')} |`),
  ].join('\n');
}

function detail(log: AiDecisionLog, key: string) {
  return log.details?.[key];
}

function phaseKey(log: AiDecisionLog) {
  const phaseContext = detail(log, 'phaseContext');
  return phaseContext ? `${log.phase}/${phaseContext}` : log.phase;
}

function ensureObservation(map: Map<string, EffectObservation>, effectId: string) {
  if (!map.has(effectId)) {
    map.set(effectId, {
      effectId,
      activated: 0,
      failed: 0,
      phases: {},
      scores: [],
      subjects: {},
      decks: {},
      examples: [],
    });
  }
  return map.get(effectId)!;
}

function addLog(map: Map<string, EffectObservation>, log: AiDecisionLog) {
  if (log.action !== 'ACTIVATE_EFFECT' && log.action !== 'ACTIVATE_EFFECT_FAILED') return;
  const effectId = String(detail(log, 'effectId') || log.subject || 'UNKNOWN_EFFECT');
  const observation = ensureObservation(map, effectId);
  const key = phaseKey(log);
  observation.phases[key] ??= { activated: 0, failed: 0 };

  if (log.action === 'ACTIVATE_EFFECT') {
    observation.activated++;
    observation.phases[key].activated++;
  } else {
    observation.failed++;
    observation.phases[key].failed++;
  }

  if (typeof log.score === 'number') observation.scores.push(log.score);
  const subject = log.subject || 'unknown';
  observation.subjects[subject] = (observation.subjects[subject] || 0) + 1;
  const deck = log.playerName || log.profileId || log.playerUid || 'unknown';
  observation.decks[deck] = (observation.decks[deck] || 0) + 1;
  if (observation.examples.length < 5) {
    observation.examples.push(`${log.turn}:${log.phase}:${log.action}:${subject}`);
  }
}

function collectLogsFromReport(report: any) {
  const logs: AiDecisionLog[] = [];

  for (const result of report?.results || []) {
    logs.push(...(result.aiDecisionLogs || []));
  }

  for (const sample of report?.samples || []) {
    logs.push(...(sample.ai_decision_logs || []));
  }

  if (Array.isArray(report?.aiDecisionLogs)) {
    logs.push(...report.aiDecisionLogs);
  }

  return logs;
}

function topEntries(record: Record<string, number>, limit = 3) {
  return Object.entries(record)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit);
}

function topPhaseEntries(phases: EffectObservation['phases'], limit = 3) {
  return Object.entries(phases)
    .map(([phase, stats]) => ({
      phase,
      total: stats.activated + stats.failed,
      activated: stats.activated,
      failed: stats.failed,
    }))
    .sort((a, b) => b.total - a.total || b.activated - a.activated || a.phase.localeCompare(b.phase))
    .slice(0, limit);
}

function failRate(observation?: EffectObservation) {
  if (!observation) return 0;
  const total = observation.activated + observation.failed;
  return total > 0 ? observation.failed / total : 0;
}

function pct(value: number) {
  return `${Math.round(value * 100)}%`;
}

function avg(values: number[]) {
  if (values.length === 0) return undefined;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function addStaticEffect(map: Map<string, StaticEffectInfo>, card: Card, effect: CardEffect, effectIndex: number) {
  const profile = inferEffectTimingProfile(card, effect);
  const effectId = effect.id || `${card.id}#${effectIndex + 1}`;
  if (!map.has(effectId)) {
    map.set(effectId, {
      effectId,
      cardIds: new Set(),
      cardNames: new Set(),
      types: new Set(),
      inferredTags: new Set(),
      preferredPhases: new Set(),
      avoidPhases: new Set(),
      reasons: new Set(),
    });
  }
  const info = map.get(effectId)!;
  info.cardIds.add(card.id);
  info.cardNames.add(card.fullName);
  info.types.add(effect.type || 'UNKNOWN');
  profile.tags.forEach(tag => info.inferredTags.add(tag));
  profile.preferredPhases.forEach(phase => info.preferredPhases.add(phase));
  profile.avoidPhases.forEach(phase => info.avoidPhases.add(phase));
  profile.reasons.forEach(reason => info.reasons.add(reason));
}

function recommendation(staticInfo?: StaticEffectInfo, observation?: EffectObservation) {
  if (!observation || observation.activated + observation.failed === 0) {
    return 'unobserved: use inferred timing as default';
  }
  if (failRate(observation) >= 0.3 && observation.failed >= 2) {
    return 'high fail rate: add target/payment pre-check or raise timing gate';
  }
  const observedBest = topPhaseEntries(observation.phases, 1)[0]?.phase.split('/')[0] as GamePhase | undefined;
  if (observedBest && staticInfo && staticInfo.preferredPhases.size > 0 && !staticInfo.preferredPhases.has(observedBest)) {
    return 'observed phase differs from inference: inspect replay examples';
  }
  return 'stable: keep current timing';
}

async function main() {
  await initServerCardLibrary();

  const staticEffects = new Map<string, StaticEffectInfo>();
  const seenCards = new Set<string>();
  for (const card of Object.values(SERVER_CARD_LIBRARY)) {
    if (!card?.id || seenCards.has(card.id)) continue;
    seenCards.add(card.id);
    (card.effects || []).forEach((effect, index) => addStaticEffect(staticEffects, card, effect, index));
  }

  const reportsDir = path.join(process.cwd(), 'reports');
  const explicitInput = argValue('input');
  const inputPaths = explicitInput
    ? explicitInput.split(',').map(item => path.resolve(process.cwd(), item.trim())).filter(Boolean)
    : [
      path.join(reportsDir, 'ai-eval-latest.json'),
      path.join(reportsDir, 'live-ai-latest.json'),
    ];

  const observations = new Map<string, EffectObservation>();
  const loadedReports: string[] = [];
  for (const inputPath of inputPaths) {
    const report = readJson(inputPath);
    if (!report) continue;
    loadedReports.push(inputPath);
    for (const log of collectLogsFromReport(report)) {
      addLog(observations, log);
    }
  }

  const effectIds = new Set([...staticEffects.keys(), ...observations.keys()]);
  const rows = [...effectIds].map(effectId => {
    const staticInfo = staticEffects.get(effectId);
    const observation = observations.get(effectId);
    const total = (observation?.activated || 0) + (observation?.failed || 0);
    return {
      effectId,
      cards: [...(staticInfo?.cardNames || new Set<string>())],
      tags: [...(staticInfo?.inferredTags || new Set<string>())],
      inferred: [...(staticInfo?.preferredPhases || new Set<GamePhase>())],
      avoid: [...(staticInfo?.avoidPhases || new Set<GamePhase>())],
      observedPhases: observation ? topPhaseEntries(observation.phases, 4) : [],
      activated: observation?.activated || 0,
      failed: observation?.failed || 0,
      total,
      failRate: failRate(observation),
      averageScore: observation ? avg(observation.scores) : undefined,
      subjects: observation ? topEntries(observation.subjects, 3) : [],
      decks: observation ? topEntries(observation.decks, 3) : [],
      recommendation: recommendation(staticInfo, observation),
      examples: observation?.examples || [],
    };
  }).sort((a, b) =>
    b.total - a.total ||
    b.failed - a.failed ||
    a.effectId.localeCompare(b.effectId)
  );

  const report = {
    createdAt: new Date().toISOString(),
    loadedReports,
    observedEffectCount: observations.size,
    knownEffectCount: staticEffects.size,
    rows,
  };

  const tableRows = rows
    .filter(row => row.total > 0 || row.inferred.length > 0)
    .slice(0, 80)
    .map(row => [
      row.effectId,
      row.cards.slice(0, 2).join(', ') || row.subjects.map(([name]) => name).join(', '),
      row.tags.slice(0, 5).join(', '),
      row.inferred.slice(0, 3).join('/'),
      row.observedPhases.map(item => `${item.phase}:${item.activated}/${item.failed}`).join(', ') || '-',
      row.activated,
      row.failed,
      pct(row.failRate),
      row.averageScore === undefined ? '' : row.averageScore.toFixed(1),
      row.recommendation,
    ]);

  const markdown = [
    '# Effect Timing Learning Report',
    '',
    `Generated: ${report.createdAt}`,
    `Loaded reports: ${loadedReports.length > 0 ? loadedReports.join(', ') : 'none'}`,
    `Known effects: ${staticEffects.size}`,
    `Observed effects: ${observations.size}`,
    '',
    '## Timing Table',
    '',
    markdownTable(
      ['EffectId', 'Cards', 'Tags', 'Inferred Phases', 'Observed Phase OK/Fail', 'OK', 'Fail', 'Fail Rate', 'Avg Score', 'Recommendation'],
      tableRows
    ),
    '',
    '## Notes',
    '',
    '- Inferred phases come from card text, target specs, atomic effect types, and effect ids.',
    '- Observed phases come from ACTIVATE_EFFECT and ACTIVATE_EFFECT_FAILED decision logs in evaluation/live reports.',
    '- A high fail rate usually means the effect needs a stricter target/payment gate before activation.',
    '',
  ].join('\n');

  fs.mkdirSync(reportsDir, { recursive: true });
  const id = Date.now();
  const jsonPath = path.join(reportsDir, `effect-timing-${id}.json`);
  const mdPath = path.join(reportsDir, `effect-timing-${id}.md`);
  const latestJsonPath = path.join(reportsDir, 'effect-timing-latest.json');
  const latestMdPath = path.join(reportsDir, 'effect-timing-latest.md');

  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf8');
  fs.writeFileSync(mdPath, markdown, 'utf8');
  fs.writeFileSync(latestJsonPath, JSON.stringify(report, null, 2), 'utf8');
  fs.writeFileSync(latestMdPath, markdown, 'utf8');

  console.log(`Effect timing learning finished: ${observations.size} observed / ${staticEffects.size} known effects`);
  console.log(`Report: ${mdPath}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
