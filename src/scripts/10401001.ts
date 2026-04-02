import { Card,GameState,PlayerState} from '../types/game';


const trigger_10400003_1 = (card: Card, gameState: GameState, playerState: PlayerState) => {

}
const card: Card = {
  id: '10401001',
  fullName: '歌月丽人武者 「风花」',
  specialName: '风花',
  type: 'UNIT',
  color: 'BLUE',
  gamecardId: null,
  colorReq: {'BLUE':2},
  acValue: 3,
  power: 2500,
  damage: 2,
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
  imageUrl: '/pics/10401001_thumb.jpg',
  fullImageUrl: '/pics/10401001_full.jpg',
  rarity: 'SR',
  faction: '百濑之水城',
};

export default card;
