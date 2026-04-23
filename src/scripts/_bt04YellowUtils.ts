import { Card, GameState, PlayerState } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';

export const getOwnerUid = (gameState: GameState, card: Card) =>
  AtomicEffectExecutor.findCardOwnerKey(gameState, card.gamecardId);

export const isBattlingGodMarkUnit = (gameState: GameState, instance: Card) => {
  const battleState = gameState.battleState;
  if (!battleState) return false;

  if (battleState.defender === instance.gamecardId) {
    return battleState.attackers.some(attackerId => {
      const attacker = AtomicEffectExecutor.findCardById(gameState, attackerId);
      return !!attacker?.godMark;
    });
  }

  if (battleState.attackers.includes(instance.gamecardId)) {
    const defender = battleState.defender ? AtomicEffectExecutor.findCardById(gameState, battleState.defender) : undefined;
    return !!defender?.godMark;
  }

  return false;
};

export const getOpponentBattlefieldNonGodCards = (gameState: GameState, playerUid: string) => {
  const opponentUid = gameState.playerIds.find(uid => uid !== playerUid)!;
  const opponent = gameState.players[opponentUid];
  return [...opponent.unitZone, ...opponent.itemZone].filter((card): card is Card => !!card && !card.godMark);
};

export const getItemTypeCount = (player: PlayerState) =>
  new Set(player.itemZone.filter((card): card is Card => !!card).map(card => card.id)).size;

export const getLoneGodmarkUnit = (player: PlayerState) => {
  const godmarkUnits = player.unitZone.filter((card): card is Card => !!card && card.godMark);
  return godmarkUnits.length === 1 ? godmarkUnits[0] : undefined;
};

export const wasPlayedFromHand = (instance: Card) => !!(instance as any).__playSnapshot;
