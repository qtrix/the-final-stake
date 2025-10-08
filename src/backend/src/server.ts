import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:5173',
        methods: ['GET', 'POST'],
    },
});

interface GameRoom {
    challengeId: string;
    players: {
        challenger: { address: string; socketId: string } | null;
        opponent: { address: string; socketId: string } | null;
    };
    gameState: {
        moves?: Record<string, any>;
        scores?: Record<string, number>;
        currentRound?: number;
    };
    gameType: string;
    startedAt: number;
}

const gameRooms = new Map<string, GameRoom>();

io.on('connection', (socket) => {
    console.log('✅ Client connected:', socket.id);

    socket.on('join_game', ({ challengeId, playerAddress, role, gameType }) => {
        console.log(`🎮 ${playerAddress} joining game ${challengeId} as ${role}`);

        socket.join(challengeId);

        if (!gameRooms.has(challengeId)) {
            gameRooms.set(challengeId, {
                challengeId,
                players: {
                    challenger: role === 'challenger' ? { address: playerAddress, socketId: socket.id } : null,
                    opponent: role === 'opponent' ? { address: playerAddress, socketId: socket.id } : null,
                },
                gameState: {},
                gameType: gameType || 'unknown',
                startedAt: Date.now(),
            });
        } else {
            const room = gameRooms.get(challengeId)!;
            if (role === 'challenger') {
                room.players.challenger = { address: playerAddress, socketId: socket.id };
            }
            if (role === 'opponent') {
                room.players.opponent = { address: playerAddress, socketId: socket.id };
            }
        }

        socket.to(challengeId).emit('player_joined', {
            playerAddress,
            role,
        });

        const room = gameRooms.get(challengeId);
        socket.emit('room_state', room);

        const bothPlayersConnected = room?.players.challenger && room?.players.opponent;
        if (bothPlayersConnected) {
            io.to(challengeId).emit('both_players_connected');
        }
    });

    socket.on('player_move', ({ challengeId, playerAddress, move, moveType, roundNumber }) => {
        console.log(`🎯 ${playerAddress} made move in ${challengeId}:`, { move, moveType, roundNumber });

        const room = gameRooms.get(challengeId);
        if (!room) {
            console.error('Room not found:', challengeId);
            return;
        }

        if (!room.gameState.moves) {
            room.gameState.moves = {};
        }

        const moveKey = `${moveType}_round${roundNumber || 1}`;
        if (!room.gameState.moves[moveKey]) {
            room.gameState.moves[moveKey] = {};
        }

        room.gameState.moves[moveKey][playerAddress] = move;

        socket.to(challengeId).emit('opponent_move', {
            playerAddress,
            move,
            moveType,
            roundNumber,
        });

        const moves = room.gameState.moves[moveKey];
        const challenger = room.players.challenger?.address;
        const opponent = room.players.opponent?.address;

        if (challenger && opponent && moves[challenger] && moves[opponent]) {
            io.to(challengeId).emit('round_complete', {
                moves: {
                    challenger: moves[challenger],
                    opponent: moves[opponent],
                },
                roundNumber,
                moveType,
            });
        }
    });

    socket.on('update_game_state', ({ challengeId, state }) => {
        const room = gameRooms.get(challengeId);
        if (!room) return;

        room.gameState = { ...room.gameState, ...state };
        socket.to(challengeId).emit('game_state_updated', state);
    });

    socket.on('player_ready', ({ challengeId, playerAddress }) => {
        console.log(`✅ ${playerAddress} is ready in ${challengeId}`);
        socket.to(challengeId).emit('opponent_ready', { playerAddress });
    });

    socket.on('game_ended', ({ challengeId, winner, loser, finalScores }) => {
        console.log(`🏆 Game ${challengeId} ended. Winner: ${winner}`);

        io.to(challengeId).emit('game_result', {
            winner,
            loser,
            finalScores
        });

        setTimeout(() => {
            gameRooms.delete(challengeId);
            console.log(`🧹 Cleaned up room ${challengeId}`);
        }, 10000);
    });

    socket.on('disconnect', () => {
        console.log('❌ Client disconnected:', socket.id);

        gameRooms.forEach((room, challengeId) => {
            const wasChallenger = room.players.challenger?.socketId === socket.id;
            const wasOpponent = room.players.opponent?.socketId === socket.id;

            if (wasChallenger || wasOpponent) {
                const disconnectedPlayer = wasChallenger
                    ? room.players.challenger?.address
                    : room.players.opponent?.address;

                socket.to(challengeId).emit('opponent_disconnected', {
                    playerAddress: disconnectedPlayer,
                });

                if (wasChallenger) room.players.challenger = null;
                if (wasOpponent) room.players.opponent = null;
            }
        });
    });

    socket.on('ping_opponent', ({ challengeId }) => {
        socket.to(challengeId).emit('pong_response');
    });
});

app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        activeRooms: gameRooms.size,
        rooms: Array.from(gameRooms.values()).map(r => ({
            challengeId: r.challengeId,
            gameType: r.gameType,
            players: {
                challenger: r.players.challenger?.address || null,
                opponent: r.players.opponent?.address || null,
            },
            uptime: Date.now() - r.startedAt,
        }))
    });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
    console.log(`🚀 WebSocket server running on port ${PORT}`);
});