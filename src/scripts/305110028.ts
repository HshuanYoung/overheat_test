import { Card, CardEffect } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';

const effect_305110028_revive: CardEffect = {
  id: '305110028_revive',
  type: 'TRIGGER',
  triggerLocation: ['GRAVE'],
  triggerEvent: 'TURN_END' as any,
  limitCount: 1,
  limitNameType: true,
  isMandatory: true,
  description: 'At end of turn, if this card is in your grave and it was sent there from your battlefield by a card effect this turn, put it back onto the battlefield.',
  condition: (gameState, _playerState, instance) =>
    instance.cardlocation === 'GRAVE' &&
    (instance as any).data?.sentToGraveFromFieldByEffectTurn === gameState.turnCount,
  execute: async (instance, gameState, playerState) => {
    AtomicEffectExecutor.moveCard(gameState, playerState.uid, 'GRAVE', playerState.uid, 'ITEM', instance.gamecardId, true, {
      effectSourcePlayerUid: playerState.uid,
      effectSourceCardId: instance.gamecardId
    });
  }
};

const card: Card = {
  id: '305110028',
  fullName: '「记忆塑偶」',
  specialName: '记忆塑偶',
  type: 'ITEM',
  color: 'YELLOW',
  gamecardId: null as any,
  colorReq: { YELLOW: 1 },
  faction: '学院要塞',
  acValue: 2,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  feijingMark: false,
  canResetCount: 0,
  effects: [effect_305110028_revive],
  rarity: 'U',
  availableRarities: ['U'],
  cardPackage: 'BT02',
  uniqueId: null as any,
};

export default card;
