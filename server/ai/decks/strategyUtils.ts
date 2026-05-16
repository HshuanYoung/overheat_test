import { Card } from '../../../src/types/game';
import { DeckAiCardScoreContext, DeckAiEffectScoreContext, PlayerDeckArchetype } from '../types';
import { getCardKnowledge } from '../cardKnowledge';

export const cardCost = (card: Card) => Math.max(0, card.baseAcValue ?? card.acValue ?? 0);

export function cardText(card: Card) {
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
    ]),
  ].filter(Boolean).join(' ');
}

export function hasAny(text: string, patterns: RegExp[]) {
  return patterns.some(pattern => pattern.test(text));
}

export function hasRole(card: Card, role: string) {
  return !!getCardKnowledge(card)?.roles.includes(role as any);
}

export function effectHasTag(context: DeckAiEffectScoreContext, tag: string) {
  return context.tags.includes(tag as any);
}

export function opponentIs(
  context: DeckAiCardScoreContext | DeckAiEffectScoreContext,
  ...archetypes: PlayerDeckArchetype[]
) {
  return !!context.opponentDeckProfile && archetypes.includes(context.opponentDeckProfile.archetype);
}

export function opponentHasTrait(context: DeckAiCardScoreContext | DeckAiEffectScoreContext, trait: string) {
  return !!context.opponentDeckProfile?.traits.includes(trait);
}

export function openUnitSlots(context: DeckAiCardScoreContext | DeckAiEffectScoreContext) {
  return context.player?.unitZone.filter(slot => slot === null).length || 0;
}

export function readyDefenders(context: DeckAiCardScoreContext | DeckAiEffectScoreContext) {
  const turn = context.gameState?.turnCount || 0;
  return context.player?.unitZone.filter(unit =>
    unit &&
    !unit.isExhausted &&
    !(unit as any).battleForbiddenByEffect &&
    !((unit as any).data?.cannotDefendTurn === turn) &&
    !((unit as any).data?.cannotAttackOrDefendUntilTurn && (unit as any).data.cannotAttackOrDefendUntilTurn >= turn)
  ).length || 0;
}
