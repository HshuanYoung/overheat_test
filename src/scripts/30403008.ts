import { Card, GameState, PlayerState, CardEffect } from '../types/game';

const card: Card = {
  id: '30403008',
  fullName: '文的特制汤药',
  specialName: '',
  type: 'ITEM',
  color: 'BLUE',
  gamecardId: null as any,
  colorReq: { BLUE: 1 },
  faction: '冒险家公会',
  acValue: 1,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  feijingMark: false,
  canResetCount: 0,
  effects: [
    {
      id: 'wen_decoction_substitute',
      type: 'CONTINUOUS',
      limitCount: 1,
      limitNameType: true,
      description: '【同名回合1次】自己战场上的「冒险家公会」单位即将被破坏时，你可以选择发动，将这张卡送入墓地作为代替。',
      substitutionFilter: {
        faction: '冒险家公会',
        onField: true
      }
    }
  ],
  rarity: 'C',
  availableRarities: ['C'],
  uniqueId: null as any,
};

export default card;
