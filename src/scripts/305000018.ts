import { Card, CardEffect } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';

const effect_305000018_replace_damage: CardEffect = {
  id: '305000018_replace_damage',
  type: 'CONTINUOUS',
  content: 'REPLACE_DAMAGE_TO_EROSION',
  movementReplacementDestination: 'EXILE',
  description: 'Cards that would enter erosion due to damage are exiled instead.'
};

const effect_305000018_return_to_deck: CardEffect = {
  id: '305000018_return_to_deck',
  type: 'TRIGGER',
  triggerEvent: 'PHASE_CHANGED',
  triggerLocation: ['ITEM'],
  description: 'At the end of the opponent turn, put this card on the bottom of the deck.',
  condition: (_gameState, playerState, instance, event) => {
    return (
      instance.cardlocation === 'ITEM' &&
      event?.type === 'PHASE_CHANGED' &&
      event.data?.phase === 'START' &&
      playerState.isTurn
    );
  },
  execute: async (instance, gameState, playerState) => {
    AtomicEffectExecutor.moveCard(
      gameState,
      playerState.uid,
      'ITEM',
      playerState.uid,
      'DECK',
      instance.gamecardId,
      true,
      {
        insertAtBottom: true,
        effectSourcePlayerUid: playerState.uid,
        effectSourceCardId: instance.gamecardId
      }
    );
    gameState.logs.push(`[${instance.id}] moved itself to the bottom of the deck at the end of the opponent turn.`);
  }
};

const card: Card = {
  id: '305000018',
  fullName: '不可侵犯结界',
  specialName: '',
  type: 'ITEM',
  color: 'YELLOW',
  gamecardId: null as any,
  colorReq: { YELLOW: 1 },
  faction: '无',
  acValue: 0,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  feijingMark: false,
  canResetCount: 0,
  effects: [effect_305000018_replace_damage, effect_305000018_return_to_deck],
  rarity: 'R',
  availableRarities: ['R'],
  cardPackage: 'BT01',
  uniqueId: null as any,
};

export default card;
