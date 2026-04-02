import { Card,GameState,PlayerState} from '../types/game';


const trigger_10400003_1 = (card: Card, gameState: GameState, playerState: PlayerState) => {

}
const card: Card = {
  id: '30401001',
  fullName: '「小太刀——歌月」',
  specialName: '小太刀——歌月',
  type: 'ITEM',
  color: 'BLUE',
  gamecardId: null,
  colorReq: {'BLUE':2},
  faction: '无',
  acValue: 3,
  godMark: true,
  displayState: 'FRONT_UPRIGHT',
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
  imageUrl: '/pics/30401001_thumb.jpg',
  fullImageUrl: '/pics/30401001_full.jpg',
  rarity: 'R',
};

export default card;
