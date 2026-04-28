import { Card, CardEffect } from '../types/game';
import { AtomicEffectExecutor, addTempDamage, addTempPower, attackingUnits, createChoiceQuery, createSelectCardQuery, isBattleFreeContext, story } from './BaseUtil';

const cardEffects: CardEffect[] = [story('201000057_weaken', '选择1个参与攻击的单位，本回合伤害-1、力量-1000。之后若背面侵蚀1张以下，你可以抽1张卡。', async (instance, gameState, playerState) => {
  const targets = attackingUnits(gameState);
  if (targets.length === 0) return;
  createSelectCardQuery(
    gameState,
    playerState.uid,
    targets,
    '选择攻击单位',
    '选择战场上的1个参与攻击的单位，本回合中伤害-1、力量-1000。',
    1,
    1,
    { sourceCardId: instance.gamecardId, effectId: '201000057_weaken', step: 'TARGET' }
  );
}, {
  condition: gameState => isBattleFreeContext(gameState) && attackingUnits(gameState).length > 0,
  onQueryResolve: async (instance, gameState, playerState, selections, context) => {
    if (context?.step === 'DRAW_CHOICE') {
      if (selections[0] === 'YES') await AtomicEffectExecutor.execute(gameState, playerState.uid, { type: 'DRAW', value: 1 }, instance);
      return;
    }
    const target = selections[0] ? AtomicEffectExecutor.findCardById(gameState, selections[0]) : undefined;
    if (target?.cardlocation === 'UNIT') {
      addTempDamage(target, instance, -1);
      addTempPower(target, instance, -1000);
    }
    if (playerState.erosionBack.filter(Boolean).length <= 1) {
      createChoiceQuery(
        gameState,
        playerState.uid,
        '是否抽卡',
        '你的侵蚀区中的背面卡在1张以下。是否抽1张卡？',
        [{ id: 'YES', label: '抽1张卡' }, { id: 'NO', label: '不抽' }],
        { sourceCardId: instance.gamecardId, effectId: '201000057_weaken', step: 'DRAW_CHOICE' }
      );
    }
  }
})];

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 201000057
 * Card2 Row: 151
 * Card Row: 151
 * Source CardNo: BT02-W11
 * Package: BT02(C)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 选择战场上的1个参与攻击的单位，本回合中〖伤害-1〗〖力量-1000〗。之后，若你的侵蚀区中的背面卡在1张以下，你可以抽1张卡。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '201000057',
  fullName: '防御咒法',
  specialName: '',
  type: 'STORY',
  color: 'WHITE',
  gamecardId: null as any,
  colorReq: { WHITE: 1 },
  faction: '无',
  acValue: 1,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  feijingMark: false,
  canResetCount: 0,
  effects: cardEffects,
  rarity: 'C',
  availableRarities: ['C'],
  cardPackage: 'BT02',
  uniqueId: null as any,
};

export default card;
