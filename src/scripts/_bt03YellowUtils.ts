import { Card, CardEffect, GameState, PlayerState, TriggerLocation } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';
import { EventEngine } from '../services/EventEngine';

const VIRTUAL_GOD_MARK_IDS = new Set(['105000472', '105000473']);

export const getOpponentUid = (gameState: GameState, playerUid: string) =>
  Object.keys(gameState.players).find(uid => uid !== playerUid)!;

export const getTopDeckCards = (player: PlayerState, count: number) =>
  player.deck.slice(-count).reverse();

export const revealDeckCards = (gameState: GameState, playerUid: string, count: number, sourceCard?: Card) => {
  const cards = getTopDeckCards(gameState.players[playerUid], count);
  const hasPuppetRevealBoost =
    !!sourceCard &&
    sourceCard.fullName.includes('魔偶') &&
    gameState.players[playerUid].unitZone.some(unit => unit && unit.id === '105000446');

  if (hasPuppetRevealBoost) {
    cards.forEach(card => {
      (card as any).data = {
        ...((card as any).data || {}),
        bt04PuppetRevealTurn: gameState.turnCount,
        bt04PuppetRevealPlayerUid: playerUid,
        bt04PuppetRevealSourceCardId: sourceCard.gamecardId
      };
    });
  }
  if (cards.length > 0) {
    EventEngine.dispatchEvent(gameState, {
      type: 'REVEAL_DECK',
      playerUid,
      data: {
        cards,
        sourceCardId: sourceCard?.gamecardId,
        sourceCardName: sourceCard?.fullName
      }
    });
  }
  return cards;
};

export const shuffleAndRevealTopCards = async (
  gameState: GameState,
  playerUid: string,
  count: number,
  sourceCard?: Card
) => {
  await AtomicEffectExecutor.execute(gameState, playerUid, { type: 'SHUFFLE_DECK' }, sourceCard);
  return revealDeckCards(gameState, playerUid, count, sourceCard);
};

export const isVirtualGodMarkReveal = (gameState: GameState, card: Card | undefined) =>
  !!card &&
  (
    card.godMark ||
    VIRTUAL_GOD_MARK_IDS.has(String(card.id)) ||
    (card as any).data?.bt04PuppetRevealTurn === gameState.turnCount
  );

export const createSelectCardQuery = (
  gameState: GameState,
  playerUid: string,
  cards: Card[],
  title: string,
  description: string,
  minSelections: number,
  maxSelections: number,
  context: any,
  sourceResolver?: (card: Card) => TriggerLocation
) => {
  gameState.pendingQuery = {
    id: Math.random().toString(36).substring(7),
    type: 'SELECT_CARD',
    playerUid,
    options: AtomicEffectExecutor.enrichQueryOptions(
      gameState,
      playerUid,
      cards.map(card => ({
        card,
        source: sourceResolver ? sourceResolver(card) : (card.cardlocation as TriggerLocation)
      }))
    ),
    title,
    description,
    minSelections,
    maxSelections,
    callbackKey: 'EFFECT_RESOLVE',
    context
  };
};

export const createChoiceQuery = (
  gameState: GameState,
  playerUid: string,
  title: string,
  description: string,
  options: { id: string; label: string }[],
  context: any
) => {
  gameState.pendingQuery = {
    id: Math.random().toString(36).substring(7),
    type: 'SELECT_CHOICE',
    playerUid,
    options,
    title,
    description,
    minSelections: 1,
    maxSelections: 1,
    callbackKey: 'EFFECT_RESOLVE',
    context
  };
};

export const moveCard = (
  gameState: GameState,
  ownerUid: string,
  card: Card,
  toZone: TriggerLocation,
  sourceCard?: Card,
  options?: { insertAtBottom?: boolean; faceDown?: boolean; toPlayerUid?: string }
) => {
  const targetPlayerUid = options?.toPlayerUid || ownerUid;
  AtomicEffectExecutor.moveCard(
    gameState,
    ownerUid,
    card.cardlocation as TriggerLocation,
    targetPlayerUid,
    toZone,
    card.gamecardId,
    true,
    {
      insertAtBottom: options?.insertAtBottom,
      faceDown: options?.faceDown,
      effectSourcePlayerUid: (sourceCard ? AtomicEffectExecutor.findCardOwnerKey(gameState, sourceCard.gamecardId) : ownerUid) || ownerUid,
      effectSourceCardId: sourceCard?.gamecardId
    }
  );
};

export const moveCardsToBottom = (
  gameState: GameState,
  ownerUid: string,
  cards: Card[],
  sourceCard?: Card
) => {
  cards.forEach(card => moveCard(gameState, ownerUid, card, 'DECK', sourceCard, { insertAtBottom: true }));
};

export const getBattlefieldUnits = (gameState: GameState) =>
  Object.values(gameState.players).flatMap(player => player.unitZone.filter((card): card is Card => !!card));

export const getBattlefieldCards = (gameState: GameState) =>
  Object.values(gameState.players).flatMap(player => [
    ...player.unitZone.filter((card): card is Card => !!card),
    ...player.itemZone.filter((card): card is Card => !!card)
  ]);

export const findUnitOnBattlefield = (gameState: GameState, gamecardId?: string) => {
  if (!gamecardId) return undefined;
  return getBattlefieldUnits(gameState).find(card => card.gamecardId === gamecardId);
};

export const canPutUnitOntoBattlefield = (player: PlayerState, card: Card) =>
  player.unitZone.some(slot => slot === null) &&
  (!card.specialName || !player.unitZone.some(unit => unit?.specialName === card.specialName));

export const canPutItemOntoBattlefield = (player: PlayerState, card: Card) =>
  !card.specialName || !player.itemZone.some(item => item?.specialName === card.specialName);

export const hasTruthUnit = (player: PlayerState) =>
  player.unitZone.some(unit => unit && unit.type === 'UNIT' && (unit.specialName === '真理' || unit.fullName.includes('真理')));

export const getOnlyGodMarkUnit = (player: PlayerState) => {
  const godmarkUnits = player.unitZone.filter((unit): unit is Card => !!unit && unit.godMark);
  return godmarkUnits.length === 1 ? godmarkUnits[0] : undefined;
};

export const countItemTypes = (player: PlayerState) =>
  new Set(player.itemZone.filter((card): card is Card => !!card).map(card => card.id)).size;

export const universalEquipEffect: CardEffect = {
  id: 'equip_universal',
  type: 'ACTIVATE',
  description: '主要阶段中，选择你的1个单位装备这张卡，或解除装备状态。',
  limitCount: 1,
  limitNameType: false,
  triggerLocation: ['ITEM'],
  condition: gameState => gameState.phase === 'MAIN',
  execute: async (card, gameState, playerState) => {
    const currentTargetId = card.equipTargetId;
    const options = currentTargetId
      ? [{ card, source: 'ITEM' as const }]
      : playerState.unitZone
          .filter((unit): unit is Card => !!unit)
          .map(unit => ({ card: unit, source: 'UNIT' as const }));

    if (options.length === 0) return;

    gameState.pendingQuery = {
      id: Math.random().toString(36).substring(7),
      type: 'SELECT_CARD',
      playerUid: playerState.uid,
      options: AtomicEffectExecutor.enrichQueryOptions(gameState, playerState.uid, options),
      title: currentTargetId ? '解除装备' : '选择装备目标',
      description: currentTargetId ? '选择这张卡自身以解除装备。' : `选择1个单位装备 ${card.fullName}。`,
      minSelections: 1,
      maxSelections: 1,
      callbackKey: 'EFFECT_RESOLVE',
      context: {
        sourceCardId: card.gamecardId,
        effectId: 'equip_universal'
      }
    };
  },
  onQueryResolve: async (card, gameState, playerState, selections) => {
    const selectedId = selections[0];
    if (selectedId === card.gamecardId) {
      card.equipTargetId = undefined;
      EventEngine.recalculateContinuousEffects(gameState);
      return;
    }

    const target = playerState.unitZone.find(unit => unit?.gamecardId === selectedId);
    if (!target) return;

    card.equipTargetId = target.gamecardId;
    EventEngine.recalculateContinuousEffects(gameState);
  }
};

const ownerOf = (gameState: GameState, card: Card) =>
  Object.values(gameState.players).find(player =>
    [...player.hand, ...player.deck, ...player.grave, ...player.exile, ...player.unitZone, ...player.itemZone, ...player.erosionFront, ...player.erosionBack, ...player.playZone]
      .some(candidate => candidate?.gamecardId === card.gamecardId)
  );

const ownerUidOf = (gameState: GameState, card: Card) =>
  Object.entries(gameState.players).find(([, player]) =>
    [...player.hand, ...player.deck, ...player.grave, ...player.exile, ...player.unitZone, ...player.itemZone, ...player.erosionFront, ...player.erosionBack, ...player.playZone]
      .some(candidate => candidate?.gamecardId === card.gamecardId)
  )?.[0];

const allCardsOnField = (gameState: GameState) =>
  Object.values(gameState.players).flatMap(player => [
    ...player.unitZone.filter((card): card is Card => !!card),
    ...player.itemZone.filter((card): card is Card => !!card)
  ]);

const allUnitsOnField = (gameState: GameState) =>
  Object.values(gameState.players).flatMap(player => player.unitZone.filter((card): card is Card => !!card));

const ownUnits = (player: PlayerState) => player.unitZone.filter((card): card is Card => !!card);
const ownItems = (player: PlayerState) => player.itemZone.filter((card): card is Card => !!card);
const faceUpErosion = (player: PlayerState) =>
  player.erosionFront.filter((card): card is Card => !!card && card.displayState === 'FRONT_UPRIGHT');
const backErosionCount = (player: PlayerState) => player.erosionBack.filter(card => !!card).length;
const totalErosionCount = (player: PlayerState) => faceUpErosion(player).length + backErosionCount(player);
const isFaction = (card: Card, faction: string) => card.faction === faction;
const isNonGodUnit = (card: Card) => card.type === 'UNIT' && !card.godMark;
const isNonGodFieldCard = (card: Card) => !card.godMark && (card.type === 'UNIT' || card.type === 'ITEM' || card.isEquip);

const ensureData = (card: Card) => {
  (card as any).data = (card as any).data || {};
  return (card as any).data;
};

const addInfluence = (card: Card, source: Card, description: string) => {
  card.influencingEffects = card.influencingEffects || [];
  if (!card.influencingEffects.some(effect => effect.sourceCardName === source.fullName && effect.description === description)) {
    card.influencingEffects.push({ sourceCardName: source.fullName, description });
  }
};

const addContinuousPower = (target: Card, source: Card, amount: number) => {
  target.power = (target.power || 0) + amount;
  addInfluence(target, source, `力量${amount >= 0 ? '+' : ''}${amount}`);
};

const addContinuousDamage = (target: Card, source: Card, amount: number) => {
  target.damage = (target.damage || 0) + amount;
  addInfluence(target, source, `伤害${amount >= 0 ? '+' : ''}${amount}`);
};

const addTempPower = (target: Card, source: Card, amount: number) => {
  target.temporaryPowerBuff = (target.temporaryPowerBuff || 0) + amount;
  target.power = (target.power || 0) + amount;
  target.temporaryBuffSources = { ...(target.temporaryBuffSources || {}), power: source.fullName };
  const details = target.temporaryBuffDetails?.power || [];
  details.push({ sourceCardName: source.fullName, value: amount });
  target.temporaryBuffDetails = { ...(target.temporaryBuffDetails || {}), power: details };
};

const addTempDamage = (target: Card, source: Card, amount: number) => {
  target.temporaryDamageBuff = (target.temporaryDamageBuff || 0) + amount;
  target.damage = (target.damage || 0) + amount;
  target.temporaryBuffSources = { ...(target.temporaryBuffSources || {}), damage: source.fullName };
};

const addTempKeyword = (target: Card, source: Card, keyword: 'rush' | 'heroic' | 'annihilation') => {
  target.temporaryBuffSources = target.temporaryBuffSources || {};
  if (keyword === 'rush') {
    target.temporaryRush = true;
    target.isrush = true;
    target.temporaryBuffSources.rush = source.fullName;
  } else if (keyword === 'heroic') {
    target.temporaryHeroic = true;
    target.isHeroic = true;
    target.temporaryBuffSources.heroic = source.fullName;
  } else {
    target.isAnnihilation = true;
    addInfluence(target, source, '获得效果: 【歼灭】');
  }
};

const moveByEffect = (
  gameState: GameState,
  card: Card,
  toZone: TriggerLocation,
  source: Card,
  options?: { toPlayerUid?: string; insertAtBottom?: boolean; faceDown?: boolean }
) => {
  const fromUid = ownerUidOf(gameState, card);
  if (!fromUid) return;
  moveCard(gameState, fromUid, card, toZone, source, options);
};

const moveTopDeckTo = (gameState: GameState, playerUid: string, count: number, toZone: TriggerLocation, source: Card, faceDown?: boolean) => {
  const player = gameState.players[playerUid];
  getTopDeckCards(player, count).forEach(card => moveCard(gameState, playerUid, card, toZone, source, { faceDown }));
};

const millTop = (gameState: GameState, playerUid: string, count: number, source: Card) => {
  const player = gameState.players[playerUid];
  getTopDeckCards(player, count).forEach(card => moveCard(gameState, playerUid, card, 'GRAVE', source));
};

const damagePlayerByEffect = async (gameState: GameState, sourcePlayerUid: string, targetPlayerUid: string, amount: number, source: Card) => {
  await AtomicEffectExecutor.execute(
    gameState,
    sourcePlayerUid,
    { type: targetPlayerUid === sourcePlayerUid ? 'DEAL_EFFECT_DAMAGE_SELF' as any : 'DEAL_EFFECT_DAMAGE', value: amount },
    source
  );
};

const dealUnpreventableSelfDamage = (gameState: GameState, playerUid: string, amount: number, source: Card) => {
  const player = gameState.players[playerUid];
  if (player.deck.length < amount) {
    gameState.gameStatus = 2;
    gameState.winReason = 'DECK_OUT_EFFECT_DAMAGE';
    gameState.winnerId = gameState.playerIds.find(id => id !== playerUid);
    return;
  }
  for (let i = 0; i < amount; i += 1) {
    const card = player.deck.pop();
    if (!card) continue;
    card.cardlocation = player.isGoddessMode ? 'GRAVE' : 'EROSION_FRONT';
    card.displayState = 'FRONT_UPRIGHT';
    if (player.isGoddessMode) {
      player.grave.push(card);
    } else {
      const emptyIndex = player.erosionFront.findIndex(slot => slot === null);
      if (emptyIndex !== -1) player.erosionFront[emptyIndex] = card;
      else player.erosionFront.push(card);
    }
  }
  gameState.logs.push(`[${source.fullName}] 对自己造成 ${amount} 点不能防止的效果伤害。`);
};

const destroyByEffect = (gameState: GameState, target: Card, source: Card) => {
  const uid = ownerUidOf(gameState, target);
  if (!uid) return;
  moveCard(gameState, uid, target, 'GRAVE', source);
  gameState.logs.push(`[${source.fullName}] 破坏了 [${target.fullName}]。`);
};

const exileByEffect = (gameState: GameState, target: Card, source: Card) => {
  const uid = ownerUidOf(gameState, target);
  if (!uid) return;
  moveCard(gameState, uid, target, 'EXILE', source);
  gameState.logs.push(`[${source.fullName}] 放逐了 [${target.fullName}]。`);
};

const paymentCost = (amount: number, color?: string): CardEffect['cost'] => async (gameState, playerState, instance) => {
  gameState.pendingQuery = {
    id: Math.random().toString(36).substring(7),
    type: 'SELECT_PAYMENT',
    playerUid: playerState.uid,
    options: [],
    title: '支付费用',
    description: `支付 ${amount} 费以发动 ${instance.fullName}。`,
    minSelections: 1,
    maxSelections: 1,
    callbackKey: 'ACTIVATE_COST_RESOLVE',
    paymentCost: amount,
    paymentColor: color || instance.color,
    context: { sourceCardId: instance.gamecardId }
  };
  return true;
};

const exhaustCost: CardEffect['cost'] = async (_gameState, _playerState, instance) => {
  if (instance.isExhausted) return false;
  instance.isExhausted = true;
  return true;
};

const searchDeckEffect = (id: string, description: string, predicate: (card: Card, source: Card) => boolean): CardEffect => ({
  id,
  type: 'TRIGGER',
  triggerEvent: 'CARD_ENTERED_ZONE',
  triggerLocation: ['UNIT'],
  description,
  condition: (_gameState, _playerState, instance, event) =>
    event?.sourceCardId === instance.gamecardId && event.data?.zone === 'UNIT',
  execute: async (instance, gameState, playerState) => {
    const candidates = playerState.deck.filter(card => predicate(card, instance));
    if (candidates.length === 0) return;
    createSelectCardQuery(
      gameState,
      playerState.uid,
      candidates,
      '选择加入手牌的卡',
      description,
      0,
      1,
      { sourceCardId: instance.gamecardId, effectId: id },
      () => 'DECK'
    );
  },
  onQueryResolve: async (instance, gameState, playerState, selections) => {
    const selected = selections[0] ? AtomicEffectExecutor.findCardById(gameState, selections[0]) : undefined;
    if (selected?.cardlocation === 'DECK') {
      moveCard(gameState, playerState.uid, selected, 'HAND', instance);
      await AtomicEffectExecutor.execute(gameState, playerState.uid, { type: 'SHUFFLE_DECK' }, instance);
    }
  }
});

const story = (id: string, description: string, execute: CardEffect['execute'], extra?: Partial<CardEffect>): CardEffect => ({
  id,
  type: 'ACTIVATE',
  triggerLocation: ['PLAY'],
  description,
  execute,
  ...extra
});

const appendEndResolution = (
  gameState: GameState,
  playerUid: string,
  source: Card,
  id: string,
  resolve: CardEffect['resolve'],
  event?: any
) => {
  gameState.pendingResolutions = gameState.pendingResolutions || [];
  gameState.pendingResolutions.push({
    card: source,
    playerUid,
    event,
    effectIndex: 0,
    effect: {
      id,
      type: 'TRIGGER',
      description: '回合结束时处理延迟效果。',
      resolve
    }
  });
};

const BT01_EFFECTS: Record<string, (card: Card) => CardEffect[]> = {
  '101100096': () => [{
    id: '101100096_alliance_protect',
    type: 'CONTINUOUS',
    description: '此单位参与的联军攻击中，你的白色联军单位不会被破坏。',
    applyContinuous: (gameState, instance) => {
      const owner = ownerOf(gameState, instance);
      if (!owner || !gameState.battleState?.isAlliance || !gameState.battleState.attackers.includes(instance.gamecardId)) return;
      gameState.battleState.attackers
        .map(id => owner.unitZone.find(unit => unit?.gamecardId === id))
        .filter((unit): unit is Card => !!unit && AtomicEffectExecutor.matchesColor(unit, 'WHITE'))
        .forEach(unit => {
          (unit as any).battleImmuneByEffect = true;
          addInfluence(unit, instance, '联军攻击中不会被破坏');
        });
    }
  }, {
    id: '101100096_reset_after_attack',
    type: 'TRIGGER',
    triggerEvent: 'PHASE_CHANGED',
    triggerLocation: ['UNIT'],
    limitCount: 1,
    description: '此单位参与的攻击结束后，支付1费：将你的所有参战单位重置。',
    condition: (gameState, _playerState, instance, event) =>
      event?.data?.phase === 'MAIN' &&
      Array.isArray(ensureData(instance).bt01LastAllianceAttackIds) &&
      ensureData(instance).bt01LastAllianceAttackTurn === gameState.turnCount,
    cost: paymentCost(1, 'WHITE'),
    execute: async (instance, gameState, playerState) => {
      const ids = ensureData(instance).bt01LastAllianceAttackIds || [];
      ids.forEach((id: string) => {
        const unit = playerState.unitZone.find(card => card?.gamecardId === id);
        if (unit) {
          unit.isExhausted = false;
          addInfluence(unit, instance, '因效果重置');
        }
      });
      delete ensureData(instance).bt01LastAllianceAttackIds;
      delete ensureData(instance).bt01LastAllianceAttackTurn;
    }
  }, {
    id: '101100096_track_attack',
    type: 'TRIGGER',
    triggerEvent: 'CARD_ATTACK_DECLARED',
    triggerLocation: ['UNIT'],
    description: '记录此单位参与的攻击，用于攻击结束重置。',
    isMandatory: true,
    condition: (_gameState, _playerState, instance, event) => !!event?.data?.attackerIds?.includes(instance.gamecardId),
    execute: async (instance, gameState, _playerState, event) => {
      ensureData(instance).bt01LastAllianceAttackIds = event?.data?.attackerIds || [];
      ensureData(instance).bt01LastAllianceAttackTurn = gameState.turnCount;
    }
  }, {
    id: '101100096_ten_bottom',
    type: 'ACTIVATE',
    triggerLocation: ['UNIT'],
    limitCount: 1,
    limitGlobal: true,
    erosionTotalLimit: [10, 99],
    description: '10+，1游戏1次，侵蚀1：选择墓地6张卡放到卡组底。',
    cost: async (gameState, playerState, instance) => {
      await damagePlayerByEffect(gameState, playerState.uid, playerState.uid, 1, instance);
      return true;
    },
    execute: async (instance, gameState, playerState) => {
      playerState.grave.slice(0, 6).forEach(card => moveCard(gameState, playerState.uid, card, 'DECK', instance, { insertAtBottom: true }));
    }
  }],
  '101130102': () => [{
    id: '101130102_alliance_bottom',
    type: 'TRIGGER',
    triggerEvent: 'CARD_DESTROYED_BATTLE',
    triggerLocation: ['UNIT'],
    description: '此单位参与的联军攻击中战斗破坏对手单位时，可以将墓地1张卡放到卡组底。',
    condition: (_gameState, playerState, instance, event) =>
      event?.playerUid !== playerState.uid &&
      event?.data?.isAlliance &&
      event.data.attackerIds?.includes(instance.gamecardId),
    execute: async (instance, gameState, playerState) => {
      const target = playerState.grave[0];
      if (target) moveCard(gameState, playerState.uid, target, 'DECK', instance, { insertAtBottom: true });
    }
  }],
  '203090028': () => [story('203090028_forced_battle', '主要阶段使用：选择你的1个单位和对手1个非神蚀单位，直接进行伤害判定。', async (instance, gameState, playerState) => {
    const attacker = ownUnits(playerState).find(unit => !unit.isExhausted);
    const opponent = gameState.players[getOpponentUid(gameState, playerState.uid)];
    const defender = ownUnits(opponent).find(unit => !unit.godMark);
    if (!attacker || !defender) return;

    const attackerPower = attacker.power || 0;
    const defenderPower = defender.power || 0;
    if (attackerPower > defenderPower) {
      destroyByEffect(gameState, defender, instance);
    } else if (attackerPower < defenderPower) {
      destroyByEffect(gameState, attacker, instance);
    } else {
      destroyByEffect(gameState, attacker, instance);
      destroyByEffect(gameState, defender, instance);
    }
  }, {
    condition: (gameState, playerState) =>
      gameState.phase === 'MAIN' &&
      playerState.isTurn &&
      ownUnits(playerState).some(unit => !unit.isExhausted) &&
      ownUnits(gameState.players[getOpponentUid(gameState, playerState.uid)]).some(unit => !unit.godMark)
  })],
  '103090074': () => [searchDeckEffect('103090074_search', '入场时，可以从卡组将1张卡名含有《银乐器》的卡加入手牌。', card => card.fullName.includes('银乐器'))],
  '103090075': () => [searchDeckEffect('103090075_search', '入场时，可以从卡组将1张《风车守望者》以外的<瑟诺布>单位加入手牌。', card => card.type === 'UNIT' && card.faction === '瑟诺布' && card.fullName !== '风车守望者')],
  '103090077': () => [{
    id: '103090077_buff',
    type: 'CONTINUOUS',
    description: '若你的战场上的<瑟诺布>单位有3个以上，这个单位伤害+1、力量+1000。',
    applyContinuous: (gameState, instance) => {
      const owner = ownerOf(gameState, instance);
      if (!owner || ownUnits(owner).filter(unit => unit.faction === '瑟诺布').length < 3) return;
      addContinuousDamage(instance, instance, 1);
      addContinuousPower(instance, instance, 1000);
    }
  }],
  '103090078': () => [{
    id: '103090078_attack_gate',
    type: 'CONTINUOUS',
    description: '你的<瑟诺布>单位少于2个时，不能宣言攻击和防御。',
    applyContinuous: (gameState, instance) => {
      const owner = ownerOf(gameState, instance);
      if (!owner || ownUnits(owner).filter(unit => unit.faction === '瑟诺布').length >= 2) return;
      (instance as any).battleForbiddenByEffect = true;
      addInfluence(instance, instance, '不能宣言攻击和防御');
    }
  }, {
    id: '103090078_destroy_later',
    type: 'ACTIVATE',
    triggerLocation: ['UNIT'],
    limitCount: 1,
    limitNameType: true,
    description: '主要阶段，支付1费并横置：选择对手1个力量不高于此单位的非神蚀单位，回合结束时破坏。',
    condition: (gameState, playerState, instance) => playerState.isTurn && gameState.phase === 'MAIN' && !instance.isExhausted,
    cost: async (gameState, playerState, instance) => {
      const paid = await paymentCost(1, 'GREEN')!(gameState, playerState, instance);
      instance.isExhausted = true;
      return paid;
    },
    execute: async (instance, gameState, playerState) => {
      const opponent = gameState.players[getOpponentUid(gameState, playerState.uid)];
      const target = ownUnits(opponent).find(unit => !unit.godMark && (unit.power || 0) <= (instance.power || 0));
      if (!target) return;
      ensureData(target).bt01DestroyAtEndBy = instance.fullName;
      addInfluence(target, instance, '回合结束时破坏');
      appendEndResolution(gameState, playerState.uid, instance, '103090078_end_destroy', (source, state) => {
        const live = AtomicEffectExecutor.findCardById(state, target.gamecardId);
        if (live) destroyByEffect(state, live, source);
      });
    }
  }],
  '103090079': () => [{
    id: '103090079_revive',
    type: 'TRIGGER',
    triggerEvent: 'CARD_ENTERED_ZONE',
    triggerLocation: ['UNIT'],
    limitCount: 1,
    limitNameType: true,
    erosionTotalLimit: [6, 8],
    description: '入场时，选择墓地中1个力量2000以下的绿色非神蚀单位放置到战场上。',
    condition: (_gameState, _playerState, instance, event) => event?.sourceCardId === instance.gamecardId && event.data?.zone === 'UNIT',
    execute: async (instance, gameState, playerState) => {
      const target = playerState.grave.find(card => isNonGodUnit(card) && card.color === 'GREEN' && (card.power || 0) <= 2000 && canPutUnitOntoBattlefield(playerState, card));
      if (target) moveCard(gameState, playerState.uid, target, 'UNIT', instance);
    }
  }],
  '103000080': () => [{
    id: '103000080_mill_revive',
    type: 'ACTIVATE',
    triggerLocation: ['UNIT'],
    description: '放逐此单位：将卡组顶3张送入墓地，之后从那3张中将1个力量2500以下的非神蚀单位放置到战场上。',
    condition: (_gameState, playerState) => ownUnits(playerState).filter(unit => AtomicEffectExecutor.matchesColor(unit, 'GREEN')).length >= 2,
    cost: async (gameState, playerState, instance) => {
      moveCard(gameState, playerState.uid, instance, 'EXILE', instance);
      return true;
    },
    execute: async (instance, gameState, playerState) => {
      const milled = getTopDeckCards(playerState, 3);
      milled.forEach(card => moveCard(gameState, playerState.uid, card, 'GRAVE', instance));
      const target = milled.find(card => playerState.grave.some(grave => grave.gamecardId === card.gamecardId) && isNonGodUnit(card) && (card.power || 0) <= 2500 && canPutUnitOntoBattlefield(playerState, card));
      if (target) moveCard(gameState, playerState.uid, target, 'UNIT', instance);
    }
  }],
  '103000081': () => [{
    id: '103000081_double_mill',
    type: 'ACTIVATE',
    triggerLocation: ['UNIT'],
    limitCount: 1,
    description: '主要阶段，将双方卡组顶各1张送入墓地。',
    condition: (gameState, playerState) => gameState.phase === 'MAIN' && playerState.isTurn && ownUnits(playerState).filter(unit => AtomicEffectExecutor.matchesColor(unit, 'GREEN')).length >= 2,
    execute: async (instance, gameState, playerState) => {
      millTop(gameState, playerState.uid, 1, instance);
      millTop(gameState, getOpponentUid(gameState, playerState.uid), 1, instance);
    }
  }],
  '103000082': () => [{
    id: '103000082_base',
    type: 'CONTINUOUS',
    description: '不能组成联军，也不能成为效果对象；可以攻击对手重置单位。',
    applyContinuous: (_gameState, instance) => {
      ensureData(instance).cannotAllianceByEffect = true;
      ensureData(instance).bt01CanAttackReady = true;
      addInfluence(instance, instance, '不能组成联军，也不能成为效果对象');
    }
  }, {
    id: '103000082_power',
    type: 'ACTIVATE',
    triggerLocation: ['UNIT'],
    limitCount: 1,
    description: '支付2费：本回合中，此单位力量+1500。',
    cost: paymentCost(2, 'GREEN'),
    execute: async (instance) => addTempPower(instance, instance, 1500)
  }, {
    id: '103000082_ten_plus',
    type: 'CONTINUOUS',
    erosionTotalLimit: [10, 99],
    description: '10+：伤害+3、力量+3500，获得速攻、歼灭。',
    applyContinuous: (_gameState, instance) => {
      addContinuousDamage(instance, instance, 3);
      addContinuousPower(instance, instance, 3500);
      instance.isrush = true;
      instance.isAnnihilation = true;
      addInfluence(instance, instance, '获得效果: 【速攻】【歼灭】');
    }
  }],
  '103000083': () => [{
    id: '103000083_power',
    type: 'ACTIVATE',
    triggerLocation: ['UNIT'],
    limitCount: 1,
    description: '支付2费：此单位力量+1000。',
    cost: paymentCost(2, 'GREEN'),
    execute: async instance => addTempPower(instance, instance, 1000)
  }],
  '103000084': () => [{
    id: '103000084_grave_entry',
    type: 'ACTIVATE',
    triggerLocation: ['GRAVE'],
    description: '主要阶段，从墓地发动：将你战场上3个非神蚀单位送入墓地，将此卡放置到战场，本回合获得速攻、歼灭。',
    condition: (gameState, playerState) => gameState.phase === 'MAIN' && playerState.isTurn && ownUnits(playerState).filter(unit => AtomicEffectExecutor.matchesColor(unit, 'GREEN')).length >= 2 && ownUnits(playerState).filter(isNonGodUnit).length >= 3 && canPutUnitOntoBattlefield(playerState, playerState.grave.find(card => card.id === '103000084') as Card),
    cost: async (gameState, playerState, instance) => {
      ownUnits(playerState).filter(isNonGodUnit).slice(0, 3).forEach(unit => moveCard(gameState, playerState.uid, unit, 'GRAVE', instance));
      return true;
    },
    execute: async (instance, gameState, playerState) => {
      if (instance.cardlocation === 'GRAVE') moveCard(gameState, playerState.uid, instance, 'UNIT', instance);
      addTempKeyword(instance, instance, 'rush');
      addTempKeyword(instance, instance, 'annihilation');
    }
  }, {
    id: '103000084_ten_plus_tap',
    type: 'ACTIVATE',
    triggerLocation: ['UNIT'],
    limitCount: 1,
    limitGlobal: true,
    erosionTotalLimit: [10, 99],
    description: '10+，1游戏1次，侵蚀2：横置对手最多2个非神蚀单位；下次对手回合开始不能重置。',
    cost: async (gameState, playerState, instance) => {
      await damagePlayerByEffect(gameState, playerState.uid, playerState.uid, 2, instance);
      return true;
    },
    execute: async (instance, gameState, playerState) => {
      const opponent = gameState.players[getOpponentUid(gameState, playerState.uid)];
      ownUnits(opponent).filter(unit => !unit.godMark).slice(0, 2).forEach(unit => {
        unit.isExhausted = true;
        unit.canResetCount = 1;
        addInfluence(unit, instance, '下个重置阶段不能重置');
      });
    }
  }],
  '203000029': () => [story('203000029_wind_production', '本回合中，你下一次支付ACCESS值时，可以使自己的侵蚀区中的卡刚好达到10张。', async (instance, gameState, playerState) => {
    if (backErosionCount(playerState) < 3) return;
    (playerState as any).bt01WindProductionTurn = gameState.turnCount;
    (playerState as any).bt01WindProductionSourceName = instance.fullName;
    gameState.logs.push(`[${instance.fullName}] 本回合下一次支付ACCESS值可以刚好达到10张侵蚀。`);
  })],
  '203000030': () => [story('203000030_revive', '选择墓地中1个力量3000以下的非神蚀单位放置到战场上，回合结束时放逐。', async (instance, gameState, playerState) => {
    const target = playerState.grave.find(card => isNonGodUnit(card) && (card.power || 0) <= 3000 && canPutUnitOntoBattlefield(playerState, card));
    if (!target) return;
    const id = target.gamecardId;
    moveCard(gameState, playerState.uid, target, 'UNIT', instance);
    const live = AtomicEffectExecutor.findCardById(gameState, id);
    if (live) {
      addInfluence(live, instance, '回合结束时放逐');
      appendEndResolution(gameState, playerState.uid, instance, '203000030_end_exile', (source, state) => {
        const current = AtomicEffectExecutor.findCardById(state, id);
        if (current?.cardlocation === 'UNIT') exileByEffect(state, current, source);
      });
    }
  })],
  '203000031': () => [story('203000031_flip', '同名1回合1次：选择对手侵蚀区中的1张正面卡，转为背面。', async (instance, gameState, playerState) => {
    const opponent = gameState.players[getOpponentUid(gameState, playerState.uid)];
    const target = faceUpErosion(opponent)[0];
    if (!target) return;
    moveCard(gameState, opponent.uid, target, 'EROSION_BACK', instance, { faceDown: true });
  }, { limitCount: 1, limitNameType: true })],
  '303090011': () => [{
    id: '303090011_buff',
    type: 'ACTIVATE',
    triggerLocation: ['ITEM'],
    description: '横置：选择你的1个单位，本回合力量+500。',
    condition: (_gameState, _playerState, instance) => !instance.isExhausted,
    cost: exhaustCost,
    execute: async (instance, _gameState, playerState) => {
      const target = ownUnits(playerState)[0];
      if (target) addTempPower(target, instance, 500);
    }
  }],
  '303090012': () => [{
    id: '303090012_mill_play',
    type: 'ACTIVATE',
    triggerLocation: ['ITEM'],
    description: '横置：将卡组顶1张送入墓地。若其为力量2500以上非神蚀单位，可以放逐此卡并将其放置到战场。',
    condition: (_gameState, _playerState, instance) => !instance.isExhausted,
    cost: exhaustCost,
    execute: async (instance, gameState, playerState) => {
      const top = getTopDeckCards(playerState, 1)[0];
      if (!top) return;
      moveCard(gameState, playerState.uid, top, 'GRAVE', instance);
      if (isNonGodUnit(top) && (top.power || 0) >= 2500 && canPutUnitOntoBattlefield(playerState, top)) {
        moveCard(gameState, playerState.uid, instance, 'EXILE', instance);
        moveCard(gameState, playerState.uid, top, 'UNIT', instance);
      }
    }
  }],
  '102050085': () => [{
    id: '102050085_alliance_damage',
    type: 'TRIGGER',
    triggerEvent: 'CARD_ATTACK_DECLARED',
    triggerLocation: ['UNIT'],
    limitCount: 1,
    limitNameType: true,
    description: '组成联军时，给予对手2点伤害。',
    condition: (_gameState, _playerState, instance, event) => !!event?.data?.isAlliance && event.data.attackerIds?.includes(instance.gamecardId),
    execute: async (instance, gameState, playerState) => damagePlayerByEffect(gameState, playerState.uid, getOpponentUid(gameState, playerState.uid), 2, instance)
  }],
  '102050086': () => [{
    id: '102050086_attack_buff',
    type: 'TRIGGER',
    triggerEvent: 'CARD_ATTACK_DECLARED',
    triggerLocation: ['UNIT'],
    isGlobal: true,
    description: '你的<伊列宇王国>单位攻击时，本回合中那个单位力量+500。',
    condition: (_gameState, playerState, _instance, event) => event?.playerUid === playerState.uid,
    execute: async (instance, gameState, _playerState, event) => {
      const attacker = event?.sourceCardId ? AtomicEffectExecutor.findCardById(gameState, event.sourceCardId) : undefined;
      if (attacker && attacker.faction === '伊列宇王国') addTempPower(attacker, instance, 500);
    }
  }],
  '102050087': () => [{
    id: '102050087_destroy',
    type: 'TRIGGER',
    triggerEvent: 'CARD_ENTERED_ZONE',
    triggerLocation: ['UNIT'],
    description: '入场时，若你的<伊列宇王国>单位有4个以上，破坏对手1个非神蚀单位。',
    condition: (_gameState, playerState, instance, event) => event?.sourceCardId === instance.gamecardId && event.data?.zone === 'UNIT' && ownUnits(playerState).filter(unit => unit.faction === '伊列宇王国').length >= 4,
    execute: async (instance, gameState, playerState) => {
      const target = ownUnits(gameState.players[getOpponentUid(gameState, playerState.uid)]).find(unit => !unit.godMark);
      if (target) destroyByEffect(gameState, target, instance);
    }
  }],
  '102050088': () => [{
    id: '102050088_damage',
    type: 'CONTINUOUS',
    erosionTotalLimit: [5, 7],
    description: '5~7：伤害+1。',
    applyContinuous: (_gameState, instance) => addContinuousDamage(instance, instance, 1)
  }],
  '102050089': () => [{
    id: '102050089_damage_search',
    type: 'TRIGGER',
    triggerEvent: 'COMBAT_DAMAGE_CAUSED',
    triggerLocation: ['UNIT'],
    description: '给予对手战斗伤害时，可以从卡组将1张<伊列宇王国>神蚀卡加入手牌。之后给予你1点伤害。',
    condition: (gameState, playerState, instance, event) => event?.playerUid !== playerState.uid && gameState.battleState?.attackers?.includes(instance.gamecardId),
    execute: async (instance, gameState, playerState) => {
      const target = playerState.deck.find(card => card.faction === '伊列宇王国' && card.godMark);
      if (target) {
        moveCard(gameState, playerState.uid, target, 'HAND', instance);
        await AtomicEffectExecutor.execute(gameState, playerState.uid, { type: 'SHUFFLE_DECK' }, instance);
      }
      await damagePlayerByEffect(gameState, playerState.uid, playerState.uid, 1, instance);
    }
  }],
  '102050090': () => [{
    id: '102050090_attack_lock',
    type: 'TRIGGER',
    triggerEvent: 'CARD_ATTACK_DECLARED',
    triggerLocation: ['UNIT'],
    description: '攻击时，选择对手最多2个力量3000以上单位，本回合不能宣言防御。',
    condition: (_gameState, _playerState, instance, event) => event?.sourceCardId === instance.gamecardId,
    execute: async (instance, gameState, playerState) => {
      ownUnits(gameState.players[getOpponentUid(gameState, playerState.uid)])
        .filter(unit => (unit.power || 0) >= 3000)
        .slice(0, 2)
        .forEach(unit => {
          ensureData(unit).bt01CannotDefendTurn = gameState.turnCount;
          ensureData(unit).bt01CannotDefendSourceName = instance.fullName;
          addInfluence(unit, instance, '本回合不能宣言防御');
        });
    }
  }, {
    id: '102050090_goddess_entry',
    type: 'TRIGGER',
    triggerEvent: 'GODDESS_TRANSFORMATION',
    triggerLocation: ['HAND'],
    erosionTotalLimit: [10, 99],
    description: '10+：进入女神化时，可以从手牌放置到战场，选择最多2个单位伤害+1、力量+1000。',
    execute: async (instance, gameState, playerState) => {
      if (canPutUnitOntoBattlefield(playerState, instance)) moveCard(gameState, playerState.uid, instance, 'UNIT', instance);
      allUnitsOnField(gameState).slice(0, 2).forEach(unit => {
        addTempDamage(unit, instance, 1);
        addTempPower(unit, instance, 1000);
      });
    }
  }],
  '102050091': () => [{
    id: '102050091_red_rush',
    type: 'CONTINUOUS',
    description: '你的所有红色神蚀单位获得速攻；此单位可以攻击对手横置单位。',
    applyContinuous: (gameState, instance) => {
      const owner = ownerOf(gameState, instance);
      if (!owner) return;
      ownUnits(owner).filter(unit => unit.color === 'RED' && unit.godMark).forEach(unit => {
        unit.isrush = true;
        addInfluence(unit, instance, '获得效果: 【速攻】');
      });
      ensureData(instance).bt01CanAttackExhausted = true;
    }
  }],
  '102000092': () => [{
    id: '102000092_all_damage',
    type: 'ACTIVATE',
    triggerLocation: ['UNIT'],
    limitCount: 1,
    description: '主要阶段，给予所有玩家1点伤害。',
    condition: (gameState, playerState) => gameState.phase === 'MAIN' && playerState.isTurn && ownUnits(playerState).filter(unit => AtomicEffectExecutor.matchesColor(unit, 'RED')).length >= 2,
    execute: async (instance, gameState, playerState) => {
      for (const uid of Object.keys(gameState.players)) await damagePlayerByEffect(gameState, playerState.uid, uid, 1, instance);
    }
  }, {
    id: '102000092_self_damage',
    type: 'TRIGGER',
    triggerEvent: 'CARD_ENTERED_ZONE',
    triggerLocation: ['UNIT'],
    erosionTotalLimit: [9, 9],
    description: '9~9：入场时给予你1点伤害。',
    condition: (_gameState, _playerState, instance, event) => event?.sourceCardId === instance.gamecardId && event.data?.zone === 'UNIT',
    execute: async (instance, gameState, playerState) => damagePlayerByEffect(gameState, playerState.uid, playerState.uid, 1, instance)
  }],
  '102000093': () => [{
    id: '102000093_red_buffs',
    type: 'TRIGGER',
    triggerEvent: 'CARD_ENTERED_ZONE',
    triggerLocation: ['UNIT'],
    description: '入场时，选择最多2个红色单位，本回合伤害+1、力量+500。',
    condition: (_gameState, _playerState, instance, event) => event?.sourceCardId === instance.gamecardId && event.data?.zone === 'UNIT',
    execute: async (instance, _gameState, playerState) => ownUnits(playerState).filter(unit => AtomicEffectExecutor.matchesColor(unit, 'RED')).slice(0, 2).forEach(unit => {
      addTempDamage(unit, instance, 1);
      addTempPower(unit, instance, 500);
    })
  }],
  '102000094': () => [{
    id: '102000094_defense_limit',
    type: 'CONTINUOUS',
    description: '对手不能用力量2000以下的单位防御此单位的攻击。',
    applyContinuous: (_gameState, instance) => {
      ensureData(instance).bt01DefenseMinPower = 2000;
      addInfluence(instance, instance, '对手不能用力量2000以下的单位防御');
    }
  }],
  '102000095': () => [{
    id: '102000095_turn_power',
    type: 'CONTINUOUS',
    description: '你的回合中，力量+1000。',
    applyContinuous: (gameState, instance) => {
      const ownerUid = ownerUidOf(gameState, instance);
      if (ownerUid && gameState.players[ownerUid]?.isTurn) addContinuousPower(instance, instance, 1000);
    }
  }],
  '202050032': () => [story('202050032_sac_draw', '选择你的1个重置单位送入墓地。之后抽1张卡。', async (instance, gameState, playerState) => {
    const target = ownUnits(playerState).find(unit => !unit.isExhausted);
    if (!target) return;
    moveCard(gameState, playerState.uid, target, 'GRAVE', instance);
    await AtomicEffectExecutor.execute(gameState, playerState.uid, { type: 'DRAW', value: 1 }, instance);
  })],
  '202050033': () => [story('202050033_goddess', '5~7且创痕3：给予你5点不能防止的伤害，选择1个单位伤害+2、力量+2000。', async (instance, gameState, playerState) => {
    dealUnpreventableSelfDamage(gameState, playerState.uid, 5, instance);
    const target = ownUnits(playerState)[0];
    if (target) {
      addTempDamage(target, instance, 2);
      addTempPower(target, instance, 2000);
    }
  }, { erosionTotalLimit: [5, 7], erosionBackLimit: [3, 10] })],
  '202050034': () => [story('202050034_destroy_god', '创痕2：选择1张神蚀卡破坏。之后给予你1点伤害。女神化时手牌中ACCESS值变为0。', async (instance, gameState, playerState) => {
    const target = allCardsOnField(gameState).find(card => card.godMark);
    if (target) destroyByEffect(gameState, target, instance);
    await damagePlayerByEffect(gameState, playerState.uid, playerState.uid, 1, instance);
  }, { erosionBackLimit: [2, 10] }), {
    id: '202050034_hand_cost',
    type: 'CONTINUOUS',
    content: 'SELF_HAND_COST',
    triggerLocation: ['HAND'],
    description: '你处于女神化状态时，手牌中的这张卡ACCESS值变为0。',
    applyContinuous: (_gameState, instance) => {
      const owner = ownerOf(_gameState, instance);
      if (!owner?.isGoddessMode || instance.cardlocation !== 'HAND') return;
      instance.acValue = 0;
      addInfluence(instance, instance, 'ACCESS值变为0');
    }
  }],
  '202000035': () => [story('202000035_destroy', '选择1张非神蚀道具卡或1个力量2500以下非神蚀单位破坏。', async (instance, gameState) => {
    const target = allCardsOnField(gameState).find(card => !card.godMark && ((card.type === 'ITEM' || card.isEquip) || (card.type === 'UNIT' && (card.power || 0) <= 2500)));
    if (target) destroyByEffect(gameState, target, instance);
  })],
  '101140097': () => [{
    id: '101140097_grave_to_deck_buff',
    type: 'TRIGGER',
    triggerEvent: 'CARD_ENTERED_ZONE',
    triggerLocation: ['UNIT'],
    isGlobal: true,
    description: '你的卡从墓地进入卡组时，选择你的1个单位，伤害+1、力量+500。',
    condition: (_gameState, playerState, _instance, event) => event?.playerUid === playerState.uid && event.data?.zone === 'DECK' && (event.sourceCard as any)?.data?.lastMovedFromZone === 'GRAVE',
    execute: async (instance, _gameState, playerState) => {
      const target = ownUnits(playerState)[0];
      if (target) {
        addTempDamage(target, instance, 1);
        addTempPower(target, instance, 500);
      }
    }
  }],
  '101140098': () => [{
    id: '101140098_start',
    type: 'TRIGGER',
    triggerEvent: 'PHASE_CHANGED',
    triggerLocation: ['UNIT'],
    description: '你的回合开始时，将墓地1张卡放到卡组底。之后将对手卡组顶1张送入墓地。',
    condition: (_gameState, playerState, _instance, event) => playerState.isTurn && event?.data?.phase === 'START',
    execute: async (instance, gameState, playerState) => {
      const graveCard = playerState.grave[0];
      if (graveCard) moveCard(gameState, playerState.uid, graveCard, 'DECK', instance, { insertAtBottom: true });
      millTop(gameState, getOpponentUid(gameState, playerState.uid), 1, instance);
    }
  }, {
    id: '101140098_ten_destroy',
    type: 'ACTIVATE',
    triggerLocation: ['UNIT'],
    limitCount: 1,
    erosionTotalLimit: [10, 99],
    description: '10+，侵蚀2：选择战场上1张卡破坏。',
    cost: async (gameState, playerState, instance) => {
      await damagePlayerByEffect(gameState, playerState.uid, playerState.uid, 2, instance);
      return true;
    },
    execute: async (instance, gameState) => {
      const target = allCardsOnField(gameState).find(card => card.gamecardId !== instance.gamecardId);
      if (target) destroyByEffect(gameState, target, instance);
    }
  }, {
    id: '101140098_ten_form',
    type: 'ACTIVATE',
    triggerLocation: ['UNIT'],
    limitCount: 1,
    erosionTotalLimit: [10, 99],
    description: '10+，侵蚀2：直到下一次你的回合结束，此单位变为伤害4、力量4000并获得英勇。',
    cost: async (gameState, playerState, instance) => {
      await damagePlayerByEffect(gameState, playerState.uid, playerState.uid, 2, instance);
      return true;
    },
    execute: async instance => {
      addTempDamage(instance, instance, 4 - (instance.damage || 0));
      addTempPower(instance, instance, 4000 - (instance.power || 0));
      addTempKeyword(instance, instance, 'heroic');
    }
  }],
  '101140099': () => [{
    id: '101140099_low_erosion_protect',
    type: 'CONTINUOUS',
    erosionTotalLimit: [0, 3],
    description: '0~3：此单位参与的攻击中，此单位不会被破坏。',
    applyContinuous: (gameState, instance) => {
      if (gameState.battleState?.attackers?.includes(instance.gamecardId)) {
        (instance as any).battleImmuneByEffect = true;
        addInfluence(instance, instance, '攻击中不会被破坏');
      }
    }
  }],
  '101140100': () => [{
    id: '101140100_blink',
    type: 'TRIGGER',
    triggerEvent: 'CARD_ENTERED_ZONE',
    triggerLocation: ['UNIT'],
    description: '入场时，若你的<女神教会>单位有3个以上，放逐战场上1张其他卡，下一次你的回合结束时返回。',
    condition: (_gameState, playerState, instance, event) => event?.sourceCardId === instance.gamecardId && event.data?.zone === 'UNIT' && ownUnits(playerState).filter(unit => unit.faction === '女神教会').length >= 3,
    execute: async (instance, gameState, playerState) => {
      const target = allCardsOnField(gameState).find(card => card.gamecardId !== instance.gamecardId);
      if (!target) return;
      const ownerUid = ownerUidOf(gameState, target);
      const zone = target.cardlocation as TriggerLocation;
      const id = target.gamecardId;
      exileByEffect(gameState, target, instance);
      appendEndResolution(gameState, playerState.uid, instance, '101140100_return', (source, state) => {
        const exiled = AtomicEffectExecutor.findCardById(state, id);
        if (exiled && ownerUid) moveCard(state, ownerUid, exiled, zone, source);
      });
    }
  }],
  '101130101': () => [{
    id: '101130101_bottom',
    type: 'ACTIVATE',
    triggerLocation: ['UNIT'],
    description: '放逐此单位：选择墓地1张卡放到卡组底。',
    condition: (_gameState, playerState) => ownUnits(playerState).filter(unit => AtomicEffectExecutor.matchesColor(unit, 'WHITE')).length >= 2,
    cost: async (gameState, playerState, instance) => {
      moveCard(gameState, playerState.uid, instance, 'EXILE', instance);
      return true;
    },
    execute: async (instance, gameState, playerState) => {
      const target = playerState.grave[0];
      if (target) moveCard(gameState, playerState.uid, target, 'DECK', instance, { insertAtBottom: true });
    }
  }],
  '101130103': () => [{
    id: '101130103_alliance_buff',
    type: 'CONTINUOUS',
    description: '英勇；参与联军攻击中，伤害+1、力量+500。',
    applyContinuous: (_gameState, instance) => {
      instance.isHeroic = true;
      addInfluence(instance, instance, '获得效果: 【英勇】');
      if (instance.inAllianceGroup) {
        addContinuousDamage(instance, instance, 1);
        addContinuousPower(instance, instance, 500);
      }
    }
  }],
  '101130104': () => [{
    id: '101130104_alliance_annihilation',
    type: 'CONTINUOUS',
    description: '参与联军攻击中获得歼灭。',
    applyContinuous: (_gameState, instance) => {
      if (instance.inAllianceGroup) {
        instance.isAnnihilation = true;
        addInfluence(instance, instance, '获得效果: 【歼灭】');
      }
    }
  }, {
    id: '101130104_damage_bottom',
    type: 'TRIGGER',
    triggerEvent: 'COMBAT_DAMAGE_CAUSED',
    triggerLocation: ['UNIT'],
    erosionTotalLimit: [0, 3],
    description: '0~3：给予对手战斗伤害时，将墓地2张卡放到卡组底。',
    condition: (gameState, playerState, instance, event) => event?.playerUid !== playerState.uid && gameState.battleState?.attackers?.includes(instance.gamecardId),
    execute: async (instance, gameState, playerState) => playerState.grave.slice(0, 2).forEach(card => moveCard(gameState, playerState.uid, card, 'DECK', instance, { insertAtBottom: true }))
  }],
  '101000105': () => [{
    id: '101000105_exile_grave',
    type: 'ACTIVATE',
    triggerLocation: ['UNIT'],
    limitCount: 1,
    description: '你的回合中，选择1名玩家墓地中的1张卡放逐。',
    condition: (gameState, playerState) => playerState.isTurn && gameState.phase === 'MAIN',
    execute: async (instance, gameState) => {
      const target = Object.values(gameState.players).flatMap(player => player.grave).find(Boolean);
      if (target) exileByEffect(gameState, target, instance);
    }
  }],
  '101000106': () => [{
    id: '101000106_opponent_power',
    type: 'CONTINUOUS',
    description: '对手回合中，力量+1000。',
    applyContinuous: (gameState, instance) => {
      const ownerUid = ownerUidOf(gameState, instance);
      if (ownerUid && !gameState.players[ownerUid]?.isTurn) addContinuousPower(instance, instance, 1000);
    }
  }],
  '201100036': () => [story('201100036_prevent', '选择侵蚀区2张正面卡翻面。之后本回合防止你将受到的所有伤害。', async (instance, gameState, playerState) => {
    faceUpErosion(playerState).slice(0, 2).forEach(card => moveCard(gameState, playerState.uid, card, 'EROSION_BACK', instance, { faceDown: true }));
    (playerState as any).bt01PreventAllDamageTurn = gameState.turnCount;
    (playerState as any).bt01PreventAllDamageSourceName = instance.fullName;
  })],
  '201100037': () => [story('201100037_eclipse', '创痕3：破坏战场上的所有卡。本局你的《日蚀》效果不再处理。', async (instance, gameState) => {
    [...allCardsOnField(gameState)].forEach(card => destroyByEffect(gameState, card, instance));
  }, { erosionBackLimit: [3, 10], limitCount: 1, limitGlobal: true, limitNameType: true })],
  '201130038': () => [story('201130038_blessing', '选择你的1个白色单位，本回合伤害+1、力量+2000。', async (instance, _gameState, playerState) => {
    const target = ownUnits(playerState).find(unit => AtomicEffectExecutor.matchesColor(unit, 'WHITE'));
    if (target) {
      addTempDamage(target, instance, 1);
      addTempPower(target, instance, 2000);
    }
  })],
  '201000039': () => [story('201000039_sync', '创痕3：卡组顶2张放置到侵蚀区。回合结束时，墓地2张《同步集中》以外白色卡放到卡组底。', async (instance, gameState, playerState) => {
    moveTopDeckTo(gameState, playerState.uid, 2, 'EROSION_FRONT', instance);
    appendEndResolution(gameState, playerState.uid, instance, '201000039_end_bottom', (source, state, player) => {
      player.grave.filter(card => card.id !== '201000039' && AtomicEffectExecutor.matchesColor(card, 'WHITE')).slice(0, 2).forEach(card => moveCard(state, player.uid, card, 'DECK', source, { insertAtBottom: true }));
    });
  }, { erosionBackLimit: [3, 10] })],
  '301000015': () => [{
    id: '301000015_exile_erosion',
    type: 'TRIGGER',
    triggerEvent: 'CARD_ENTERED_ZONE',
    triggerLocation: ['ITEM'],
    description: '进入战场时，将你的侵蚀区中的所有正面卡放逐。',
    condition: (_gameState, _playerState, instance, event) => event?.sourceCardId === instance.gamecardId && event.data?.zone === 'ITEM',
    execute: async (instance, gameState, playerState) => faceUpErosion(playerState).forEach(card => moveCard(gameState, playerState.uid, card, 'EXILE', instance))
  }],
  '301000016': () => [universalEquipEffect, {
    id: '301000016_equip_buff',
    type: 'CONTINUOUS',
    description: '装备单位伤害+1、力量+500并获得英勇。',
    applyContinuous: (gameState, instance) => {
      if (!instance.equipTargetId) return;
      const target = AtomicEffectExecutor.findCardById(gameState, instance.equipTargetId);
      if (!target) return;
      addContinuousDamage(target, instance, 1);
      addContinuousPower(target, instance, 500);
      target.isHeroic = true;
      addInfluence(target, instance, '获得效果: 【英勇】');
    }
  }]
};

export const getBt01CardEffects = (cardId: string): CardEffect[] => BT01_EFFECTS[cardId]?.({} as Card) || [];
