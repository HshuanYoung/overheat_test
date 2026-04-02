import { Card,GameState,PlayerState} from '../types/game';


const trigger_10400003_1 = (card: Card, gameState: GameState, playerState: PlayerState) => {

}
const card: Card = {
  id: '10401008',
  fullName: '四方剑仙 「北冥」',
  specialName: '北冥',
  type: 'UNIT',
  color: 'BLUE',
  gamecardId: null,
  colorReq: {'BLUE':2},
  faction: '无',
  acValue: 4,
  power: 3500,
  damage: 3,
  godMark: true,
  displayState: 'FRONT_UPRIGHT',
  isExhausted:false,
  isrush: false,
  canAttack: true,
  feijingMark: false,
  canResetCount: 0,
  effects: [
    {
      type: 'TRIGGER',
      description: '这个单位进入战场时，所有玩家抽1张卡。',
      playCost: 0,
      playColorReq: {'BLUE': 2},
      content: 'DRAW',
      execute:trigger_10400003_1,
    }
  ],
  imageUrl: '/pics/10401008_thumb.jpg',
  fullImageUrl: '/pics/10401008_full.jpg',
  rarity: 'SR',
};

export default card;
