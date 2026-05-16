import fs from 'fs';
import path from 'path';
import { pool } from '../server/db';

type SampleRow = {
  id: string;
  game_id: string;
  created_at: number;
  finished_at: number;
  mode: string;
  bot_profile_id: string;
  bot_difficulty: string;
  opponent_archetype: string;
  opponent_traits: any;
  player_deck_hash: string;
  winner_side: 'bot' | 'player' | 'draw';
  win_reason: string;
  turn_count: number;
  final_phase: string;
  ai_decision_logs: any;
  battle_logs: any;
  final_board: any;
  diagnosis: any;
  ai_version: string;
};

const argValue = (name: string, fallback?: string) => {
  const raw = process.argv.find(arg => arg.startsWith(`--${name}=`));
  return raw ? raw.slice(name.length + 3) : fallback;
};

const days = Number(argValue('days', '7'));
const limit = Number(argValue('limit', '500'));
const botFilter = argValue('bot') || argValue('botProfile');
const since = Date.now() - Math.max(1, days) * 24 * 60 * 60 * 1000;

function parseJson<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== 'string') return value as T;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function pct(value: number, total: number) {
  if (total <= 0) return '0.0%';
  return `${((value / total) * 100).toFixed(1)}%`;
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

function ensureStats<T extends { games: number; botWins: number; playerWins: number; draws: number; totalTurns: number; warnings: number }>(
  map: Map<string, T>,
  key: string,
  create: () => T
) {
  if (!map.has(key)) map.set(key, create());
  return map.get(key)!;
}

function createStats() {
  return {
    games: 0,
    botWins: 0,
    playerWins: 0,
    draws: 0,
    totalTurns: 0,
    warnings: 0,
    softCompensations: 0,
    queryFailures: 0,
    effectFailures: 0,
    winReasons: {} as Record<string, number>,
    actions: {} as Record<string, number>,
  };
}

function addActionCounts(target: Record<string, number>, logs: any[]) {
  for (const log of logs) {
    const action = String(log?.action || 'UNKNOWN');
    target[action] = (target[action] || 0) + 1;
  }
}

function topEntries(record: Record<string, number>, limit = 8) {
  return Object.entries(record)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
}

function normalizeRows(rows: SampleRow[]) {
  return rows.map(row => ({
    ...row,
    opponent_traits: parseJson<string[]>(row.opponent_traits, []),
    ai_decision_logs: parseJson<any[]>(row.ai_decision_logs, []),
    battle_logs: parseJson<string[]>(row.battle_logs, []),
    final_board: parseJson<Record<string, any>>(row.final_board, {}),
    diagnosis: parseJson<Record<string, any>>(row.diagnosis, {}),
  }));
}

function buildReport(samples: ReturnType<typeof normalizeRows>) {
  const byBot = new Map<string, ReturnType<typeof createStats>>();
  const byArchetype = new Map<string, ReturnType<typeof createStats>>();
  const byBotVsArchetype = new Map<string, ReturnType<typeof createStats>>();
  const actionCounts: Record<string, number> = {};
  const warningCounts: Record<string, number> = {};
  const keyDecisions: Array<{ sample: string; bot: string; turn: number; phase: string; action: string; subject: string; reason: string }> = [];

  for (const sample of samples) {
    const groups = [
      ensureStats(byBot, sample.bot_profile_id || 'unknown', createStats),
      ensureStats(byArchetype, sample.opponent_archetype || 'unknown', createStats),
      ensureStats(byBotVsArchetype, `${sample.bot_profile_id || 'unknown'} vs ${sample.opponent_archetype || 'unknown'}`, createStats),
    ];
    const diagnosis = sample.diagnosis || {};
    const logs = sample.ai_decision_logs || [];

    for (const stats of groups) {
      stats.games++;
      stats.totalTurns += Number(sample.turn_count || 0);
      stats.botWins += sample.winner_side === 'bot' ? 1 : 0;
      stats.playerWins += sample.winner_side === 'player' ? 1 : 0;
      stats.draws += sample.winner_side === 'draw' ? 1 : 0;
      stats.warnings += diagnosis.severity === 'warning' ? 1 : 0;
      stats.softCompensations += Number(diagnosis.softCompensations || 0);
      stats.queryFailures += Number(diagnosis.queryFailures || 0);
      stats.effectFailures += Number(diagnosis.effectFailures || 0);
      stats.winReasons[sample.win_reason || 'UNKNOWN'] = (stats.winReasons[sample.win_reason || 'UNKNOWN'] || 0) + 1;
      addActionCounts(stats.actions, logs);
    }

    addActionCounts(actionCounts, logs);
    for (const warning of diagnosis.warnings || []) {
      warningCounts[warning] = (warningCounts[warning] || 0) + 1;
    }

    for (const log of logs) {
      if (!['SOFT_COMPENSATION', 'TURN_PLAN', 'QUERY_FAILED', 'ACTIVATE_EFFECT_FAILED', 'ATTACK', 'DEFEND'].includes(log?.action)) continue;
      keyDecisions.push({
        sample: sample.game_id,
        bot: sample.bot_profile_id,
        turn: log.turn,
        phase: log.phase,
        action: log.action,
        subject: log.subject || '',
        reason: log.reason || '',
      });
      if (keyDecisions.length >= 40) break;
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    filters: {
      days,
      since,
      limit,
      bot: botFilter || null,
    },
    sampleCount: samples.length,
    byBot: Object.fromEntries(byBot.entries()),
    byArchetype: Object.fromEntries(byArchetype.entries()),
    byBotVsArchetype: Object.fromEntries(byBotVsArchetype.entries()),
    actionCounts,
    warningCounts,
    keyDecisions,
    samples,
  };
}

function statsRows(stats: Record<string, ReturnType<typeof createStats>>) {
  return Object.entries(stats)
    .sort((a, b) => b[1].games - a[1].games || a[0].localeCompare(b[0]))
    .map(([key, value]) => [
      key,
      value.games,
      pct(value.botWins, value.games),
      pct(value.playerWins, value.games),
      pct(value.draws, value.games),
      value.games > 0 ? (value.totalTurns / value.games).toFixed(1) : '0.0',
      value.warnings,
      value.softCompensations,
      value.queryFailures,
      value.effectFailures,
      topEntries(value.winReasons, 3).map(([reason, count]) => `${reason}:${count}`).join(', '),
    ]);
}

function buildMarkdownReport(report: ReturnType<typeof buildReport>) {
  const lines: string[] = [];
  lines.push('# Live Hard AI Report');
  lines.push('');
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push(`Samples: ${report.sampleCount}`);
  lines.push(`Window: last ${report.filters.days} day(s)`);
  if (report.filters.bot) lines.push(`Bot filter: ${report.filters.bot}`);
  lines.push('');

  lines.push('## By Bot Deck');
  lines.push(markdownTable(
    ['Bot', 'Games', 'Bot Win', 'Player Win', 'Draw', 'Avg Turns', 'Warnings', 'SoftComp', 'QueryFail', 'EffectFail', 'Win Reasons'],
    statsRows(report.byBot)
  ));
  lines.push('');

  lines.push('## By Player Archetype');
  lines.push(markdownTable(
    ['Archetype', 'Games', 'Bot Win', 'Player Win', 'Draw', 'Avg Turns', 'Warnings', 'SoftComp', 'QueryFail', 'EffectFail', 'Win Reasons'],
    statsRows(report.byArchetype)
  ));
  lines.push('');

  lines.push('## Bot vs Archetype');
  lines.push(markdownTable(
    ['Matchup', 'Games', 'Bot Win', 'Player Win', 'Draw', 'Avg Turns', 'Warnings', 'SoftComp', 'QueryFail', 'EffectFail', 'Win Reasons'],
    statsRows(report.byBotVsArchetype)
  ));
  lines.push('');

  lines.push('## Decision Actions');
  lines.push(markdownTable(['Action', 'Count'], topEntries(report.actionCounts, 20)));
  lines.push('');

  lines.push('## Warnings');
  const warningRows = topEntries(report.warningCounts, 20);
  lines.push(warningRows.length > 0 ? markdownTable(['Warning', 'Count'], warningRows) : 'No warnings.');
  lines.push('');

  lines.push('## Key Decisions');
  lines.push(report.keyDecisions.length > 0
    ? markdownTable(
      ['Game', 'Bot', 'Turn', 'Phase', 'Action', 'Subject', 'Reason'],
      report.keyDecisions.slice(0, 30).map(item => [
        item.sample,
        item.bot,
        item.turn,
        item.phase,
        item.action,
        item.subject,
        item.reason,
      ])
    )
    : 'No key decisions captured.');
  lines.push('');

  lines.push('## Suggested Next Checks');
  lines.push('- Bot win rate below 40% in a matchup: inspect TURN_PLAN and ATTACK/DEFEND decisions for that bot.');
  lines.push('- QueryFail or EffectFail above 0: inspect failed callback/effect IDs before tuning deck weights.');
  lines.push('- SoftComp high but win rate low: opening smoothing helps consistency, but mid-game strategy still needs tuning.');
  lines.push('- Player win rate very low across all archetypes: reduce soft compensation or aggressive hooks before release.');
  lines.push('');

  return lines.join('\n');
}

async function main() {
  const conditions = ['finished_at >= ?'];
  const params: Array<string | number> = [since];

  if (botFilter) {
    conditions.push('bot_profile_id = ?');
    params.push(botFilter);
  }

  params.push(Math.max(1, limit));
  const rows = await pool.query(
    `SELECT *
     FROM ai_match_samples
     WHERE ${conditions.join(' AND ')}
     ORDER BY finished_at DESC
     LIMIT ?`,
    params
  );

  const samples = normalizeRows(rows as SampleRow[]);
  const report = buildReport(samples);
  const markdown = buildMarkdownReport(report);
  const reportsDir = path.join(process.cwd(), 'reports');
  fs.mkdirSync(reportsDir, { recursive: true });

  const id = Date.now();
  const jsonPath = path.join(reportsDir, `live-ai-${id}.json`);
  const mdPath = path.join(reportsDir, `live-ai-${id}.md`);
  const latestJsonPath = path.join(reportsDir, 'live-ai-latest.json');
  const latestMdPath = path.join(reportsDir, 'live-ai-latest.md');

  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf8');
  fs.writeFileSync(mdPath, markdown, 'utf8');
  fs.writeFileSync(latestJsonPath, JSON.stringify(report, null, 2), 'utf8');
  fs.writeFileSync(latestMdPath, markdown, 'utf8');

  console.log(`Live AI report finished: ${samples.length} samples`);
  console.log(`Report: ${jsonPath}`);
  console.log(`Markdown: ${mdPath}`);
  await pool.end();
}

main().catch(async err => {
  console.error(err);
  await pool.end();
  process.exit(1);
});
