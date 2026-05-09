import { Card, CardEffect } from '../types/game';

const effect_105120166_alchemy_buff: CardEffect = {
  id: '105120166_alchemy_buff',
  type: 'CONTINUOUS',
  description: '若这个单位因炼金效果从卡组进入战场，其变为力量3500 / 伤害3，并获得【速攻】和【英勇】。',
  applyContinuous: (_gameState, instance) => {
    if (
      (instance as any).data?.enteredFromDeckByAlchemyTurn === undefined ||
      (instance as any).data?.lastMovedFromZone !== 'DECK' ||
      (instance as any).data?.lastMovedToZone !== 'UNIT'
    ) {
      return;
    }
    instance.power = 3500;
    instance.damage = 3;
    instance.isrush = true;
    instance.isHeroic = true;
    instance.influencingEffects = instance.influencingEffects || [];
    instance.influencingEffects.push({
      sourceCardName: instance.fullName,
      description: '炼金登场：力量变为3500，伤害变为3，获得【速攻】【英勇】'
    });
  }
};

const card: Card = {
  id: '105120166',
  fullName: '炼金兽 翼蛇',
  specialName: '',
  type: 'UNIT',
  color: 'YELLOW',
  gamecardId: null as any,
  colorReq: { YELLOW: 1 },
  faction: '永生之乡',
  acValue: 3,
  power: 2500,
  basePower: 2500,
  damage: 2,
  baseDamage: 2,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  isExhausted: false,
  isrush: false,
  baseIsrush: false,
  isHeroic: false,
  baseHeroic: false,
  canAttack: true,
  feijingMark: false,
  canResetCount: 0,
  effects: [effect_105120166_alchemy_buff],
  rarity: 'R',
  availableRarities: ['R'],
  cardPackage: 'BT02',
  uniqueId: null as any,
};

export default card;
