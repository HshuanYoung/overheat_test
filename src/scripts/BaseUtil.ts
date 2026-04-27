import { Card, CardEffect, GameState, PlayerState, TriggerLocation } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';
export { AtomicEffectExecutor };
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

export const isAlchemyCard = (card: Card) => card.fullName.includes('炼金');
export const isTruthOrHickUnit = (card: Card) => card.type === 'UNIT' && (card.specialName === '真理' || card.specialName === '希克');
export const isValkyrieUnit = (card: Card) => card.type === 'UNIT' && card.specialName === '瓦尔基里';
export const isYellowHandCard = (card: Card) => card.cardlocation === 'HAND' && card.color === 'YELLOW';
export const isNonGodAccessLe3Item = (card: Card) => card.type === 'ITEM' && !card.godMark && (card.acValue || 0) <= 3;
export const isNonGodAccessLe3UnitOrItem = (card: Card) =>
  !card.godMark &&
  (card.type === 'UNIT' || card.type === 'ITEM') &&
  (card.acValue || 0) <= 3;

export const canPutCardOntoBattlefieldByEffect = (playerState: PlayerState, card: Card) => {
  if (playerState.factionLock && card.faction !== playerState.factionLock) {
    return false;
  }

  if (card.type === 'UNIT') {
    if (!playerState.unitZone.some(slot => slot === null)) {
      return false;
    }
    if (card.specialName && playerState.unitZone.some(unit => unit?.specialName === card.specialName)) {
      return false;
    }

    if (card.godMark) {
      const fieldEffects = playerState.unitZone
        .filter((unit): unit is Card => !!unit)
        .flatMap(unit => unit.effects || []);
      const fieldLimitEffect = fieldEffects.find(effect => effect.type === 'CONTINUOUS' && effect.limitGodmarkCount !== undefined);
      const selfLimitEffect = card.effects?.find(effect => effect.type === 'CONTINUOUS' && effect.limitGodmarkCount !== undefined);
      const effectiveLimit = fieldLimitEffect?.limitGodmarkCount ?? selfLimitEffect?.limitGodmarkCount;

      if (effectiveLimit !== undefined) {
        const currentGodmarkCount = playerState.unitZone.filter(unit => unit && unit.godMark).length;
        if (currentGodmarkCount >= effectiveLimit) {
          return false;
        }
      }
    }
  }

  if (card.type === 'ITEM') {
    if (card.specialName && playerState.itemZone.some(item => item?.specialName === card.specialName)) {
      return false;
    }
  }

  return true;
};

export const getOwnerUid = (gameState: GameState, card: Card) =>
  AtomicEffectExecutor.findCardOwnerKey(gameState, card.gamecardId);

export const isBattlingGodMarkUnit = (gameState: GameState, instance: Card) => {
  const battleState = gameState.battleState;
  if (!battleState) return false;

  if (battleState.defender === instance.gamecardId) {
    return battleState.attackers.some(attackerId => {
      const attacker = AtomicEffectExecutor.findCardById(gameState, attackerId);
      return !!attacker?.godMark;
    });
  }

  if (battleState.attackers.includes(instance.gamecardId)) {
    const defender = battleState.defender ? AtomicEffectExecutor.findCardById(gameState, battleState.defender) : undefined;
    return !!defender?.godMark;
  }

  return false;
};

export const getOpponentBattlefieldNonGodCards = (gameState: GameState, playerUid: string) => {
  const opponentUid = gameState.playerIds.find(uid => uid !== playerUid)!;
  const opponent = gameState.players[opponentUid];
  return [...opponent.unitZone, ...opponent.itemZone].filter((card): card is Card => !!card && !card.godMark);
};

export const getItemTypeCount = (player: PlayerState) =>
  new Set(player.itemZone.filter((card): card is Card => !!card).map(card => card.id)).size;

export const getLoneGodmarkUnit = (player: PlayerState) => {
  const godmarkUnits = player.unitZone.filter((card): card is Card => !!card && card.godMark);
  return godmarkUnits.length === 1 ? godmarkUnits[0] : undefined;
};

export const wasPlayedFromHand = (instance: Card) => !!(instance as any).__playSnapshot;

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

export const ownerOf = (gameState: GameState, card: Card) =>
  Object.values(gameState.players).find(player =>
    [...player.hand, ...player.deck, ...player.grave, ...player.exile, ...player.unitZone, ...player.itemZone, ...player.erosionFront, ...player.erosionBack, ...player.playZone]
      .some(candidate => candidate?.gamecardId === card.gamecardId)
  );

export const ownerUidOf = (gameState: GameState, card: Card) =>
  Object.entries(gameState.players).find(([, player]) =>
    [...player.hand, ...player.deck, ...player.grave, ...player.exile, ...player.unitZone, ...player.itemZone, ...player.erosionFront, ...player.erosionBack, ...player.playZone]
      .some(candidate => candidate?.gamecardId === card.gamecardId)
  )?.[0];

export const allCardsOnField = (gameState: GameState) =>
  Object.values(gameState.players).flatMap(player => [
    ...player.unitZone.filter((card): card is Card => !!card),
    ...player.itemZone.filter((card): card is Card => !!card)
  ]);

export const allUnitsOnField = (gameState: GameState) =>
  Object.values(gameState.players).flatMap(player => player.unitZone.filter((card): card is Card => !!card));

export const ownUnits = (player: PlayerState) => player.unitZone.filter((card): card is Card => !!card);
export const ownItems = (player: PlayerState) => player.itemZone.filter((card): card is Card => !!card);
export const faceUpErosion = (player: PlayerState) =>
  player.erosionFront.filter((card): card is Card => !!card && card.displayState === 'FRONT_UPRIGHT');
export const backErosionCount = (player: PlayerState) => player.erosionBack.filter(card => !!card).length;
export const totalErosionCount = (player: PlayerState) => faceUpErosion(player).length + backErosionCount(player);
export const isFaction = (card: Card, faction: string) => card.faction === faction;
export const isNonGodUnit = (card: Card) => card.type === 'UNIT' && !card.godMark;
export const isNonGodFieldCard = (card: Card) => !card.godMark && (card.type === 'UNIT' || card.type === 'ITEM' || card.isEquip);

export const ensureData = (card: Card) => {
  (card as any).data = (card as any).data || {};
  return (card as any).data;
};

export const addInfluence = (card: Card, source: Card, description: string) => {
  card.influencingEffects = card.influencingEffects || [];
  if (!card.influencingEffects.some(effect => effect.sourceCardName === source.fullName && effect.description === description)) {
    card.influencingEffects.push({ sourceCardName: source.fullName, description });
  }
};

export const addContinuousPower = (target: Card, source: Card, amount: number) => {
  target.power = (target.power || 0) + amount;
  addInfluence(target, source, `力量${amount >= 0 ? '+' : ''}${amount}`);
};

export const addContinuousDamage = (target: Card, source: Card, amount: number) => {
  target.damage = (target.damage || 0) + amount;
  addInfluence(target, source, `伤害${amount >= 0 ? '+' : ''}${amount}`);
};

export const addTempPower = (target: Card, source: Card, amount: number) => {
  target.temporaryPowerBuff = (target.temporaryPowerBuff || 0) + amount;
  target.power = (target.power || 0) + amount;
  target.temporaryBuffSources = { ...(target.temporaryBuffSources || {}), power: source.fullName };
  const details = target.temporaryBuffDetails?.power || [];
  details.push({ sourceCardName: source.fullName, value: amount });
  target.temporaryBuffDetails = { ...(target.temporaryBuffDetails || {}), power: details };
};

export const addTempDamage = (target: Card, source: Card, amount: number) => {
  target.temporaryDamageBuff = (target.temporaryDamageBuff || 0) + amount;
  target.damage = (target.damage || 0) + amount;
  target.temporaryBuffSources = { ...(target.temporaryBuffSources || {}), damage: source.fullName };
};

export const addTempKeyword = (target: Card, source: Card, keyword: 'rush' | 'heroic' | 'annihilation') => {
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

export const moveByEffect = (
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

export const moveTopDeckTo = (gameState: GameState, playerUid: string, count: number, toZone: TriggerLocation, source: Card, faceDown?: boolean) => {
  const player = gameState.players[playerUid];
  getTopDeckCards(player, count).forEach(card => moveCard(gameState, playerUid, card, toZone, source, { faceDown }));
};

export const millTop = (gameState: GameState, playerUid: string, count: number, source: Card) => {
  const player = gameState.players[playerUid];
  getTopDeckCards(player, count).forEach(card => moveCard(gameState, playerUid, card, 'GRAVE', source));
};

export const damagePlayerByEffect = async (gameState: GameState, sourcePlayerUid: string, targetPlayerUid: string, amount: number, source: Card) => {
  await AtomicEffectExecutor.execute(
    gameState,
    sourcePlayerUid,
    { type: targetPlayerUid === sourcePlayerUid ? 'DEAL_EFFECT_DAMAGE_SELF' as any : 'DEAL_EFFECT_DAMAGE', value: amount },
    source
  );
};

export const dealUnpreventableSelfDamage = (gameState: GameState, playerUid: string, amount: number, source: Card) => {
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

export const destroyByEffect = (gameState: GameState, target: Card, source: Card) => {
  const uid = ownerUidOf(gameState, target);
  if (!uid) return;
  moveCard(gameState, uid, target, 'GRAVE', source);
  gameState.logs.push(`[${source.fullName}] 破坏了 [${target.fullName}]。`);
};

export const exileByEffect = (gameState: GameState, target: Card, source: Card) => {
  const uid = ownerUidOf(gameState, target);
  if (!uid) return;
  moveCard(gameState, uid, target, 'EXILE', source);
  gameState.logs.push(`[${source.fullName}] 放逐了 [${target.fullName}]。`);
};

export const paymentCost = (amount: number, color?: string): CardEffect['cost'] => async (gameState, playerState, instance) => {
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

export const exhaustCost: CardEffect['cost'] = async (_gameState, _playerState, instance) => {
  if (instance.isExhausted) return false;
  instance.isExhausted = true;
  return true;
};

export const searchDeckEffect = (id: string, description: string, predicate: (card: Card, source: Card) => boolean): CardEffect => ({
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

export const story = (id: string, description: string, execute: CardEffect['execute'], extra?: Partial<CardEffect>): CardEffect => ({
  id,
  type: 'ACTIVATE',
  triggerLocation: ['PLAY'],
  description,
  execute,
  ...extra
});

export const appendEndResolution = (
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
