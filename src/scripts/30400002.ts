import { Card, GameState, PlayerState } from '../types/game';


const trigger_10400003_1 = (card: Card, gameState: GameState, playerState: PlayerState) => {

}
const card: Card = {
  id: '30400002',
  fullName: '水仙心法',
  specialName: '',
  type: 'ITEM',
  color: 'BLUE',
  gamecardId: null,
  colorReq: {},
  faction: '无',
  acValue: 1,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  feijingMark: false,
  canResetCount: 0,
  effects: [
    {
      type: 'TRIGGER',
      description: '这个单位进入战场时，所有玩家抽1张卡。',
      playCost: 0,
      playColorReq: { 'BLUE': 2 },
      content: 'DRAW',
      execute: trigger_10400003_1,
    }
  ],
  rarity: 'U',
  availableRarities: ['U'],
  uniqueId: null,
};

export default card;
