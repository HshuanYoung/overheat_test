// VERSION: 2026-04-07-IND-FIX-01
import express from 'express';
console.log('[Server] index.ts is starting up...');
import { createServer } from 'http';

import { Server } from 'socket.io';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import { pool, dbInit } from './db';
import { generateToken, verifyToken } from './auth';
import { initServerCardLibrary, SERVER_CARD_LIBRARY } from './card_loader';
import { getLiveCardVariations } from './card_inventory';
import { isCardVisibleInCatalog } from '../src/lib/cardCatalogFilters';
import {
    createVerificationCode,
    getVerificationCodeExpireMs,
    getVerificationCodeResendMs,
    normalizeEmail,
    seedStarterResources,
    sendRegistrationVerificationEmail,
    validateEmail,
    validatePassword,
    validateUsername
} from './registration';
import { ServerGameService } from './ServerGameService';
import { PlayerState, Card, GAME_TIMEOUTS, GameState } from '../src/types/game';
import fs from 'fs';
import path from 'path';

// Initialize Game Library
// Initialize Game Library will be awaited below.


const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

// In-memory locks to prevent concurrent modifications of the same game state
const gameLocks = new Map<string, Promise<any>>();

// In-memory match log history (not persisted to DB 'state' blob)
const matchLogHistory = new Map<string, string[]>();
const lastSyncedLogIndex = new Map<string, number>();
const botMovingGames = new Set<string>();
const STARTER_COINS = 100000;
const STARTER_CARD_CRYSTALS = 100000;

async function withGameLock<T>(gameId: string, action: () => Promise<T>): Promise<T> {
    const existingLock = gameLocks.get(gameId) || Promise.resolve();
    const newLock = existingLock.then(async () => {
        try {
            return await action();
        } catch (err) {
            // console.error(`[Lock] Error in locked action for game ${gameId}:`, err);
            // Re-throw to allow the caller to handle it, but the lock chain continues
            throw err;
        }
    });
    gameLocks.set(gameId, newLock.catch(() => { })); // Ensure chain doesn't break on errors
    return newLock;
}

function buildAuthUser(user: any) {
    return {
        uid: user.id,
        username: user.username,
        displayName: user.display_name,
        email: user.email || null
    };
}

function createUserId() {
    return `user_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

// Helper: Validate User Deck
async function validateUserDeck(uId: string, dId: string): Promise<{ valid: boolean; cards?: Card[]; error?: string }> {
    try {
        const dRows = await pool.query('SELECT cards FROM decks WHERE id = ? AND user_id = ?', [dId, uId]);
        if (dRows.length === 0) return { valid: false, error: '未找到卡组' };

        let cIds = typeof dRows[0].cards === 'string' ? JSON.parse(dRows[0].cards) : dRows[0].cards;
        if (!Array.isArray(cIds)) cIds = [];

        const cObjs = cIds.map((idVal: string) => {
            return (SERVER_CARD_LIBRARY as any)[idVal];
        }).filter(Boolean);

        if (cObjs.length !== cIds.length) {
            return { valid: false, error: '部分卡牌在服务器库中未找到' };
        }

        const vRes = ServerGameService.validateDeck(cObjs as any);
        if (!vRes.valid) return { valid: false, error: vRes.error };

        return { valid: true, cards: cObjs as any };
    } catch (err) {
        // console.error('Validate deck error:', err);
        return { valid: false, error: '数据库错误' };
    }
}

async function handleBotMove(gameState: any, gameId: string) {
    if (botMovingGames.has(gameId)) {
        // console.log(`[Bot] Bot is already moving for game ${gameId}, skipping trigger`);
        return;
    }

    const bot = gameState.players['BOT_PLAYER'];
    if (!bot) return;

    // The bot should move if it's its turn, if it's being asked for a confrontation response, if it has priority, or has a query
    const isBotAsked = gameState.battleState && gameState.battleState.askConfront === 'ASKING_OPPONENT';
    const isBotPriority = gameState.priorityPlayerId === 'BOT_PLAYER';
    const isBotQuery = gameState.pendingQuery && gameState.pendingQuery.playerUid === 'BOT_PLAYER';
    const isBotDefending = gameState.phase === 'DEFENSE_DECLARATION' && !bot.isTurn;
    const shouldBotMove = bot.isTurn || isBotAsked || isBotPriority || isBotQuery || isBotDefending;

    if (!shouldBotMove) return;

    botMovingGames.add(gameId);

    // Use a delay to simulate thinking and allow final state propagation
    setTimeout(async () => {
        try {
            await withGameLock(gameId, async () => {
                try {
                    // Re-fetch state inside the lock to get the most recent version
                    const stateRows = await pool.query('SELECT state FROM games WHERE id = ?', [gameId]);
                    if (stateRows.length === 0) {
                        botMovingGames.delete(gameId);
                        return;
                    }
                    const currentGameState = typeof stateRows[0].state === 'string' ? JSON.parse(stateRows[0].state) : stateRows[0].state;
                    ServerGameService.hydrateGameState(currentGameState);

                    const syncCallback = async (state: any) => {
                        await syncAndSaveState(gameId, state);
                    };

                    await ServerGameService.botMove(currentGameState, syncCallback);
                    await ServerGameService.applyConfrontationStrategy(currentGameState, syncCallback);

                    await syncAndSaveState(gameId, currentGameState);

                    // Re-trigger if bot still needs to move
                    const nextState = currentGameState;
                    const botObj = nextState.players['BOT_PLAYER'];
                    if (botObj) {
                        const currentPlayerId = nextState.playerIds[nextState.currentTurnPlayer];
                        const isBotAskedNext = nextState.battleState && nextState.battleState.askConfront === 'ASKING_OPPONENT';
                        const isBotPriorityNext = nextState.priorityPlayerId === 'BOT_PLAYER';
                        const isBotQueryNext = nextState.pendingQuery && nextState.pendingQuery.playerUid === 'BOT_PLAYER';

                        const isBotDefendingNext = nextState.phase === 'DEFENSE_DECLARATION' && !botObj.isTurn;
                        if (currentPlayerId === 'BOT_PLAYER' || isBotAskedNext || isBotPriorityNext || isBotQueryNext || isBotDefendingNext) {
                            // Release before recursive call to allow the next move to be scheduled
                            botMovingGames.delete(gameId);
                            handleBotMove(nextState, gameId);
                        } else {
                            botMovingGames.delete(gameId);
                        }
                    } else {
                        botMovingGames.delete(gameId);
                    }
                } catch (err) {
                    // console.error('[Bot] handleBotMove inner error:', err);
                    botMovingGames.delete(gameId);
                }
            });
        } catch (err) {
            // console.error('[Bot] handleBotMove outer error:', err);
            botMovingGames.delete(gameId);
        }
    }, 1000);
}

function triggerBotIfNeeded(gameState: any, gameId: string) {
    const bot = gameState.players['BOT_PLAYER'];
    if (!bot) return;

    const currentPlayerId = gameState.playerIds[gameState.currentTurnPlayer];
    const isBotAsked = gameState.battleState && gameState.battleState.askConfront === 'ASKING_OPPONENT';
    const isBotPriority = gameState.priorityPlayerId === 'BOT_PLAYER';
    const isBotQuery = gameState.pendingQuery && gameState.pendingQuery.playerUid === 'BOT_PLAYER';
    const isBotDefending = gameState.phase === 'DEFENSE_DECLARATION' && !bot.isTurn;

    if (currentPlayerId === 'BOT_PLAYER' || isBotAsked || isBotPriority || isBotQuery || isBotDefending) {
        // console.log(`[Bot] Triggering bot move for game ${gameId}. Reason: ${currentPlayerId === 'BOT_PLAYER' ? 'Turn' : isBotAsked ? 'Confrontation' : isBotPriority ? 'Priority' : 'Query'}`);
        handleBotMove(gameState, gameId);
    }
}

async function saveMatchLog(gameState: any, gameId?: string) {
    if (gameState.gameStatus !== 2 || gameState.logsSaved) return;
    if (gameState.mode !== 'friend' && gameState.mode !== 'match') return;

    const matchNumber = gameState.gameId || gameId;
    if (!matchNumber) return;

    const p1 = gameState.playerIds[0] || 'Unknown';
    const p2 = gameState.playerIds[1] || 'Unknown';
    const winner = gameState.winnerId || 'Draw/None';
    const reason = gameState.winReason || 'Unknown';

    const history = matchLogHistory.get(gameId) || [];
    const logContent = [
        `Player1: ${p1}`,
        `Player2: ${p2}`,
        `Match: ${matchNumber}`,
        `Winner: ${winner}`,
        `Reason: ${reason}`,
        '-----------------------------------',
        ...history
    ].join('\n');

    let savedAny = false;
    for (const uid of gameState.playerIds || []) {
        if (!uid || uid === 'BOT_PLAYER') continue;

        try {
            const rows = await pool.query('SELECT username FROM users WHERE id = ?', [uid]);
            if (rows.length === 0) continue;
            const username = rows[0].username;

            const logDir = path.join(process.cwd(), username, 'matchlog');
            if (!fs.existsSync(logDir)) {
                fs.mkdirSync(logDir, { recursive: true });
            }

            const filePath = path.join(logDir, `${matchNumber}.log`);
            fs.writeFileSync(filePath, logContent);
            // console.log(`[Log] Match log saved for ${username}: ${filePath}`);
            savedAny = true;
        } catch (err) {
            console.error(`[Log] Failed to save match log for user ${uid}:`, err);
        }
    }

    if (savedAny) {
        gameState.logsSaved = true;
        // Final state save to mark logs as saved
        await pool.query('UPDATE games SET state = ? WHERE id = ?', [JSON.stringify(gameState), matchNumber]);
    }
}

async function syncAndSaveState(gameId: string, gameState: any) {
    if (!gameState) return;

    // Ensure gameId is always set for client identification
    gameState.gameId = gameId;

    // Ensure logs exist
    if (!gameState.logs) gameState.logs = [];

    // 1. Get or create history for this match
    let history = matchLogHistory.get(gameId) || [];
    let lastIdx = lastSyncedLogIndex.get(gameId) || 0;

    // 2. Capture new logs added in this step
    const newLogs = gameState.logs.slice(lastIdx);
    if (newLogs.length > 0) {
        history = history.concat(newLogs);
        matchLogHistory.set(gameId, history);
        lastSyncedLogIndex.set(gameId, history.length);
    }

    // 3. Emit full state to clients (they need logs for display)
    io.to(gameId).emit('gameStateUpdate', gameState);

    // 4. Prune logs in gameState to keep the DB 'state' blob small
    // satisfies "It should not be pushed to the backend (DB)"
    const MAX_DB_LOGS = 1000;
    if (gameState.logs.length > MAX_DB_LOGS) {
        gameState.logs = gameState.logs.slice(-MAX_DB_LOGS);
        // Update lastIdx so the next sync knows where to start from the pruned array
        lastSyncedLogIndex.set(gameId, MAX_DB_LOGS);
    }

    // 5. Persist the pruned state to MariaDB
    await pool.query('UPDATE games SET state = ? WHERE id = ?', [JSON.stringify(gameState), gameId]);

    // 6. If game ended, write full history to file
    if (gameState.gameStatus === 2) {
        await saveMatchLog(gameState, gameId);
        // Cleanup memory
        matchLogHistory.delete(gameId);
        lastSyncedLogIndex.delete(gameId);
    }
}

async function advancePhase(gameState: any, gameId: string, playerId?: string, socket?: any, action?: any) {
    try {
        // console.log(`[Socket] advancePhase for game ${gameId}, action: ${action}, playerId: ${playerId}`);
        await ServerGameService.advancePhase(gameState, action, playerId, async (state) => {
            await syncAndSaveState(gameId, state);
        });
        await ServerGameService.applyConfrontationStrategy(gameState, async (state) => {
            await syncAndSaveState(gameId, state);
        });

        await syncAndSaveState(gameId, gameState);

        triggerBotIfNeeded(gameState, gameId);
    } catch (err: any) {
        // console.error('Game Action Error:', err);
        if (socket) socket.emit('gameError', { message: err.message || 'Action failed' });
    }
}

app.use(cors());

// Background Unified Timer Loop
setInterval(async () => {
    try {
        const games = await pool.query('SELECT id FROM games WHERE status = 0');
        for (const row of games) {
            const gameId = row.id;

            await withGameLock(gameId, async () => {
                const stateRows = await pool.query('SELECT state FROM games WHERE id = ?', [gameId]);
                if (stateRows.length === 0) return;

                const gameState = typeof stateRows[0].state === 'string' ? JSON.parse(stateRows[0].state) : stateRows[0].state;
                if (!gameState || gameState.gameStatus === 2) return;
                ServerGameService.hydrateGameState(gameState);

                const now = Date.now();
                const elapsedSinceLastUpdate = now - (gameState.phaseTimerStart || now);

                // Identify active player(s) for the timer
                let activePlayerUid: string | undefined;

                if (gameState.pendingQuery) {
                    activePlayerUid = gameState.pendingQuery.playerUid;
                } else if (gameState.priorityPlayerId) {
                    activePlayerUid = gameState.priorityPlayerId;
                } else if (gameState.phase === 'DISCARD') {
                    activePlayerUid = gameState.playerIds[gameState.currentTurnPlayer];
                } else if (gameState.phase === 'MULLIGAN') {
                    // Special case: decrement for all who haven't finished
                    Object.values(gameState.players).forEach((p: any) => {
                        if (!p.mulliganDone) {
                            p.timeRemaining = Math.max(0, (p.timeRemaining ?? (gameState.turnTimerLimit ? gameState.turnTimerLimit * 1000 : 300000)) - elapsedSinceLastUpdate);
                        }
                    });
                } else {
                    activePlayerUid = gameState.playerIds[gameState.currentTurnPlayer];
                }

                if (activePlayerUid && gameState.players[activePlayerUid]) {
                    const player = gameState.players[activePlayerUid];
                    player.timeRemaining = Math.max(0, (player.timeRemaining ?? (gameState.turnTimerLimit ? gameState.turnTimerLimit * 1000 : 300000)) - elapsedSinceLastUpdate);

                    if (player.timeRemaining <= 0) {
                        // TIMEOUT LOSS
                        gameState.gameStatus = 2;
                        gameState.winnerId = gameState.playerIds.find(id => id !== activePlayerUid);
                        gameState.winReason = 'TIMEOUT_LOSS';
                        gameState.logs.push(`[对局结束] ${player.displayName} 时间已耗尽，判负。`);

                        await syncAndSaveState(gameId, gameState);
                        return;
                    }
                }

                gameState.phaseTimerStart = now;

                // Sync the deducted time back to DB
                await syncAndSaveState(gameId, gameState);

                // Bot action check
                const currentPlayerId = gameState.playerIds[gameState.currentTurnPlayer];
                const isBotQuery = gameState.pendingQuery && gameState.pendingQuery.playerUid === 'BOT_PLAYER';
                const isBotDefending = gameState.phase === 'DEFENSE_DECLARATION' && !gameState.players['BOT_PLAYER']?.isTurn;
                if (currentPlayerId === 'BOT_PLAYER' || gameState.priorityPlayerId === 'BOT_PLAYER' || isBotQuery || isBotDefending) {
                    const syncCallback = async (state: any) => {
                        await syncAndSaveState(gameId, state);
                    };
                    handleBotMove(gameState, gameId); // handleBotMove already does its own lock/fetch
                }
            });
        }
    } catch (err) {
        console.error('[Timer] Error in unified timer loop:', err);
    }
}, GAME_TIMEOUTS.CHECK_INTERVAL);

app.use(express.json());

// Initialize MariaDB Connection
// Initialize MariaDB Connection and then start server
// dbInit() was moved to start() below

app.post('/api/register/send-code', async (req, res): Promise<void> => {
    const username = typeof req.body.username === 'string' ? req.body.username.trim() : '';
    const email = typeof req.body.email === 'string' ? normalizeEmail(req.body.email) : '';
    const password = typeof req.body.password === 'string' ? req.body.password : '';

    const usernameError = validateUsername(username);
    if (usernameError) {
        res.status(400).json({ error: usernameError });
        return;
    }

    const emailError = validateEmail(email);
    if (emailError) {
        res.status(400).json({ error: emailError });
        return;
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
        res.status(400).json({ error: passwordError });
        return;
    }

    try {
        const existingUsers = await pool.query(
            'SELECT id FROM users WHERE username = ? OR email = ? LIMIT 1',
            [username, email]
        );
        if (existingUsers.length > 0) {
            res.status(409).json({ error: '用户名或邮箱已被注册' });
            return;
        }

        const existingCodeRows = await pool.query(
            'SELECT created_at FROM email_verification_codes WHERE email = ?',
            [email]
        );
        if (existingCodeRows.length > 0) {
            const lastSentAt = Number(existingCodeRows[0].created_at || 0);
            const retryAfterMs = getVerificationCodeResendMs() - (Date.now() - lastSentAt);
            if (retryAfterMs > 0) {
                res.status(429).json({
                    error: `验证码发送过于频繁，请在 ${Math.ceil(retryAfterMs / 1000)} 秒后重试`
                });
                return;
            }
        }

        const code = createVerificationCode();
        const now = Date.now();
        const expiresAt = now + getVerificationCodeExpireMs();

        await pool.query(
            `INSERT INTO email_verification_codes (email, username, code, expires_at, created_at)
             VALUES (?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE username = VALUES(username), code = VALUES(code), expires_at = VALUES(expires_at), created_at = VALUES(created_at)`,
            [email, username, code, expiresAt, now]
        );

        try {
            await sendRegistrationVerificationEmail(email, code);
        } catch (mailErr: any) {
            await pool.query('DELETE FROM email_verification_codes WHERE email = ?', [email]);
            console.error('Send verification email error:', mailErr);
            res.status(500).json({ error: mailErr?.message || '验证码发送失败' });
            return;
        }

        res.json({
            success: true,
            message: '验证码已发送，请前往邮箱查收',
            expiresInMs: getVerificationCodeExpireMs()
        });
    } catch (err) {
        console.error('Send register code error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/register', async (req, res): Promise<void> => {
    const username = typeof req.body.username === 'string' ? req.body.username.trim() : '';
    const email = typeof req.body.email === 'string' ? normalizeEmail(req.body.email) : '';
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    const verificationCode = typeof req.body.verificationCode === 'string' ? req.body.verificationCode.trim() : '';

    const usernameError = validateUsername(username);
    if (usernameError) {
        res.status(400).json({ error: usernameError });
        return;
    }

    const emailError = validateEmail(email);
    if (emailError) {
        res.status(400).json({ error: emailError });
        return;
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
        res.status(400).json({ error: passwordError });
        return;
    }

    if (!/^\d{6}$/.test(verificationCode)) {
        res.status(400).json({ error: '请输入 6 位验证码' });
        return;
    }

    let conn;
    try {
        const verificationRows = await pool.query(
            'SELECT username, code, expires_at FROM email_verification_codes WHERE email = ?',
            [email]
        );
        if (verificationRows.length === 0) {
            res.status(400).json({ error: '请先获取邮箱验证码' });
            return;
        }

        const verificationRow = verificationRows[0];
        if (verificationRow.username !== username) {
            res.status(400).json({ error: '验证码与当前用户名不匹配，请重新获取验证码' });
            return;
        }
        if (Number(verificationRow.expires_at) < Date.now()) {
            await pool.query('DELETE FROM email_verification_codes WHERE email = ?', [email]);
            res.status(400).json({ error: '验证码已过期，请重新获取' });
            return;
        }
        if (verificationRow.code !== verificationCode) {
            res.status(400).json({ error: '验证码错误' });
            return;
        }

        conn = await pool.getConnection();
        await conn.beginTransaction();

        const duplicateRows = await conn.query(
            'SELECT id FROM users WHERE username = ? OR email = ? LIMIT 1',
            [username, email]
        );
        if (duplicateRows.length > 0) {
            await conn.rollback();
            res.status(409).json({ error: '用户名或邮箱已被注册' });
            return;
        }

        const userId = createUserId();
        const passwordHash = await bcrypt.hash(password, 10);

        await conn.query(
            `INSERT INTO users (
                id, username, email, password_hash, display_name, role, coins, card_crystals,
                favorite_card_id, favorite_back_id, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'fav_card', 'default', ?)`,
            [
                userId,
                username,
                email,
                passwordHash,
                username,
                'user',
                STARTER_COINS,
                STARTER_CARD_CRYSTALS,
                Date.now()
            ]
        );

        await seedStarterResources(conn, userId);
        await conn.query('DELETE FROM email_verification_codes WHERE email = ?', [email]);
        await conn.commit();

        const token = generateToken(userId, username, username, 'user');
        res.status(201).json({
            token,
            user: {
                uid: userId,
                username,
                displayName: username,
                email
            }
        });
    } catch (err) {
        if (conn) {
            await conn.rollback();
        }
        console.error('Register error:', err);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        if (conn) conn.release();
    }
});

// Login Endpoint
app.post('/api/login', async (req, res): Promise<void> => {
    const { username, password } = req.body;

    if (!username || !password) {
        res.status(400).json({ error: 'Username and password required' });
        return;
    }

    try {
        const rows = await pool.query(
            'SELECT * FROM users WHERE username = ? OR email = ? LIMIT 1',
            [username, normalizeEmail(username)]
        );
        if (rows.length === 0) {
            res.status(401).json({ error: 'Invalid credentials' });
            return;
        }

        const user = rows[0];
        const validPassword = await bcrypt.compare(password, user.password_hash);

        if (!validPassword) {
            res.status(401).json({ error: 'Invalid credentials' });
            return;
        }

        const token = generateToken(user.id, user.username, user.display_name, user.role);
        res.json({ token, user: buildAuthUser(user) });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create Practice Game
app.post('/api/games/practice', async (req, res): Promise<void> => {
    const authHeader = req.headers.authorization;
    if (!authHeader) { res.status(401).json({ error: 'Unauthorized' }); return; }
    const user = verifyToken(authHeader.split(' ')[1]);
    if (!user) { res.status(401).json({ error: 'Invalid token' }); return; }

    const { deckId, turnTimerLimit } = req.body;
    if (!deckId) { res.status(400).json({ error: '请选择卡组' }); return; }

    try {
        const validation = await validateUserDeck(user.userId, deckId);
        if (!validation.valid) { res.status(400).json({ error: validation.error }); return; }

        const gameId = 'practice_' + Math.random().toString(36).substring(2, 9);
        const gameState = await ServerGameService.createPracticeGameState(validation.cards!, user.userId, user.displayName, turnTimerLimit);
        gameState.gameId = gameId;

        await pool.query('INSERT INTO games (id, state, status) VALUES (?, ?, 0)', [gameId, JSON.stringify(gameState)]);
        res.json({ gameId });
    } catch (err) {
        console.error('Create practice game error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create Friend Match (generates 8-digit room code)
app.post('/api/games/friend', async (req, res): Promise<void> => {
    const authHeader = req.headers.authorization;
    if (!authHeader) { res.status(401).json({ error: 'Unauthorized' }); return; }
    const user = verifyToken(authHeader.split(' ')[1]);
    if (!user) { res.status(401).json({ error: 'Invalid token' }); return; }

    try {
        const roomCode = Math.random().toString(10).substring(2, 10).padEnd(8, '0');
        const gameId = 'friend_' + roomCode;
        const userIdStr = user.userId.toString();
        const initialState = {
            gameId: gameId,
            playerIds: [userIdStr],
            players: {},
            status: 'WAITING',
            phase: 'INIT',
            turnCount: 0,
            currentTurnPlayer: 0,
            logs: [],
            mode: 'friend',
            roomCode: roomCode,
            counterStack: [],
            isCountering: 0,
            effectUsage: {},
            turnTimerLimit: req.body.turnTimerLimit
        };

        await pool.query('INSERT INTO games (id, state, status) VALUES (?, ?, 0)', [gameId, JSON.stringify(initialState)]);
        res.json({ gameId, roomCode });
    } catch (err) {
        console.error('Create friend game error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Join Friend Match by room code
app.post('/api/games/friend/join', async (req, res): Promise<void> => {
    const authHeader = req.headers.authorization;
    if (!authHeader) { res.status(401).json({ error: 'Unauthorized' }); return; }
    const user = verifyToken(authHeader.split(' ')[1]);
    if (!user) { res.status(401).json({ error: 'Invalid token' }); return; }

    const { roomCode } = req.body;
    if (!roomCode) { res.status(400).json({ error: '请输入房间码' }); return; }

    try {
        const gameId = 'friend_' + roomCode;
        const rows = await pool.query('SELECT state FROM games WHERE id = ?', [gameId]);
        if (rows.length === 0) {
            res.status(404).json({ error: '未找到该房间' });
            return;
        }
        const gameState = typeof rows[0].state === 'string' ? JSON.parse(rows[0].state) : rows[0].state;
        if (gameState.playerIds.length >= 2) {
            res.status(400).json({ error: '房间已满' });
            return;
        }
        const userIdStr = user.userId.toString();
        if (gameState.playerIds.includes(userIdStr)) {

            res.status(400).json({ error: '你已在该房间中' });
            return;
        }
        gameState.playerIds.push(userIdStr);
        gameState.status = 'READY';

        await syncAndSaveState(gameId, gameState);
        res.json({ gameId });
    } catch (err) {
        console.error('Join friend game error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/games/friend/:gameId/status', async (req, res): Promise<void> => {
    const authHeader = req.headers.authorization;
    if (!authHeader) { res.status(401).json({ error: 'Unauthorized' }); return; }
    const user = verifyToken(authHeader.split(' ')[1]);
    if (!user) { res.status(401).json({ error: 'Invalid token' }); return; }

    try {
        const { gameId } = req.params;
        if (!gameId || !gameId.startsWith('friend_')) {
            res.status(400).json({ error: 'Invalid friend game id' });
            return;
        }

        const rows = await pool.query('SELECT state FROM games WHERE id = ?', [gameId]);
        if (rows.length === 0) {
            res.status(404).json({ error: 'Game not found' });
            return;
        }

        const gameState = typeof rows[0].state === 'string' ? JSON.parse(rows[0].state) : rows[0].state;
        const playerIds = Array.isArray(gameState.playerIds) ? gameState.playerIds : [];
        const userIdStr = user.userId.toString();

        if (!playerIds.includes(userIdStr)) {
            res.status(403).json({ error: 'Forbidden' });
            return;
        }

        res.json({
            gameId,
            joined: playerIds.length >= 2,
            playerCount: playerIds.length,
            status: gameState.status || 'WAITING'
        });
    } catch (err) {
        console.error('Friend game status error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Matchmaking Queue
const matchmakingQueue: { userId: string; socketId?: string; timestamp: number; deck?: Card[]; turnTimerLimit?: number }[] = [];
// Matchmaking results map: userId -> gameId
const matchmakingResults = new Map<string, string>();
const authenticatedSockets = new Map<string, string>();
const getMatchmakingQueueIndex = (userId: string | number) => matchmakingQueue.findIndex(q => q.userId === userId.toString());
const removeMatchmakingQueueEntries = (userId: string | number) => {
    const userIdStr = userId.toString();
    for (let i = matchmakingQueue.length - 1; i >= 0; i--) {
        if (matchmakingQueue[i].userId === userIdStr) {
            matchmakingQueue.splice(i, 1);
        }
    }
};
const popMatchmakingOpponent = (userId: string | number) => {
    const userIdStr = userId.toString();
    const opponentIndex = matchmakingQueue.findIndex(q => q.userId !== userIdStr);
    if (opponentIndex === -1) return null;
    const [opponent] = matchmakingQueue.splice(opponentIndex, 1);
    return opponent || null;
};


app.post('/api/games/matchmaking', async (req, res): Promise<void> => {
    const authHeader = req.headers.authorization;
    if (!authHeader) { res.status(401).json({ error: 'Unauthorized' }); return; }
    const user = verifyToken(authHeader.split(' ')[1]);
    if (!user) { res.status(401).json({ error: 'Invalid token' }); return; }

    try {
        const { deckId, turnTimerLimit } = req.body;
        
        // 1. Check if user is already matched in a pending result
        const existingGameId = matchmakingResults.get(user.userId.toString());
        if (existingGameId) {
            res.json({ gameId: existingGameId, matched: true });
            return;
        }

        if (!deckId) { res.status(400).json({ error: '请选择卡组' }); return; }

        const validation = await validateUserDeck(user.userId, deckId);
        if (!validation.valid) { res.status(400).json({ error: validation.error }); return; }

        // Remove self from queue if already there (to avoid duplicates or refresh timestamp)
        const userIdStr = user.userId.toString();
        removeMatchmakingQueueEntries(userIdStr);

        // 2. Try to match with someone else
        const opponent = popMatchmakingOpponent(userIdStr);
        if (opponent) {
            // Create a match
            const gameId = 'match_' + Math.random().toString(36).substring(2, 9);
            const gameState = await ServerGameService.createMatchGameState(opponent.userId, opponent.deck!, userIdStr, validation.cards!, turnTimerLimit || opponent.turnTimerLimit);
            gameState.gameId = gameId;

            await pool.query('INSERT INTO games (id, state, status) VALUES (?, ?, 0)', [gameId, JSON.stringify(gameState)]);

            // Store results for both players to allow discovery via polling
            matchmakingResults.set(userIdStr, gameId);
            matchmakingResults.set(opponent.userId, gameId);

            // Notify via socket as well (as an optimization)
            if (opponent.socketId) {
                io.to(opponent.socketId).emit('matchFound', { gameId });
            }
            const currentSocketId = authenticatedSockets.get(userIdStr);
            if (currentSocketId) {
                io.to(currentSocketId).emit('matchFound', { gameId });
            }

            res.json({ gameId, matched: true });
        } else {
            // Add to queue
            matchmakingQueue.push({
                userId: userIdStr,
                socketId: authenticatedSockets.get(userIdStr),
                deck: validation.cards,
                timestamp: Date.now(),
                turnTimerLimit
            });
            res.json({ matched: false, position: matchmakingQueue.length });
        }
    } catch (err) {
        console.error('Matchmaking error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/games/matchmaking/status', async (req, res): Promise<void> => {
    const authHeader = req.headers.authorization;
    if (!authHeader) { res.status(401).json({ error: 'Unauthorized' }); return; }
    const user = verifyToken(authHeader.split(' ')[1]);
    if (!user) { res.status(401).json({ error: 'Invalid token' }); return; }

    const userIdStr = user.userId.toString();
    const existingGameId = matchmakingResults.get(userIdStr);
    if (existingGameId) {
        res.json({ gameId: existingGameId, matched: true });
        return;
    }

    const queueIndex = getMatchmakingQueueIndex(userIdStr);
    res.json({
        matched: false,
        queued: queueIndex !== -1,
        position: queueIndex === -1 ? null : queueIndex + 1
    });
});

// Cancel matchmaking
app.post('/api/games/matchmaking/cancel', async (req, res): Promise<void> => {
    const authHeader = req.headers.authorization;
    if (!authHeader) { res.status(401).json({ error: 'Unauthorized' }); return; }
    const user = verifyToken(authHeader.split(' ')[1]);
    if (!user) { res.status(401).json({ error: 'Invalid token' }); return; }

    removeMatchmakingQueueEntries(user.userId);
    res.json({ success: true });
});

// Legacy create game (kept for compatibility)
app.post('/api/games', async (req, res): Promise<void> => {
    const authHeader = req.headers.authorization;
    if (!authHeader) { res.status(401).json({ error: 'Unauthorized' }); return; }
    const user = verifyToken(authHeader.split(' ')[1]);
    if (!user) { res.status(401).json({ error: 'Invalid token' }); return; }

    try {
        const mode = req.body?.practice ? 'practice' : 'match';
        const prefix = mode === 'practice' ? 'practice_' : 'match_';
        const gameId = prefix + Math.random().toString(36).substring(2, 9);
        const initialState = {
            playerIds: mode === 'practice' ? [user.userId, 'BOT_PLAYER'] : [user.userId],
            players: {},
            status: mode === 'practice' ? 'READY' : 'WAITING',
            phase: 'INIT',
            turnCount: 0,
            currentTurnPlayer: 0,
            logs: [],
            mode,
            counterStack: [],
            isCountering: 0,
            effectUsage: {}
        };
        await pool.query('INSERT INTO games (id, state, status) VALUES (?, ?, 0)', [gameId, JSON.stringify(initialState)]);
        res.json({ gameId });
    } catch (err) {
        console.error('Create game error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});


// Profile Endpoint
app.get('/api/user/profile', async (req, res): Promise<void> => {
    const authHeader = req.headers.authorization;
    if (!authHeader) { res.status(401).json({ error: 'Unauthorized' }); return; }
    const user = verifyToken(authHeader.split(' ')[1]);
    if (!user) { res.status(401).json({ error: 'Invalid token' }); return; }

    try {
        const rows = await pool.query('SELECT favorite_card_id, favorite_back_id, coins, card_crystals FROM users WHERE id = ?', [user.userId]);
        res.json({
            favoriteCardId: rows.length > 0 ? rows[0].favorite_card_id : null,
            favoriteBackId: rows.length > 0 ? rows[0].favorite_back_id : 'default',
            coins: rows.length > 0 ? Number(rows[0].coins) : 0,
            cardCrystals: rows.length > 0 ? Number(rows[0].card_crystals) : 0
        });
    } catch (err) {
        res.status(500).json({ error: 'DB Error' });
    }
});

app.put('/api/user/profile', async (req, res): Promise<void> => {
    const authHeader = req.headers.authorization;
    if (!authHeader) { res.status(401).json({ error: 'Unauthorized' }); return; }
    const user = verifyToken(authHeader.split(' ')[1]);
    if (!user) { res.status(401).json({ error: 'Invalid token' }); return; }

    try {
        const { favoriteCardId, favoriteBackId } = req.body;
        if (favoriteCardId !== undefined && favoriteBackId !== undefined) {
            await pool.query('UPDATE users SET favorite_card_id = ?, favorite_back_id = ? WHERE id = ?', [favoriteCardId, favoriteBackId, user.userId]);
        } else if (favoriteCardId !== undefined) {
            await pool.query('UPDATE users SET favorite_card_id = ? WHERE id = ?', [favoriteCardId, user.userId]);
        } else if (favoriteBackId !== undefined) {
            await pool.query('UPDATE users SET favorite_back_id = ? WHERE id = ?', [favoriteBackId, user.userId]);
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'DB Error' });
    }
});

// Decks Endpoints
app.get('/api/user/decks', async (req, res): Promise<void> => {
    const authHeader = req.headers.authorization;
    if (!authHeader) { res.status(401).json({ error: 'Unauthorized' }); return; }
    const user = verifyToken(authHeader.split(' ')[1]);
    if (!user) { res.status(401).json({ error: 'Invalid token' }); return; }

    try {
        const rows = await pool.query('SELECT * FROM decks WHERE user_id = ?', [user.userId]);
        const decks = rows.map((r: any) => ({
            id: r.id,
            name: r.name,
            cards: typeof r.cards === 'string' ? JSON.parse(r.cards) : r.cards,
            createdAt: Number(r.created_at),
            updatedAt: Number(r.updated_at)
        }));
        res.json({ decks });
    } catch (err) {
        res.status(500).json({ error: 'DB Error' });
    }
});

app.post('/api/user/decks', async (req, res): Promise<void> => {
    const authHeader = req.headers.authorization;
    if (!authHeader) { res.status(401).json({ error: 'Unauthorized' }); return; }
    const user = verifyToken(authHeader.split(' ')[1]);
    if (!user) { res.status(401).json({ error: 'Invalid token' }); return; }

    try {
        const deckData = req.body;
        const deckId = Math.random().toString(36).substring(2, 10);

        // Ensure we only store IDs
        let cardIds = deckData.cards || [];
        if (cardIds.length > 0 && typeof cardIds[0] === 'object') {
            cardIds = cardIds.map((c: any) => c.id);
        }

        await pool.query(
            'INSERT INTO decks (id, user_id, name, cards, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
            [deckId, user.userId, deckData.name, JSON.stringify(cardIds), Date.now(), Date.now()]
        );
        res.json({ id: deckId });
    } catch (err) {
        res.status(500).json({ error: 'DB Error' });
    }
});

app.put('/api/user/decks/:id', async (req, res): Promise<void> => {
    const authHeader = req.headers.authorization;
    if (!authHeader) { res.status(401).json({ error: 'Unauthorized' }); return; }
    const user = verifyToken(authHeader.split(' ')[1]);
    if (!user) { res.status(401).json({ error: 'Invalid token' }); return; }

    try {
        const deckId = req.params.id;
        const deckData = req.body;

        if (deckData.cards) {
            let cardIds = deckData.cards;
            if (cardIds.length > 0 && typeof cardIds[0] === 'object') {
                cardIds = cardIds.map((c: any) => c.id);
            }
            await pool.query('UPDATE decks SET name = ?, cards = ?, updated_at = ? WHERE id = ? AND user_id = ?',
                [deckData.name, JSON.stringify(cardIds), Date.now(), deckId, user.userId]);
        } else {
            await pool.query('UPDATE decks SET name = ?, updated_at = ? WHERE id = ? AND user_id = ?',
                [deckData.name, Date.now(), deckId, user.userId]);
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'DB Error' });
    }
});

app.delete('/api/user/decks/:id', async (req, res): Promise<void> => {
    const authHeader = req.headers.authorization;
    if (!authHeader) { res.status(401).json({ error: 'Unauthorized' }); return; }
    const user = verifyToken(authHeader.split(' ')[1]);
    if (!user) { res.status(401).json({ error: 'Invalid token' }); return; }

    try {
        const deckId = req.params.id;
        await pool.query('DELETE FROM decks WHERE id = ? AND user_id = ?', [deckId, user.userId]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'DB Error' });
    }
});

app.post('/api/user/decks/:id/copy', async (req, res): Promise<void> => {
    const authHeader = req.headers.authorization;
    if (!authHeader) { res.status(401).json({ error: 'Unauthorized' }); return; }
    const user = verifyToken(authHeader.split(' ')[1]);
    if (!user) { res.status(401).json({ error: 'Invalid token' }); return; }

    try {
        const deckId = req.params.id;
        const rows = await pool.query('SELECT * FROM decks WHERE id = ? AND user_id = ?', [deckId, user.userId]);
        if (rows.length === 0) { res.status(404).json({ error: 'Not found' }); return; }

        const original = rows[0];
        const newDeckId = Math.random().toString(36).substring(2, 10);
        await pool.query(
            'INSERT INTO decks (id, user_id, name, cards, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
            [newDeckId, user.userId, original.name + ' (副本)', typeof original.cards === 'string' ? original.cards : JSON.stringify(original.cards), Date.now(), Date.now()]
        );
        res.json({ id: newDeckId });
    } catch (err) {
        res.status(500).json({ error: 'DB Error' });
    }
});

app.get('/api/games', async (req, res): Promise<void> => {
    try {
        const rows = await pool.query('SELECT * FROM games WHERE status = 0');
        const games = rows.map((r: any) => ({
            id: r.id,
            ...(typeof r.state === 'string' ? JSON.parse(r.state) : r.state)
        }));
        res.json({ games });
    } catch (e) {
        res.status(500).json({ error: 'DB Error' });
    }
});

// Collection Endpoint
app.get('/api/user/collection', async (req, res): Promise<void> => {
    const authHeader = req.headers.authorization;
    if (!authHeader) { res.status(401).json({ error: 'Unauthorized' }); return; }
    const user = verifyToken(authHeader.split(' ')[1]);
    if (!user) { res.status(401).json({ error: 'Invalid token' }); return; }

    try {
        const rows = await pool.query('SELECT card_id, quantity FROM user_cards WHERE user_id = ?', [user.userId]);
        const collection: Record<string, number> = {};
        for (const r of rows) {
            collection[r.card_id] = Number(r.quantity);
        }
        res.json({ collection });
    } catch (err) {
        res.status(500).json({ error: 'DB Error' });
    }
});

let CARD_POOL: string[] = [];
let CARD_RARITIES: Record<string, string> = {};

function syncStoreFromLibrary() {
    const newPool: string[] = [];
    const newRarities: Record<string, string> = {};

    for (const card of getLiveCardVariations().filter(isCardVisibleInCatalog)) {
        newPool.push(card.uniqueId);
        newRarities[card.uniqueId] = card.rarity;
    }

    CARD_POOL = newPool;
    CARD_RARITIES = newRarities;
    console.log(`[Store] Synced ${CARD_POOL.length} cards from script library.`);
}


const CRYSTAL_VALUES: Record<string, { decompose: number, produce: number }> = {
    C: { decompose: 1, produce: 5 },
    U: { decompose: 1, produce: 5 },
    R: { decompose: 5, produce: 20 },
    SR: { decompose: 20, produce: 80 },
    UR: { decompose: 100, produce: 400 },
    SER: { decompose: 400, produce: 1600 },
    PR: { decompose: 100, produce: 400 },
};

function pickRandom<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

const CLIENT_CARD_CATALOG_CACHE = new Map<string, Card[]>();

function serializeCatalogCard(card: Card, includeEffects: boolean): Card {
    return {
        id: card.id,
        uniqueId: card.uniqueId,
        gamecardId: '',
        fullName: card.fullName,
        specialName: card.specialName,
        type: card.type,
        color: card.color,
        colorReq: { ...(card.colorReq || {}) },
        acValue: card.acValue,
        power: card.power,
        damage: card.damage,
        godMark: !!card.godMark,
        displayState: 'FRONT_UPRIGHT',
        feijingMark: !!card.feijingMark,
        effects: includeEffects
            ? card.effects?.map(effect => ({
                type: effect.type,
                description: effect.description,
                content: effect.content
            }))
            : undefined,
        imageUrl: card.imageUrl,
        fullImageUrl: card.fullImageUrl,
        rarity: card.rarity,
        availableRarities: card.availableRarities,
        cardPackage: card.cardPackage,
        faction: card.faction,
        isrush: !!card.isrush,
        isAnnihilation: !!card.isAnnihilation,
        isShenyi: !!card.isShenyi,
        isHeroic: !!card.isHeroic
    };
}

function getClientCardCatalog(includeEffects: boolean) {
    const cacheKey = includeEffects ? 'with-effects' : 'no-effects';

    if (!CLIENT_CARD_CATALOG_CACHE.has(cacheKey)) {
        CLIENT_CARD_CATALOG_CACHE.set(
            cacheKey,
            getLiveCardVariations().filter(isCardVisibleInCatalog).map(card => serializeCatalogCard(card, includeEffects))
        );
    }

    return CLIENT_CARD_CATALOG_CACHE.get(cacheKey)!;
}

app.get('/api/cards/meta', async (req, res): Promise<void> => {
    try {
        const includeEffects = req.query.includeEffects === '1';
        res.setHeader('Cache-Control', 'public, max-age=300');
        res.json({ cards: getClientCardCatalog(includeEffects) });
    } catch (err) {
        console.error('[CardsMeta] Failed to build card catalog:', err);
        res.status(500).json({ error: 'Failed to load card catalog' });
    }
});

app.post('/api/store/buy-pack', async (req, res): Promise<void> => {
    const authHeader = req.headers.authorization;
    if (!authHeader) { res.status(401).json({ error: 'Unauthorized' }); return; }
    const user = verifyToken(authHeader.split(' ')[1]);
    if (!user) { res.status(401).json({ error: 'Invalid token' }); return; }

    const { packType, count = 1 } = req.body;
    const isPrizePack = packType === 'prize';
    const singleCost = isPrizePack ? 20 : 10;
    const totalCost = singleCost * count;

    let conn;
    try {
        conn = await pool.getConnection();
        await conn.beginTransaction();

        // Check coins
        const userRows = await conn.query('SELECT coins FROM users WHERE id = ?', [user.userId]);
        const coins = Number(userRows[0].coins);
        if (coins < totalCost) {
            await conn.rollback();
            res.status(400).json({ error: '金币不足' });
            return;
        }

        const allCards = getLiveCardVariations().filter(isCardVisibleInCatalog);
        const drawnCards: Card[] = [];

        if (isPrizePack) {
            const prPool = allCards.filter(c => c.rarity === 'PR');
            if (prPool.length === 0) {
                await conn.rollback();
                res.status(400).json({ error: '奖品包暂无可抽卡牌' });
                return;
            }
            for (let i = 0; i < count; i++) {
                drawnCards.push(pickRandom(prPool));
            }
        } else {
            // Basic Pack Pity Setup
            let pityRows = await conn.query('SELECT * FROM pack_history WHERE user_id = ?', [user.userId]);
            if (pityRows.length === 0) {
                await conn.query('INSERT INTO pack_history (user_id, total_packs, packs_since_sr, packs_since_ur) VALUES (?, 0, 0, 0)', [user.userId]);
                pityRows = [{ total_packs: 0, packs_since_sr: 0, packs_since_ur: 0 }];
            }
            let packsSinceSR = Number(pityRows[0].packs_since_sr);
            let packsSinceUR = Number(pityRows[0].packs_since_ur);
            let totalPacks = Number(pityRows[0].total_packs);

            const cuPool = allCards.filter(c => c.rarity === 'C' || c.rarity === 'U');
            const rPool = allCards.filter(c => c.rarity === 'R');
            const srPool = allCards.filter(c => c.rarity === 'SR');
            const urPool = allCards.filter(c => c.rarity === 'UR' || c.rarity === 'SER');

            for (let p = 0; p < count; p++) {
                packsSinceSR++;
                packsSinceUR++;
                totalPacks++;

                // Pick 4 C/U cards
                for (let i = 0; i < 4; i++) {
                    drawnCards.push(pickRandom(cuPool));
                }

                // Pick 1 R+ card with pity
                let guaranteedCard: Card;
                if (packsSinceUR >= 50 && urPool.length > 0) {
                    guaranteedCard = pickRandom(urPool);
                    packsSinceUR = 0;
                    packsSinceSR = 0;
                } else if (packsSinceSR >= 10 && srPool.length > 0) {
                    guaranteedCard = pickRandom(srPool);
                    packsSinceSR = 0;
                } else {
                    const roll = Math.random();
                    if (roll < 0.02 && urPool.length > 0) {
                        guaranteedCard = pickRandom(urPool);
                        packsSinceUR = 0;
                        packsSinceSR = 0;
                    } else if (roll < 0.15 && srPool.length > 0) {
                        guaranteedCard = pickRandom(srPool);
                        packsSinceSR = 0;
                    } else if (rPool.length > 0) {
                        guaranteedCard = pickRandom(rPool);
                    } else {
                        guaranteedCard = pickRandom(cuPool);
                    }
                }
                drawnCards.push(guaranteedCard);
            }

            // Update pity counters once
            await conn.query(
                'UPDATE pack_history SET total_packs = ?, packs_since_sr = ?, packs_since_ur = ? WHERE user_id = ?',
                [totalPacks, packsSinceSR, packsSinceUR, user.userId]
            );
        }

        // Deduct coins
        await conn.query('UPDATE users SET coins = coins - ? WHERE id = ?', [totalCost, user.userId]);

        // Add cards to collection using batch logic (not really batch, but optimized loops)
        // Group by cardId to reduce queries
        const counts: Record<string, number> = {};
        drawnCards.forEach(c => counts[c.uniqueId] = (counts[c.uniqueId] || 0) + 1);

        for (const [cardId, qty] of Object.entries(counts)) {
            await conn.query(
                `INSERT INTO user_cards (user_id, card_id, quantity) VALUES (?, ?, ?)
                 ON DUPLICATE KEY UPDATE quantity = quantity + ?`,
                [user.userId, cardId, qty, qty]
            );
        }

        await conn.commit();

        const newBalanceRow = await pool.query('SELECT coins, card_crystals FROM users WHERE id = ?', [user.userId]);
        const finalPityRows = await pool.query('SELECT * FROM pack_history WHERE user_id = ?', [user.userId]);

        res.json({
            cards: drawnCards.map(c => ({ id: c.id, uniqueId: c.uniqueId, rarity: c.rarity })),
            newCoins: Number(newBalanceRow[0].coins),
            newCardCrystals: Number(newBalanceRow[0].card_crystals),
            totalPacks: finalPityRows.length > 0 ? Number(finalPityRows[0].total_packs) : 0,
            packsSinceSR: finalPityRows.length > 0 ? Number(finalPityRows[0].packs_since_sr) : 0,
            packsSinceUR: finalPityRows.length > 0 ? Number(finalPityRows[0].packs_since_ur) : 0,
        });
    } catch (err) {
        if (conn) await conn.rollback();
        console.error('Buy pack error:', err);
        res.status(500).json({ error: 'Internal error' });
    } finally {
        if (conn) conn.release();
    }
});

// Card Crystallization Endpoints
app.post('/api/user/decompose', async (req, res): Promise<void> => {
    const authHeader = req.headers.authorization;
    if (!authHeader) { res.status(401).json({ error: 'Unauthorized' }); return; }
    const user = verifyToken(authHeader.split(' ')[1]);
    if (!user) { res.status(401).json({ error: 'Invalid token' }); return; }

    const { cardId, quantity = 1 } = req.body;
    const card = (SERVER_CARD_LIBRARY as any)[cardId];
    if (!card) { res.status(404).json({ error: '卡牌未找到' }); return; }

    const values = CRYSTAL_VALUES[card.rarity];
    if (!values) { res.status(400).json({ error: '该稀有度无法分解' }); return; }

    let conn;
    try {
        conn = await pool.getConnection();
        await conn.beginTransaction();

        // Check ownership
        const cardRows = await conn.query('SELECT quantity FROM user_cards WHERE user_id = ? AND card_id = ?', [user.userId, cardId]);
        if (cardRows.length === 0 || Number(cardRows[0].quantity) < quantity) {
            await conn.rollback();
            res.status(400).json({ error: '持有数量不足' });
            return;
        }

        const crystalsGained = values.decompose * quantity;

        // Update cards
        if (Number(cardRows[0].quantity) === quantity) {
            await conn.query('DELETE FROM user_cards WHERE user_id = ? AND card_id = ?', [user.userId, cardId]);
        } else {
            await conn.query('UPDATE user_cards SET quantity = quantity - ? WHERE user_id = ? AND card_id = ?', [quantity, user.userId, cardId]);
        }

        // Update crystals
        await conn.query('UPDATE users SET card_crystals = card_crystals + ? WHERE id = ?', [crystalsGained, user.userId]);

        await conn.commit();
        const newBalanceRow = await pool.query('SELECT coins, card_crystals FROM users WHERE id = ?', [user.userId]);
        res.json({ success: true, newCardCrystals: Number(newBalanceRow[0].card_crystals), crystalsGained });
    } catch (err) {
        if (conn) await conn.rollback();
        console.error('Decompose error:', err);
        res.status(500).json({ error: 'Internal error' });
    } finally {
        if (conn) conn.release();
    }
});

app.post('/api/user/craft', async (req, res): Promise<void> => {
    const authHeader = req.headers.authorization;
    if (!authHeader) { res.status(401).json({ error: 'Unauthorized' }); return; }
    const user = verifyToken(authHeader.split(' ')[1]);
    if (!user) { res.status(401).json({ error: 'Invalid token' }); return; }

    const { cardId } = req.body;
    const card = (SERVER_CARD_LIBRARY as any)[cardId];
    if (!card) { res.status(404).json({ error: '卡牌未找到' }); return; }

    const values = CRYSTAL_VALUES[card.rarity];
    if (!values) { res.status(400).json({ error: '该稀有度无法制作' }); return; }

    let conn;
    try {
        conn = await pool.getConnection();
        await conn.beginTransaction();

        // Check crystals
        const userRows = await conn.query('SELECT card_crystals FROM users WHERE id = ?', [user.userId]);
        const currentCrystals = Number(userRows[0].card_crystals);
        if (currentCrystals < values.produce) {
            await conn.rollback();
            res.status(400).json({ error: '卡晶不足' });
            return;
        }

        // Deduct crystals
        await conn.query('UPDATE users SET card_crystals = card_crystals - ? WHERE id = ?', [values.produce, user.userId]);

        // Add card
        await conn.query(
            `INSERT INTO user_cards (user_id, card_id, quantity) VALUES (?, ?, 1)
             ON DUPLICATE KEY UPDATE quantity = quantity + 1`,
            [user.userId, cardId]
        );

        await conn.commit();
        const newBalanceRow = await pool.query('SELECT coins, card_crystals FROM users WHERE id = ?', [user.userId]);
        res.json({ success: true, newCardCrystals: Number(newBalanceRow[0].card_crystals) });
    } catch (err) {
        if (conn) await conn.rollback();
        console.error('Craft error:', err);
        res.status(500).json({ error: 'Internal error' });
    } finally {
        if (conn) conn.release();
    }
});

// Socket.IO logic
// Helper to create initial player state
function createInitialPlayer(deckCards: Card[], displayName: string, isFirst: boolean, turnTimerLimit?: number): PlayerState {
    const fullDeck: Card[] = deckCards.map(c => {
        const uniqueId = Math.random().toString(36).substring(2, 10);
        return {
            ...c,
            gamecardId: uniqueId,
            runtimeFingerprint: `FP_${uniqueId}_${Date.now()}`,
            isExhausted: false,
            displayState: 'FRONT_UPRIGHT',
            cardlocation: 'DECK'
        };
    });

    // Perform Durstenfeld shuffle (Fisher-Yates) 
    for (let i = fullDeck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [fullDeck[i], fullDeck[j]] = [fullDeck[j], fullDeck[i]];
    }

    // Draw initial 4 cards
    const hand = fullDeck.splice(0, 4).map(c => ({ ...c, cardlocation: 'HAND' as any }));

    return {
        uid: '', // Will be set by caller
        displayName: displayName,
        hand: hand,
        deck: fullDeck,
        grave: [],
        exile: [],
        playZone: [],
        unitZone: new Array(6).fill(null),
        itemZone: new Array(2).fill(null),
        erosionFront: new Array(10).fill(null),
        erosionBack: new Array(10).fill(null),
        isFirst: isFirst,
        mulliganDone: false,
        hasExhaustedThisTurn: [],
        isGoddessMode: false,
        isTurn: isFirst,
        timeRemaining: turnTimerLimit ? turnTimerLimit * 1000 : 300000,
        confrontationStrategy: 'AUTO'
    };

}

io.on('connection', (socket) => {
    // console.log('Client connected:', socket.id);

    socket.on('authenticate', (token) => {
        const user = verifyToken(token);
        if (user) {
            (socket as any).user = user;
            authenticatedSockets.set(user.userId.toString(), socket.id);
            const queueEntry = matchmakingQueue.find(q => q.userId === user.userId.toString());
            if (queueEntry) queueEntry.socketId = socket.id;
            socket.emit('authenticated');
        } else {
            socket.emit('unauthorized');
        }
    });

    socket.on('joinGame', async (data: { gameId: string, deckId?: string }) => {
        const user = (socket as any).user;
        if (!user) {
            // console.log('[Socket] joinGame failed: Socket not authenticated');
            socket.emit('error', '未授权，请重试');
            return;
        }

        const userIdStr = user.userId.toString();
        const gameId = typeof data === 'string' ? data : data.gameId;
        const deckId = typeof data === 'object' ? data.deckId : undefined;

        // console.log(`[Socket] Request gameId: ${gameId}`);
        if (!gameId || gameId === 'undefined') {
            // console.log('[Socket] joinGame failed: Missing or invalid gameId');
            socket.emit('error', '无效的房间ID');
            return;
        }

        socket.join(gameId);
        // console.log(`[Socket] User ${userIdStr} attempting to join game ${gameId}`);
        
        // Remove from match results once joined
        matchmakingResults.delete(userIdStr);


        try {
            await withGameLock(gameId, async () => {
                const rows = await pool.query('SELECT state FROM games WHERE id = ?', [gameId]);
                if (rows.length === 0) {
                    console.error(`[Socket] joinGame failed: Game ${gameId} not found`);
                    socket.emit('error', '未找到游戏战场');
                    return;
                }

                const gameState = typeof rows[0].state === 'string' ? JSON.parse(rows[0].state) : rows[0].state;
                ServerGameService.hydrateGameState(gameState);
                if (!gameState.players) gameState.players = {};

                const initializedPlayers = Object.keys(gameState.players);
                // console.log(`[Socket] joinGame for ${userIdStr} in ${gameId}. Current players: ${initializedPlayers.join(',')}`);

                // Initialize human player if they haven't been initialized yet
                if (!gameState.players[userIdStr]) {
                    if (deckId) {
                        // console.log(`[Socket] Initializing player ${userIdStr} in game ${gameId}`);
                        const deckRows = await pool.query('SELECT * FROM decks WHERE id = ?', [deckId]);
                        if (deckRows.length > 0) {
                            const deckCardsRaw = typeof deckRows[0].cards === 'string' ? JSON.parse(deckRows[0].cards) : deckRows[0].cards;

                            if (Object.keys(SERVER_CARD_LIBRARY).length === 0) {
                                await initServerCardLibrary();
                            }

                            const deckCards: Card[] = deckCardsRaw.map((id: string) => SERVER_CARD_LIBRARY[id]).filter(Boolean);

                            // Validate Deck
                            const validation = ServerGameService.validateDeck(deckCards);
                            if (!validation.valid) {
                                console.error(`[Socket] Deck validation failed for user ${userIdStr}`);
                                socket.emit('error', `卡组非法: ${validation.error}`);
                                return;
                            }

                            const isFirst = gameState.playerIds.map(id => id.toString()).indexOf(userIdStr) === 0;

                            const player = createInitialPlayer(deckCards, user.displayName || user.username || '玩家', isFirst, gameState.turnTimerLimit);
                            player.uid = userIdStr;
                            gameState.players[userIdStr] = player;

                            if (gameState.mode === 'practice' && !gameState.players['BOT_PLAYER']) {
                                const botPlayer = createInitialPlayer(deckCards, '机器人', !isFirst, gameState.turnTimerLimit);
                                botPlayer.uid = 'BOT_PLAYER';
                                botPlayer.mulliganDone = true;
                                gameState.players['BOT_PLAYER'] = botPlayer;
                            }

                            await syncAndSaveState(gameId, gameState);
                        } else {
                            console.error(`[Socket] Deck ${deckId} not found for user ${userIdStr}`);
                            socket.emit('error', '未找到选定的卡组');
                            return;
                        }
                    } else {
                        // Player not initialized and no deckId provided
                        // console.log(`[Socket] Player ${userIdStr} joinGame without deckId for uninitialized record`);
                    }
                } else {
                    // console.log(`[Socket] Player ${userIdStr} already initialized in ${gameId}`);
                }

                // Start the phase timer if it hasn't started yet and players are ready
                const initializedCount = Object.keys(gameState.players).length;
                const isInitial = gameState.phase === 'INIT' || gameState.phase === 'MULLIGAN';
                if (isInitial && initializedCount >= 2 && (gameState.phase === 'INIT' || !gameState.phaseTimerStart || gameState.phaseTimerStart === 0)) {
                    if (gameState.phase === 'INIT') {
                        // console.log(`[Socket] Game ${gameId} entering MULLIGAN phase`);
                        gameState.phase = 'MULLIGAN';
                        gameState.status = 'ACTIVE';
                        gameState.logs.push('所有玩家已准备就绪。开始调度阶段。');
                    }
                    gameState.phaseTimerStart = Date.now();
                    await syncAndSaveState(gameId, gameState);
                }

                // Always emit current state to the joining socket so they don't get stuck on "Syncing Battlefield"
                socket.emit('gameStateUpdate', gameState);
            });
        } catch (err) {
            console.error('[Socket] joinGame exception:', err);
            socket.emit('error', '战场同步过程中发生错误');
        }
    });

    socket.on('gameAction', async (data: { gameId: string, action: string, payload?: any }) => {
        const user = (socket as any).user;
        if (!user) return;

        const { gameId, action, payload } = data;
        // console.log(`[Socket] received gameAction: ${action} for game ${gameId}`, payload);

        await withGameLock(gameId, async () => {
            try {
                const rows = await pool.query('SELECT state FROM games WHERE id = ?', [gameId]);
                if (rows.length === 0) return;

                let gameState = typeof rows[0].state === 'string' ? JSON.parse(rows[0].state) : rows[0].state;
                ServerGameService.hydrateGameState(gameState);
                const myUid = user.userId.toString();
                const player = gameState.players[myUid];
                if (!player) {
                    // console.log(`[Socket] Action ${action} rejected: Player ${myUid} not found in game ${gameId}`);
                    return;
                }

                const syncCallback = async (state: GameState) => {
                    await syncAndSaveState(gameId, state);
                };

                if (action === 'MULLIGAN') {
                    const selectedIds: string[] = payload || [];
                    if (player.mulliganDone) return;

                    if (selectedIds.length > 0) {
                        const cardsToSwap = player.hand.filter((c: any) => selectedIds.includes(c.gamecardId));
                        player.hand = player.hand.filter((c: any) => !selectedIds.includes(c.gamecardId));

                        cardsToSwap.forEach((c: any) => {
                            c.cardlocation = 'DECK';
                            player.deck.push(c);
                        });

                        for (let i = 0; i < selectedIds.length; i++) {
                            const newCard = player.deck.shift();
                            if (newCard) {
                                newCard.cardlocation = 'HAND';
                                player.hand.push(newCard);
                            }
                        }

                        for (let i = player.deck.length - 1; i > 0; i--) {
                            const j = Math.floor(Math.random() * (i + 1));
                            [player.deck[i], player.deck[j]] = [player.deck[j], player.deck[i]];
                        }

                        gameState.logs.push(`${player.displayName} 更换了 ${selectedIds.length} 张卡牌。`);
                    } else {
                        gameState.logs.push(`${player.displayName} 接受了初始手牌。`);
                    }

                    player.mulliganDone = true;

                    const allDone = Object.values(gameState.players).every((p: any) => p.mulliganDone);
                    if (allDone) {
                        gameState.phase = 'START';
                        gameState.turnCount = 1;

                        const currentUid = gameState.playerIds[gameState.currentTurnPlayer];
                        gameState.playerIds.forEach((uid: string) => {
                            gameState.players[uid].isTurn = (uid === currentUid);
                        });

                        gameState.logs.push(`调度结束。第 1 回合开始，由 ${gameState.players[currentUid].displayName} 先行。`);
                        await advancePhase(gameState, gameId, myUid, socket);
                        return;
                    }
                } else if (action === 'PLAY_CARD') {
                    const { cardId, paymentSelection } = payload;
                    await ServerGameService.playCard(gameState, myUid, cardId, paymentSelection);
                } else if (action === 'ATTACK') {
                    const { attackerIds, isAlliance, targetId, skipDefense } = payload;
                    await ServerGameService.declareAttack(gameState, myUid, attackerIds, isAlliance, targetId, skipDefense, syncCallback);
                } else if (action === 'DEFEND') {
                    const { defenderId } = payload;
                    await ServerGameService.declareDefense(gameState, myUid, defenderId);
                } else if (action === 'RESOLVE_DAMAGE') {
                    await ServerGameService.resolveDamage(gameState);
                } else if (action === 'EROSION_CHOICE') {
                    const { choice, selectedCardId } = payload;
                    await ServerGameService.handleErosionChoice(gameState, myUid, choice, selectedCardId);
                } else if (action === 'DISCARD') {
                    const { cardId } = payload;
                    await ServerGameService.discardCard(gameState, myUid, cardId);
                } else if (action === 'ACTIVATE_EFFECT') {
                    const { cardId, effectIndex } = payload;
                    await ServerGameService.activateEffect(gameState, myUid, cardId, effectIndex);
                } else if (action === 'PASS_CONFRONTATION') {
                    await ServerGameService.passConfrontation(gameState, myUid, syncCallback);
                } else if (action === 'RESOLVE_PLAY') {
                    if (gameState.phase === 'COUNTERING') {
                        await ServerGameService.resolveCounterStack(gameState, syncCallback);
                    }
                } else if (action === 'SUBMIT_QUERY_CHOICE') {
                    const { queryId, selections } = payload;
                    await ServerGameService.handleQueryChoice(gameState, myUid, queryId, selections, syncCallback);
                } else if (action === 'CONFIRM_SHENYI' || action === 'DECLINE_SHENYI') {
                    await advancePhase(gameState, gameId, myUid, socket, action);
                } else if (action === 'MOVE_CARD') {
                    const { fromZone, toPlayerId, toZone, cardId } = payload;
                    await ServerGameService.moveCard(gameState, myUid, fromZone, toPlayerId, toZone, cardId, { isEffect: true });
                } else if (action === 'SET_CONFRONTATION_STRATEGY') {
                    const strategy = payload?.strategy;
                    if (strategy === 'ON' || strategy === 'AUTO' || strategy === 'OFF') {
                        player.confrontationStrategy = strategy;
                        gameState.logs.push(`[设置] ${player.displayName} 将对抗策略设为 ${strategy === 'ON' ? '全开' : strategy === 'AUTO' ? '自动' : '全关'}。`);
                    }
                } else if (action === 'END_PHASE') {
                    if (player.isTurn || gameState.phase === 'BATTLE_FREE' || gameState.phase === 'COUNTERING') {
                        await advancePhase(gameState, gameId, myUid, socket, payload);
                        await ServerGameService.checkTriggeredEffects(gameState);
                        await ServerGameService.applyConfrontationStrategy(gameState, syncCallback);
                        await syncAndSaveState(gameId, gameState);
                        if (gameState.gameStatus !== 2) {
                            triggerBotIfNeeded(gameState, gameId);
                        }
                        return; // advancePhase already calls syncAndSaveState
                    }
                } else if (action === 'SURRENDER') {
                    await ServerGameService.surrender(gameState, myUid);
                }

                await ServerGameService.applyConfrontationStrategy(gameState, syncCallback);

                // Ensure any dangling triggers are checked before saving state (Skip if game is over)
                if (gameState.gameStatus !== 2) {
                    await ServerGameService.checkTriggeredEffects(gameState);
                    await ServerGameService.applyConfrontationStrategy(gameState, syncCallback);
                }

                // Final state sync and save
                await syncAndSaveState(gameId, gameState);
                if (gameState.gameStatus !== 2) {
                    triggerBotIfNeeded(gameState, gameId);
                }
            } catch (err: any) {
                console.error('[Socket] Game action error:', err);
                socket.emit('error', { message: err.message || 'Unknown game error' });
            }
        });
    });

    socket.on('leaveGame', (gameId: string) => {
        if (gameId) {
            // console.log(`[Socket] User ${((socket as any).user?.userId) || socket.id} leaving game ${gameId}`);
            socket.leave(gameId);
        }
    });

    socket.on('disconnect', () => {
        // console.log('Client disconnected:', socket.id);
        const userIdStr = ((socket as any).user?.userId ?? '').toString();
        if (userIdStr && authenticatedSockets.get(userIdStr) === socket.id) {
            authenticatedSockets.delete(userIdStr);
        }
        matchmakingQueue.forEach(entry => {
            if (entry.socketId === socket.id) {
                delete entry.socketId;
            }
        });
    });
});

// Main bootstrap function
const start = async () => {
    try {
        console.log('[Server] Initializing card library...');
        await initServerCardLibrary();
        console.log('[Server] Syncing store from script library...');
        syncStoreFromLibrary();
        console.log('[Server] Connecting to database...');
        await dbInit();

        const PORT = process.env.PORT || 3001;
        httpServer.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    } catch (err) {
        console.error('[Server] Fatal initialization error:', err);
        process.exit(1);
    }
};

start();
