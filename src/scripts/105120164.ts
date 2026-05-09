import { Card, CardEffect } from '../types/game';

const effect_105120164_alchemy_buff: CardEffect = {
  id: '105120164_alchemy_buff',
  type: 'CONTINUOUS',
  description: '若这个单位因炼金效果从卡组进入战场，其变为力量3500 / 伤害2，并获得【速攻】和【歼灭】。',
  applyContinuous: (_gameState, instance) => {
    if (
      (instance as any).data?.enteredFromDeckByAlchemyTurn === undefined ||
      (instance as any).data?.lastMovedFromZone !== 'DECK' ||
      (instance as any).data?.lastMovedToZone !== 'UNIT'
    ) {
      return;
    }
    instance.power = 3500;
    instance.damage = 2;
    instance.isrush = true;
    instance.isAnnihilation = true;
    instance.influencingEffects = instance.influencingEffects || [];
    instance.influencingEffects.push({
      sourceCardName: instance.fullName,
      description: '炼金登场：力量变为3500，伤害变为2，获得【速攻】【歼灭】'
    });
  }
};

const card: Card = {
  id: '105120164',
  fullName: '炼金兽 银刃狼',
  specialName: '',
  type: 'UNIT',
  color: 'YELLOW',
  gamecardId: null as any,
  colorReq: {},
  faction: '永生之乡',
  acValue: 2,
  power: 2000,
  basePower: 2000,
  damage: 1,
  baseDamage: 1,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  isExhausted: false,
  isrush: false,
  baseIsrush: false,
  isAnnihilation: false,
  baseAnnihilation: false,
  canAttack: true,
  feijingMark: false,
  canResetCount: 0,
  effects: [effect_105120164_alchemy_buff],
  rarity: 'U',
  availableRarities: ['U'],
  cardPackage: 'BT02',
  uniqueId: null as any,
};

export default card;
