import { Server, Socket } from 'socket.io';
import { pool } from './db';

// We import the GameService from the original codebase temporarily,
// but we will need to rewrite it to not use firebase/firestore!
// Since we are moving it, let's create a new ServerGameService.
import { ServerGameService } from './ServerGameService';

export const setupGameHandlers = (io: Server, socket: Socket) => {
    
    socket.on('gameAction', async (data) => {
        const { gameId, action, payload } = data;
        const user = (socket as any).user;
        if (!user) return;
        
        try {
            // Retrieve current game state
            const rows = await pool.query('SELECT state FROM games WHERE id = ?', [gameId]);
            if (rows.length === 0) return;
            
            let gameState = typeof rows[0].state === 'string' ? JSON.parse(rows[0].state) : rows[0].state;
            
            // Execute Action
            switch (action) {
                case 'PLAY_CARD':
                    gameState = await ServerGameService.playCard(gameState, user.userId, payload.cardId, payload.paymentSelection);
                    break;
                case 'RESOLVE_PLAY':
                    gameState = await ServerGameService.resolvePlay(gameState);
                    break;
                case 'DECLARE_ATTACK':
                    gameState = await ServerGameService.declareAttack(gameState, user.userId, payload.attackerIds, payload.isAlliance);
                    break;
                case 'DECLARE_DEFENSE':
                    gameState = await ServerGameService.declareDefense(gameState, user.userId, payload.defenderId);
                    break;
                case 'RESOLVE_DAMAGE':
                    gameState = await ServerGameService.resolveDamage(gameState);
                    break;
                case 'DISCARD_CARD':
                    gameState = await ServerGameService.discardCard(gameState, user.userId, payload.cardId);
                    break;
                case 'ADVANCE_PHASE':
                    gameState = await ServerGameService.advancePhase(gameState, payload.action);
                    break;
                case 'SUBMIT_QUERY_CHOICE':
                    gameState = await ServerGameService.handleQueryChoice(gameState, user.userId, payload.queryId, payload.selections);
                    break;
                case 'SURRENDER':
                    gameState = await ServerGameService.surrender(gameState, user.userId);
                    break;
            }
            
            // Save state back to DB
            await pool.query('UPDATE games SET state = ? WHERE id = ?', [JSON.stringify(gameState), gameId]);
            
            // Broadcast new state to room
            io.to(gameId).emit('gameStateUpdate', gameState);
            
        } catch (err: any) {
            // console.error('Game Action Error:', err);
            socket.emit('gameError', { message: err.message || 'Action failed' });
        }
    });

};
