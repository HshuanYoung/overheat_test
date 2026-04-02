import { Card,GameState,PlayerState} from '../types/game';


const trigger_10400003_1 = (card: Card, gameState: GameState, playerState: PlayerState) => {

}
const card: Card = {
  id: '10401004',
  fullName: '剑仙子',
  specialName: '',
  type: 'UNIT',
  color: 'BLUE',
  gamecardId: null,
  colorReq: {},
  acValue: 2,
  power: 1000,
  damage: 1,
  godMark: false,
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
  imageUrl: '/pics/10401002_thumb.jpg',
  fullImageUrl: '/pics/10401002_full.jpg',
  rarity: 'SR',
  faction: '百濑之水城',
};

export default card;
