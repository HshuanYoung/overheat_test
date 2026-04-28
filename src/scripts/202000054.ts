import { Card, CardEffect } from '../types/game';
import { AtomicEffectExecutor, addTempDamage, attackingUnits, createSelectCardQuery, story } from './BaseUtil';

const cardEffects: CardEffect[] = [story('202000054_damage_boost', '选择战场上1个正在攻击的单位，这次战斗中伤害+2。', async (instance, gameState, playerState) => {
  const targets = attackingUnits(gameState);
  if (targets.length === 0) return;
  createSelectCardQuery(
    gameState,
    playerState.uid,
    targets,
    '选择攻击单位',
    '选择战场上的1个正在进行攻击的单位，这次战斗中伤害+2。',
    1,
    1,
    { sourceCardId: instance.gamecardId, effectId: '202000054_damage_boost' }
  );
}, {
  condition: gameState => gameState.phase === 'BATTLE_FREE' && attackingUnits(gameState).length > 0,
  onQueryResolve: async (instance, gameState, _playerState, selections) => {
    const target = selections[0] ? AtomicEffectExecutor.findCardById(gameState, selections[0]) : undefined;
    if (target?.cardlocation === 'UNIT') addTempDamage(target, instance, 2);
  }
})];

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 202000054
 * Card2 Row: 137
 * Card Row: 137
 * Source CardNo: BT02-R14
 * Package: BT02(U)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 选择战场上的1个正在进行攻击的单位，这次战斗中，〖伤害+2〗。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '202000054',
  fullName: '会心一击',
  specialName: '',
  type: 'STORY',
  color: 'RED',
  gamecardId: null as any,
  colorReq: { RED: 1 },
  faction: '无',
  acValue: 1,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  feijingMark: false,
  canResetCount: 0,
  effects: cardEffects,
  rarity: 'U',
  availableRarities: ['U'],
  cardPackage: 'BT02',
  uniqueId: null as any,
};

export default card;
