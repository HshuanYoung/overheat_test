import { Card, GameState, PlayerState, GameEvent } from '../types/game';


const trigger_10400003_1 = (card: Card, gameState: GameState, playerState: PlayerState) => {

}
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
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  isExhausted:false,
  isrush: false,
  canAttack: true,
  feijingMark: false,
  canResetCount: 0,
  effects: [
    {
      id: ' philanthropist_draw',
      type: 'TRIGGER',
      triggerEvent: 'CARD_ENTERED_ZONE',
      isMandatory: true,
      description: '这张卡进入战场时，若你的战场上有2个或以上的蓝色区域（包括侵蚀区和道具区），双方玩家抽1张卡。',
      condition: (gameState: GameState, playerState: PlayerState, card: Card, event?: GameEvent) => {
        if (event?.type !== 'CARD_ENTERED_ZONE' || event?.sourceCardId !== card.gamecardId) return false;
        if (event?.data?.zone !== 'UNIT') return false;

        // Count blue zones (Unit, Item, Erosion) on your side
        let blueCount = 0;
        const zones = [...playerState.unitZone, ...playerState.itemZone, ...playerState.erosionFront, ...playerState.erosionBack];
        zones.forEach(c => {
          if (c && c.color === 'BLUE') blueCount++;
        });
        return blueCount >= 2;
      },
      atomicEffects: [
        {
          type: 'BOTH_PLAYERS_DRAW',
          value: 1
        }
      ]
    }
  ],
  imageUrl: '/pics/10400003_thumb.jpg',
  fullImageUrl: '/pics/10400003_full.jpg',
  rarity: 'U',
};

export default card;
