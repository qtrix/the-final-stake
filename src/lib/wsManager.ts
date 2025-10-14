// src/lib/wsManager.ts - WebSocket Manager pentru PvP Real-Time

import { io, Socket } from 'socket.io-client';
import type { RPSMove } from './gameEngines/rockPaperScissors';

// 🔥 SCHIMBĂ CU URL-UL TĂU DE PE RAILWAY
const WS_URL = 'solana-survivor-pvp-server-production.up.railway.app';

interface MoveData {
    playerAddress: string;
    move: RPSMove;
}

interface WSCallbacks {
    onPlayerJoined?: (data: { playerAddress: string; playersCount: number; players: string[] }) => void;
    onGameReady?: (data: { players: string[] }) => void;
    onOpponentMoved?: (data: { playerAddress: string; round: number }) => void;
    onRoundComplete?: (data: { round: number; moves: MoveData[] }) => void;
    onGameEnded?: (data: { winner: string }) => void;
    onOpponentLeft?: (data: { playerAddress: string }) => void;
    onError?: (error: any) => void;
}

export class WebSocketManager {
    private socket: Socket | null = null;
    private challengeId: string;
    private playerAddress: string;
    private callbacks: WSCallbacks = {};
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 5;

    constructor(challengeId: string, playerAddress: string) {
        this.challengeId = challengeId;
        this.playerAddress = playerAddress;
    }

    /**
     * Connect to WebSocket server
     */
    connect(callbacks: WSCallbacks) {
        this.callbacks = callbacks;

        try {
            console.log('🔌 Connecting to WebSocket server...', WS_URL);

            this.socket = io(WS_URL, {
                transports: ['websocket', 'polling'],
                reconnection: true,
                reconnectionAttempts: this.maxReconnectAttempts,
                reconnectionDelay: 1000,
                timeout: 10000,
            });

            this.setupEventListeners();
        } catch (error) {
            console.error('❌ WebSocket connection error:', error);
            if (this.callbacks.onError) {
                this.callbacks.onError(error);
            }
        }
    }

    /**
     * Setup all event listeners
     */
    private setupEventListeners() {
        if (!this.socket) return;

        this.socket.on('connect', () => {
            console.log('✅ WebSocket connected! Socket ID:', this.socket?.id);
            this.reconnectAttempts = 0;

            // Auto-join game room on connect
            this.joinGame();
        });

        this.socket.on('disconnect', (reason) => {
            console.log('❌ WebSocket disconnected:', reason);

            if (reason === 'io server disconnect') {
                // Server kicked us, reconnect manually
                this.socket?.connect();
            }
        });

        this.socket.on('connect_error', (error) => {
            console.error('❌ Connection error:', error.message);
            this.reconnectAttempts++;

            if (this.reconnectAttempts >= this.maxReconnectAttempts) {
                console.error('❌ Max reconnection attempts reached');
                if (this.callbacks.onError) {
                    this.callbacks.onError(new Error('WebSocket connection failed after multiple attempts'));
                }
            }
        });

        this.socket.on('player_joined', (data) => {
            console.log('👤 Player joined:', data);
            if (this.callbacks.onPlayerJoined) {
                this.callbacks.onPlayerJoined(data);
            }
        });

        this.socket.on('game_ready', (data) => {
            console.log('🎮 Game ready to start:', data);
            if (this.callbacks.onGameReady) {
                this.callbacks.onGameReady(data);
            }
        });

        this.socket.on('opponent_moved', (data) => {
            console.log('✋ Opponent made a move (round ' + data.round + ')');
            if (this.callbacks.onOpponentMoved) {
                this.callbacks.onOpponentMoved(data);
            }
        });

        this.socket.on('round_complete', (data) => {
            console.log('🎲 Round complete:', data);
            if (this.callbacks.onRoundComplete) {
                this.callbacks.onRoundComplete(data);
            }
        });

        this.socket.on('game_ended', (data) => {
            console.log('🏆 Game ended:', data);
            if (this.callbacks.onGameEnded) {
                this.callbacks.onGameEnded(data);
            }
        });

        this.socket.on('opponent_left', (data) => {
            console.log('👋 Opponent left:', data);
            if (this.callbacks.onOpponentLeft) {
                this.callbacks.onOpponentLeft(data);
            }
        });

        this.socket.on('error', (error) => {
            console.error('❌ Socket error:', error);
            if (this.callbacks.onError) {
                this.callbacks.onError(error);
            }
        });
    }

    /**
     * Join game room
     */
    joinGame() {
        if (!this.socket?.connected) {
            console.warn('⚠️ Cannot join game - socket not connected');
            return;
        }

        console.log(`🚪 Joining game room: ${this.challengeId}`);
        this.socket.emit('join_game', {
            challengeId: this.challengeId,
            playerAddress: this.playerAddress,
        });
    }

    /**
     * Submit move
     */
    submitMove(move: RPSMove, round: number) {
        if (!this.socket?.connected) {
            console.warn('⚠️ Cannot submit move - socket not connected');
            throw new Error('WebSocket not connected');
        }

        console.log(`✋ Submitting move: ${move} (Round ${round})`);
        this.socket.emit('submit_move', {
            challengeId: this.challengeId,
            playerAddress: this.playerAddress,
            move,
            round,
        });
    }

    /**
     * Notify game end
     */
    endGame(winner: string) {
        if (!this.socket?.connected) {
            console.warn('⚠️ Cannot notify game end - socket not connected');
            return;
        }

        console.log(`🏆 Notifying game end. Winner: ${winner.slice(0, 8)}`);
        this.socket.emit('game_end', {
            challengeId: this.challengeId,
            winner,
        });
    }

    /**
     * Leave game
     */
    leaveGame() {
        if (!this.socket?.connected) {
            return;
        }

        console.log(`👋 Leaving game: ${this.challengeId}`);
        this.socket.emit('leave_game', {
            challengeId: this.challengeId,
            playerAddress: this.playerAddress,
        });
    }

    /**
     * Disconnect from server
     */
    disconnect() {
        if (this.socket) {
            this.leaveGame();
            this.socket.disconnect();
            this.socket = null;
            console.log('🔌 WebSocket disconnected and cleaned up');
        }
    }

    /**
     * Check if connected
     */
    isConnected(): boolean {
        return this.socket?.connected || false;
    }

    /**
     * Get connection status
     */
    getStatus(): 'connected' | 'connecting' | 'disconnected' | 'error' {
        if (!this.socket) return 'disconnected';
        if (this.socket.connected) return 'connected';
        if (this.reconnectAttempts >= this.maxReconnectAttempts) return 'error';
        return 'connecting';
    }

    /**
     * Manually reconnect
     */
    reconnect() {
        if (this.socket && !this.socket.connected) {
            console.log('🔄 Manually reconnecting...');
            this.reconnectAttempts = 0;
            this.socket.connect();
        }
    }
}