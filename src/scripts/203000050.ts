import { Card, CardEffect } from '../types/game';
import { AtomicEffectExecutor, addTempPower, allUnitsOnField, createChoiceQuery, createSelectCardQuery, story } from './BaseUtil';

const cardEffects: CardEffect[] = [story('203000050_power_draw', '选择战场上1个单位，本回合力量+1000。之后若背面侵蚀5张以上，你可以抽1张卡。', async (instance, gameState, playerState) => {
  const targets = allUnitsOnField(gameState);
  if (targets.length === 0) return;
  createSelectCardQuery(
    gameState,
    playerState.uid,
    targets,
    '选择单位',
    '选择战场上的1个单位，本回合中力量+1000。',
    1,
    1,
    { sourceCardId: instance.gamecardId, effectId: '203000050_power_draw', step: 'TARGET' },
    () => 'UNIT'
  );
}, {
  targetSpec: {
    title: '选择单位',
    description: '选择战场上的1个单位，本回合中力量+1000。',
    minSelections: 1,
    maxSelections: 1,
    zones: ['UNIT'],
    step: 'TARGET',
    getCandidates: gameState => allUnitsOnField(gameState).map(card => ({ card, source: 'UNIT' as any }))
  },
  onQueryResolve: async (instance, gameState, playerState, selections, context) => {
    if (context?.step === 'DRAW_CHOICE') {
      if (selections[0] === 'YES') await AtomicEffectExecutor.execute(gameState, playerState.uid, { type: 'DRAW', value: 1 }, instance);
      return;
    }
    const target = selections[0] ? AtomicEffectExecutor.findCardById(gameState, selections[0]) : undefined;
    if (target?.cardlocation === 'UNIT') addTempPower(target, instance, 1000);
    if (playerState.erosionBack.filter(Boolean).length >= 5) {
      createChoiceQuery(
        gameState,
        playerState.uid,
        '是否抽卡',
        '你的侵蚀区的背面卡有5张以上。是否抽1张卡？',
        [{ id: 'YES', label: '抽1张卡' }, { id: 'NO', label: '不抽' }],
        { sourceCardId: instance.gamecardId, effectId: '203000050_power_draw', step: 'DRAW_CHOICE' }
      );
    }
  }
})];

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 203000050
 * Card2 Row: 119
 * Card Row: 119
 * Source CardNo: BT02-G13
 * Package: BT02(U),ST02(TD)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 选择战场上的1个单位，本回合中〖力量+1000〗。之后，若你的侵蚀区的背面卡有5张以上，你可以抽1张卡。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '203000050',
  fullName: '困兽犹斗',
  specialName: '',
  type: 'STORY',
  color: 'GREEN',
  gamecardId: null as any,
  colorReq: { GREEN: 1 },
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
