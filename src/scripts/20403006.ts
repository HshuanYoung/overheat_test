import { Card, GameState, PlayerState } from '../types/game';

const card: Card = {
  id: '20403006',
  fullName: '接受委托',
  specialName: '',
  type: 'STORY',
  color: 'BLUE',
  gamecardId: null as any,
  colorReq: {},
  faction: '无',
  acValue: 1,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  feijingMark: false,
  canResetCount: 0,
  effects: [
    {
      id: 'accept_commission_effect',
      type: 'ACTIVATE',
      triggerLocation: ['PLAY'],
      description: '从你的侵蚀区中选择一个非神格且AC为3或以下的单位卡放置到战场。',
      atomicEffects: [
        {
          type: 'MOVE_FROM_EROSION',
          targetFilter: {
            godMark: false,
            type: 'UNIT',
            maxAc: 3,
            zone: ['EROSION_FRONT']
          },
          targetCount: 1,
          destinationZone: 'UNIT'
        }
      ]
    }
  ],
  rarity: 'U',
  availableRarities: ['U'],
  uniqueId: null,
};

export default card;
