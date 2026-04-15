import { Card, GameState, PlayerState, GameEvent } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';


const card: Card = {
  id: '10400003',
  fullName: '暮城的慈善家',
  specialName: '',
  type: 'UNIT',
  color: 'BLUE',
  gamecardId: null,
  colorReq: {},
  faction: '无',
  acValue: 1,
  power: 1000,
  damage: 0,
  baseDamage: 0,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  isExhausted: false,
  isrush: false,
  canAttack: true,
  feijingMark: false,
  canResetCount: 0,
  effects: [
    {
      id: 'philanthropist_draw',
      type: 'TRIGGER',
      triggerEvent: 'CARD_ENTERED_ZONE',
      isMandatory: true,
      description: '这张卡进入战场时，若你的战场上有2个或以上的蓝色单位，双方玩家抽1张卡。',
      condition: (gameState: GameState, playerState: PlayerState, instance: Card, event?: GameEvent) => {
        const isOnUnitZone = instance.cardlocation === 'UNIT';
        if (!event) return isOnUnitZone;

        const isSelf = event.type === 'CARD_ENTERED_ZONE' &&
          (event.sourceCardId === instance.gamecardId || event.sourceCard === instance);
        const isTargetZone = event.data?.zone === 'UNIT';

        if (!isSelf || !isTargetZone || !isOnUnitZone) return false;

        const blueUnits = playerState.unitZone.filter(c => c && AtomicEffectExecutor.matchesColor(c, 'BLUE'));
        return blueUnits.length >= 2;
      },
      cost: (gameState, playerState, card) => {
        return true;
      },
      execute: (card, gameState, playerState) => {
        // Both players draw 1 card
        AtomicEffectExecutor.execute(gameState, playerState.uid, {
          type: 'BOTH_PLAYERS_DRAW',
          value: 1
        }, card);
      }
    }
  ],
  rarity: 'U',
  availableRarities: ['U'],
  uniqueId: null,
};

export default card;
