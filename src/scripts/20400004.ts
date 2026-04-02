import { Card,GameState,PlayerState} from '../types/game';


const trigger_10400003_1 = (card: Card, gameState: GameState, playerState: PlayerState) => {

}
const card: Card = {
  id: '20400004',
  fullName: '交易失败',
  specialName: '',
  type: 'STORY',
  color: 'BLUE',
  gamecardId: null,
  colorReq: {'BLUE':2},
  faction: '无',
  acValue: -2,
  godMark: false,
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
  imageUrl: '/pics/20400004_thumb.jpg',
  fullImageUrl: '/pics/20400004_full.jpg',
  rarity: 'U',
};

export default card;
