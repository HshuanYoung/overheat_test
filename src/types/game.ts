
export type CardType = 'UNIT' | 'STORY' | 'ITEM';
export type CardColor = 'RED' | 'WHITE' | 'YELLOW' | 'BLUE' | 'GREEN' | 'NONE';
export type EffectType = 'CONTINUOUS' | 'TRIGGERED' | 'ACTIVATED' | 'ALWAYS' | 'TRIGGER' | 'ACTIVATE';
export type TriggerLocation = 'HAND' | 'UNIT' | 'ITEM' | 'GRAVE' | 'EXILE' | 'EROSION_FRONT' | 'EROSION_BACK' | 'PLAY' | 'DECK';

export type GameEventType = 
  | 'PHASE_CHANGED'
  | 'CARD_ROTATED'
  | 'CARD_DRAWN'
  | 'CARD_PLAYED'
  | 'CARD_ENTERED_ZONE'
  | 'CARD_LEFT_ZONE'
  | 'EFFECT_ACTIVATED'
  | 'EFFECT_TRIGGERED'
  | 'CARD_POWER_CHANGED'
  | 'CARD_DAMAGE_CHANGED'
  | 'CARD_AC_CHANGED'
  | 'CARD_DESTROYED_BATTLE'
  | 'CARD_DESTROYED_EFFECT'
  | 'CARD_DECK_TO_EROSION_UP'
  | 'CARD_EROSION_TO_FIELD'
  | 'CARD_EROSION_TO_HAND'
  | 'CARD_DECK_TO_EROSION_DOWN'
  | 'CARD_HAND_TO_EROSION_UP'
  | 'CARD_FIELD_TO_HAND'
  | 'CARD_ATTACK_DECLARED'
  | 'CARD_SELECTED_ALLIANCE'
  | 'CARD_DEFENSE_DECLARED'
  | 'COMBAT_DAMAGE_CAUSED'
  | 'EFFECT_DAMAGE_CAUSED'
  | 'GODDESS_TRANSFORMATION'
  | 'EFFECT_COUNTERED'
  | 'CARD_SELECTED_TARGET'
  | 'CARD_EXILED'
  | 'CARD_LEFT_FIELD'
  | 'CARD_DISCARDED'
  | 'REVEAL_HAND'
  | 'REVEAL_DECK'
  | 'DECK_SHUFFLED';

export type AtomicEffectType =
  | 'DRAW'
  | 'ROTATE_HORIZONTAL'
  | 'ROTATE_VERTICAL'
  | 'SHUFFLE_DECK'
  | 'REVEAL_DECK'
  | 'SEARCH_DECK'
  | 'BOTH_PLAYERS_DRAW'
  | 'TURN_EROSION_FACE_DOWN'
  | 'SET_CAN_RESET_COUNT'
  | 'MOVE_FROM_HAND'
  | 'MOVE_FROM_EROSION'
  | 'MOVE_FROM_EROSION_BACK'
  | 'MOVE_FROM_FIELD'
  | 'COUNTER_EFFECT'
  | 'NEGATE_EFFECT'
  | 'IMMUNE_COMBAT_DESTRUCTION'
  | 'IMMUNE_EFFECT'
  | 'CHANGE_DAMAGE'
  | 'CHANGE_POWER'
  | 'CHANGE_AC'
  | 'CHANGE_GOD_MARK'
  | 'DYNAMIC_POWER'
  | 'DEAL_EFFECT_DAMAGE'
  | 'DEAL_COMBAT_DAMAGE'
  | 'DESTROY_CARD'
  | 'BANISH_CARD'
  | 'DISCARD_CARD'
  | 'IMMUNE_SPECIFIC'
  | 'GAIN_EFFECT'
  | 'REVEAL_HAND'
  | 'FORCE_PLAY'
  | 'SKIP_PHASE'
  | 'FORCE_END_PHASE';

export interface CardFilter {
  id?: string;
  name?: string;
  type?: CardType;
  color?: CardColor;
  faction?: string;
  godMark?: boolean;
  minPower?: number;
  maxPower?: number;
  minDamage?: number;
  maxDamage?: number;
  minAc?: number;
  maxAc?: number;
  tags?: string[];
  zone?: TriggerLocation[];
  onField?: boolean;
  excludeColor?: CardColor;
  excludeSelf?: boolean;
  excludeId?: string;
  excludeGamecardId?: string;
  fuzzyName?: string;
}

export interface AtomicEffect {
  type: AtomicEffectType;
  value?: number;
  turnDuration?: number; // 0 for instant, -1 for infinite, >0 for specific turns
  targetFilter?: CardFilter;
  targetCount?: number;
  destinationZone?: TriggerLocation;
  faceDown?: boolean;
  params?: any;
}

export interface GameEvent {
  type: GameEventType;
  sourceCard?: Card;
  sourceCardId?: string;
  targetCardId?: string;
  playerUid?: string;
  data?: any;
}

export interface CardEffect {
  id?: string;
  type: EffectType;
  limitCount?: number; // For ONCE_PER_TURN and ONCE_PER_GAME, this should be 1. For MULTI_PER_TURN and MULTI_PER_GAME, this can be any positive integer.
  limitNowCount?:number;  //at the start of turn,reset to limitCount，each time use this effect,limitNowCount-1,when limitNowCount is 0,can't use this effect
  limitGlobal?:boolean; //0:use every turn,1:only use once in the whole game
  limitNameType?:boolean; //0:check gameid，1:check cardid
  erosionFrontLimit?: [number, number];   //scope:[2,8] means "this effect can only be triggered when there are 2 to 8 cards in the front erosion zone",[0,11] means not limited
  erosionBackLimit?: [number, number];  
  erosionTotalLimit?: [number, number]; 
  playCost?: number;
  playColorReq?: { [color in CardColor]?: number };
  triggerLocation?: TriggerLocation[];
  factionReq?: string;
  godUnitReq?: boolean;
  targetcost?: [number, number]; // [min, max]
  
  // New Event System Properties
  triggerEvent?: GameEventType;
  isMandatory?: boolean;
  condition?: (gameState: GameState, playerState: PlayerState, card: Card, event?: GameEvent) => boolean;
  cost?: (gameState: GameState, playerState: PlayerState, card: Card) => boolean;
  applyContinuous?: (gameState: GameState, card: Card) => void;
  removeContinuous?: (gameState: GameState, card: Card) => void;
  
  execute?: (card: Card, gameState: GameState, playerState: PlayerState, event?: GameEvent) => void; // The function to execute when the effect is triggered
  atomicEffects?: AtomicEffect[]; // Structured atomic effects
  content?: string; // Description of the effect: Move, Draw, Add Power, etc.
  description: string; // Human readable text
}

export interface Card {
  id: string;
  gamecardId: string;
  fullName: string;
  specialName?: string;
  type: CardType;
  color: CardColor;
  colorReq: { [color in CardColor]?: number };
  acValue: number;
  baseAcValue?: number;
  power?: number;
  basePower?: number;
  damage?: number;
  baseDamage?: number;
  godMark: boolean;
  baseGodMark?: boolean;
  displayState: 'FRONT_UPRIGHT' | 'FRONT_FACEDOWN' | 'BACK_UPRIGHT';
  isrush?: boolean;
  baseIsrush?: boolean;
  isExhausted?: boolean;
  canAttack?: boolean;
  baseCanAttack?: boolean;
  canActivateEffect?: boolean;
  baseCanActivateEffect?: boolean;
  playedTurn?: number;
  cardlocation?: 'HAND' | 'UNIT' | 'ITEM' | 'GRAVE' | 'EXILE' | 'EROSION_FRONT' | 'EROSION_BACK' | 'PLAY' | 'DECK';
  feijingMark: boolean;
  canResetCount?: number;    //only 0 can be reset,if not 0,at the start of turn,canResetCount-1
  effects?: CardEffect[];
  influencingEffects?: { sourceCardName: string; description: string }[];
  inAllianceGroup?: boolean;
  imageUrl: string;
  fullImageUrl: string;
  rarity: 'C' | 'U' | 'R' | 'SR' | 'UR' | 'SER' | 'PR';
  faction: string;
  runtimeFingerprint?: string;
}

export interface PlayerState {
  uid: string;
  deck: Card[];
  hand: Card[];
  grave: Card[];
  exile: Card[];
  itemZone: Card[];
  erosionFront: (Card | null)[];
  erosionBack: (Card | null)[];
  unitZone: (Card | null)[];
  playZone: Card[];
  isTurn: boolean;
  isFirst: boolean;
  displayName: string;
  mulliganDone: boolean;
  hasExhaustedThisTurn: string[];
  isGoddessMode?: boolean;
}

export type StackItemType = 'PLAY' | 'EFFECT' | 'ATTACK' | 'PHASE_END';

export interface StackItem {
  card?: Card;
  ownerUid: string;
  type: StackItemType;
  effectIndex?: number;
  nextPhase?: GamePhase; // For PHASE_END
  attackerIds?: string[]; // For ATTACK
  isAlliance?: boolean; // For ATTACK
  timestamp: number;
}

export type GamePhase = 
  | 'START' 
  | 'DRAW' 
  | 'EROSION' 
  | 'MAIN' 
  | 'BATTLE_DECLARATION' 
  | 'DEFENSE_DECLARATION' 
  | 'BATTLE_FREE' 
  | 'DAMAGE_CALCULATION' 
  | 'BATTLE_END' 
  | 'DISCARD' 
  | 'COUNTERING' 
  | 'END' 
  | 'MULLIGAN' 
  | 'INIT';

export interface GameState {
  gameId: string;
  phase: GamePhase;
  currentTurnPlayer: 0 | 1; // 0 for first, 1 for second
  turnCount: number; // Starts at 1
  isCountering: 0 | 1; // 1 if countering
  counterStack: StackItem[]; // LIFO
  priorityPlayerId?: string; // Player who currently has the option to respond
  passCount: number; // Number of consecutive passes during identification
  playerIds: [string, string]; // [FirstPlayerID, SecondPlayerID]
  gameStatus: 1 | 2; // 1: Normal, 2: Interrupted
  winReason?: string;
  winnerId?: string;
  logs: string[];
  players: {
    [uid: string]: PlayerState;
  };
  battleState?: {
    attackers: string[]; // gamecardIds
    defender?: string; // gamecardId
    isAlliance: boolean;
    askConfront?: 'ASKING_OPPONENT' | 'ASKING_TURN_PLAYER';
  };
  effectUsage?: Record<string, number>;
  phaseTimerStart?: number;
  mainPhaseTimeRemaining?: number; 
  previousPhase?: GamePhase;
}

export interface Deck {
  id: string;
  name: string;
  cards: string[];
  isFavorite: boolean;
  createdAt: number;
}