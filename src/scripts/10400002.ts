import { Card,GameState,PlayerState} from '../types/game';


const activate_10400002_1 = (card: Card, gameState: GameState,playerState: PlayerState) => {
}

const card: Card = {
  id: '10400002',
  fullName: '翡翠水蜥',
  specialName: '',
  type: 'UNIT',
  color: 'BLUE',
  gamecardId: null,
  colorReq: {},
  faction: '无',
  acValue: 0,
  power: 1000,
  damage: 0,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  isExhausted:false,
  isrush: false,
  canAttack: false,
  feijingMark: false,
  canResetCount: 0,
  effects: [
    {
      type: 'ACTIVATE',
      description: '这个能力只能从侵蚀区发动，且不能用于对抗。将这张卡放置到战场上。',
      playCost: 0,
      triggerLocation: ['EROSION_FRONT'],
      content: 'PLAY',
      execute:activate_10400002_1,
    }
  ],
  imageUrl: '/pics/10400002_thumb.jpg',
  fullImageUrl: '/pics/10400002_full.jpg',
  rarity: 'U',
};


export default card;
