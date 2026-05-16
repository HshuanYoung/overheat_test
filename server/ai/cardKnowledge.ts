import { Card, CardType } from '../../src/types/game';
import { SERVER_CARD_LIBRARY } from '../card_loader';

export type CardRole =
  | 'engine'
  | 'draw'
  | 'search'
  | 'removal'
  | 'damage'
  | 'protection'
  | 'resource'
  | 'tempo'
  | 'finisher'
  | 'defender'
  | 'combo_piece'
  | 'risk';

export interface CardKnowledge {
  id: string;
  uniqueId: string;
  name: string;
  type: CardType;
  cost: number;
  power: number;
  damage: number;
  roles: CardRole[];
  baseValue: number;
  playPriority: number;
  preserveValue: number;
  discardValue: number;
  targetPriority: number;
  risk: number;
}

const roleCounts = new Map<CardRole, number>();
const knowledgeByRef = new Map<string, CardKnowledge>();
let lastLibrarySize = 0;

const hasAny = (text: string, patterns: RegExp[]) => patterns.some(pattern => pattern.test(text));

const rolePatterns: Record<CardRole, RegExp[]> = {
  engine: [/持续|每.*回合|当.*时|Whenever|each turn|continuous/i],
  draw: [/抽|抓|draw/i],
  search: [/检索|搜索|卡组.*加入手牌|牌库.*加入手牌|search|deck.*hand/i],
  removal: [/破坏|放置到墓地|除外|回手|返回手牌|destroy|banish|exile|return.*hand/i],
  damage: [/伤害|damage/i],
  protection: [/免疫|不会被破坏|防止|保护|不能成为|immune|prevent|protect|indestructible/i],
  resource: [/费用|支付|重置|竖置|能量|access|cost|ready|resource/i],
  tempo: [/横置|不能攻击|不能防御|跳过|exhaust|cannot attack|skip/i],
  finisher: [/直接攻击|终结|胜利|追加.*伤害|direct attack|win the game/i],
  defender: [/防御|守护|阻挡|defend|guard|block/i],
  combo_piece: [/若.*则|可以.*发动|选择.*效果|连锁|combo|if.*then/i],
  risk: [/受到.*伤害|自.*伤害|弃置|失去|不能|代价|self.*damage|discard|lose|cannot/i],
};

function effectText(card: Card) {
  return [
    card.fullName,
    card.specialName,
    card.faction,
    card.color,
    ...(card.effects || []).flatMap(effect => [
      effect.id,
      effect.content,
      effect.description,
      effect.triggerEvent,
      effect.targetSpec?.title,
      effect.targetSpec?.description,
    ]),
  ]
    .filter(Boolean)
    .join(' ');
}

function uniqueRoles(card: Card) {
  const text = effectText(card);
  const roles = Object.entries(rolePatterns)
    .filter(([, patterns]) => hasAny(text, patterns))
    .map(([role]) => role as CardRole);

  if (card.type === 'UNIT' && (card.damage || 0) >= 2) roles.push('finisher');
  if (card.type === 'UNIT' && (card.power || 0) >= 5000) roles.push('defender');
  if (card.isrush) roles.push('tempo');
  if (card.godMark) roles.push('combo_piece');

  return [...new Set(roles)];
}

function roleValue(role: CardRole) {
  switch (role) {
    case 'engine': return 6;
    case 'draw': return 4.5;
    case 'search': return 5.5;
    case 'removal': return 5;
    case 'damage': return 3.5;
    case 'protection': return 4.5;
    case 'resource': return 3.5;
    case 'tempo': return 3;
    case 'finisher': return 5.5;
    case 'defender': return 2.5;
    case 'combo_piece': return 4;
    case 'risk': return -2;
    default: return 0;
  }
}

function analyzeCard(card: Card): CardKnowledge {
  const cost = Math.max(0, card.baseAcValue ?? card.acValue ?? 0);
  const power = card.basePower ?? card.power ?? 0;
  const damage = card.baseDamage ?? card.damage ?? 0;
  const roles = uniqueRoles(card);
  const roleScore = roles.reduce((sum, role) => sum + roleValue(role), 0);
  const risk = roles.includes('risk') ? 3 : 0;
  const lowCostBonus = Math.max(0, 5 - cost) * 0.8;
  const unitStats = card.type === 'UNIT'
    ? power / 1200 + damage * 5 + (card.isrush ? 2.5 : 0) + (card.godMark ? 2 : 0)
    : 0;
  const typeBase = card.type === 'UNIT' ? 3 : card.type === 'ITEM' ? 4 : 2.5;
  const baseValue = Math.max(0, typeBase + unitStats + roleScore + lowCostBonus - risk);
  const playPriority = baseValue +
    (roles.includes('engine') ? 4 : 0) +
    (roles.includes('search') ? 2 : 0) +
    (roles.includes('draw') ? 1.5 : 0) +
    (roles.includes('finisher') ? Math.max(0, damage - 1) * 2 : 0);
  const preserveValue = baseValue +
    (roles.includes('engine') ? 5 : 0) +
    (roles.includes('combo_piece') ? 4 : 0) +
    (roles.includes('protection') ? 2 : 0);
  const discardValue = baseValue +
    (roles.includes('risk') ? -2 : 0) +
    (cost >= 5 ? 1.5 : 0) +
    (roles.includes('engine') ? 4 : 0);
  const targetPriority = baseValue +
    (roles.includes('engine') ? 4 : 0) +
    (roles.includes('finisher') ? 4 : 0) +
    (roles.includes('protection') ? 2 : 0);

  return {
    id: card.id,
    uniqueId: card.uniqueId,
    name: card.fullName,
    type: card.type,
    cost,
    power,
    damage,
    roles,
    baseValue,
    playPriority,
    preserveValue,
    discardValue,
    targetPriority,
    risk,
  };
}

export function rebuildCardKnowledge(cards: Card[]) {
  knowledgeByRef.clear();
  roleCounts.clear();

  const seen = new Set<string>();
  for (const card of cards) {
    const ref = card.uniqueId || card.id;
    if (!ref || seen.has(ref)) continue;
    seen.add(ref);
    const knowledge = analyzeCard(card);
    knowledgeByRef.set(card.uniqueId, knowledge);
    if (!knowledgeByRef.has(card.id)) knowledgeByRef.set(card.id, knowledge);
    for (const role of knowledge.roles) {
      roleCounts.set(role, (roleCounts.get(role) || 0) + 1);
    }
  }

  lastLibrarySize = Object.keys(SERVER_CARD_LIBRARY).length;
}

export function ensureCardKnowledge() {
  const cards = Object.values(SERVER_CARD_LIBRARY);
  if (cards.length > 0 && (knowledgeByRef.size === 0 || lastLibrarySize !== cards.length)) {
    rebuildCardKnowledge(cards);
  }
}

export function getCardKnowledge(card: Card | null | undefined) {
  if (!card) return undefined;
  ensureCardKnowledge();
  return knowledgeByRef.get(card.uniqueId) || knowledgeByRef.get(card.id) || analyzeCard(card);
}

export function getCardKnowledgeValue(card: Card | null | undefined, key: keyof Pick<CardKnowledge, 'baseValue' | 'playPriority' | 'preserveValue' | 'discardValue' | 'targetPriority' | 'risk'>) {
  return getCardKnowledge(card)?.[key] || 0;
}

export function summarizeCardKnowledge() {
  ensureCardKnowledge();
  return {
    cards: new Set([...knowledgeByRef.values()].map(knowledge => knowledge.uniqueId)).size,
    roles: Object.fromEntries([...roleCounts.entries()].sort((a, b) => a[0].localeCompare(b[0]))),
  };
}
