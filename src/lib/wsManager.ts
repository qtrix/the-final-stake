// src/lib/wsManager.ts - WebSocket Manager for Battle System

import { RPSMove } from './gameEngines/rockPaperScissors';

interface WebSocketCallbacks {
    onPlayerJoined?: (data: { playerId: string; playersCount: number }) => void;
    onGameReady?: (data: { challengeId: string; players: string[] }) => void;
    onOpponentMoved?: (data: { playerId: string }) => void;
    onRoundComplete?: (data: {
        round: number;
        moves: Array<{ playerAddress: string; move: string }>;
        winner: string | null;
    }) => void;
    onGameEnded?: (data: { winner: string; challengeId: string }) => void;
    onOpponentLeft?: (data: { playerId: string }) => void;
    onError?: (error: string) => void;
}

interface WebSocketMessage {
    type: string;
    [key: string]: any;
}

export class WebSocketManager {
    private ws: WebSocket | null = null;
    private challengeId: string;
    private playerId: string;
    private callbacks: WebSocketCallbacks = {};
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 3;
    private reconnectTimeout: NodeJS.Timeout | null = null;
    private heartbeatInterval: NodeJS.Timeout | null = null;
    private wsUrl: string;

    constructor(challengeId: string, playerId: string) {
        this.challengeId = challengeId;
        this.playerId = playerId;
        this.wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:3001';
    }

    connect(callbacks: WebSocketCallbacks) {
        this.callbacks = callbacks;

        const url = `${this.wsUrl}/battle?challengeId=${this.challengeId}&playerId=${this.playerId}`;

        console.log('[WSManager] Connecting to:', url);

        try {
            this.ws = new WebSocket(url);

            this.ws.onopen = () => {
                console.log('[WSManager] Connected');
                this.reconnectAttempts = 0;
                this.startHeartbeat();

                // Announce player joined
                this.send({
                    type: 'player_joined',
                    challengeId: this.challengeId,
                    playerId: this.playerId
                });
            };

            this.ws.onmessage = (event) => {
                try {
                    const message: WebSocketMessage = JSON.parse(event.data);
                    this.handleMessage(message);
                } catch (error) {
                    console.error('[WSManager] Failed to parse message:', error);
                }
            };

            this.ws.onclose = (event) => {
                console.log('[WSManager] Connection closed:', event.code);
                this.stopHeartbeat();
                this.attemptReconnect();
            };

            this.ws.onerror = (error) => {
                console.error('[WSManager] WebSocket error:', error);
                this.callbacks.onError?.('Connection error');
            };

        } catch (error) {
            console.error('[WSManager] Failed to create WebSocket:', error);
            this.callbacks.onError?.('Failed to connect');
        }
    }

    private handleMessage(message: WebSocketMessage) {
        console.log('[WSManager] Received message:', message.type);

        switch (message.type) {
            case 'player_joined':
                this.callbacks.onPlayerJoined?.({
                    playerId: message.playerId,
                    playersCount: message.playersCount || 1
                });
                break;

            case 'game_ready':
                this.callbacks.onGameReady?.({
                    challengeId: message.challengeId,
                    players: message.players || []
                });
                break;

            case 'opponent_moved':
                this.callbacks.onOpponentMoved?.({
                    playerId: message.playerId
                });
                break;

            case 'round_complete':
                this.callbacks.onRoundComplete?.({
                    round: message.round,
                    moves: message.moves || [],
                    winner: message.winner || null
                });
                break;

            case 'game_ended':
                this.callbacks.onGameEnded?.({
                    winner: message.winner,
                    challengeId: message.challengeId
                });
                break;

            case 'opponent_left':
                this.callbacks.onOpponentLeft?.({
                    playerId: message.playerId
                });
                break;

            case 'error':
                this.callbacks.onError?.(message.message || 'Unknown error');
                break;

            default:
                console.log('[WSManager] Unknown message type:', message.type);
        }
    }

    submitMove(move: RPSMove, round: number) {
        if (!this.isConnected()) {
            throw new Error('Not connected to WebSocket');
        }

        this.send({
            type: 'submit_move',
            challengeId: this.challengeId,
            playerId: this.playerId,
            move,
            round
        });
    }

    endGame(winnerId: string) {
        if (!this.isConnected()) {
            return;
        }

        this.send({
            type: 'game_ended',
            challengeId: this.challengeId,
            winner: winnerId
        });
    }

    private send(message: any) {
        if (this.ws?.readyState === WebSocket.OPEN) {
            try {
                this.ws.send(JSON.stringify(message));
            } catch (error) {
                console.error('[WSManager] Failed to send message:', error);
            }
        } else {
            console.warn('[WSManager] Cannot send message - not connected');
        }
    }

    private startHeartbeat() {
        this.stopHeartbeat();

        this.heartbeatInterval = setInterval(() => {
            if (this.isConnected()) {
                this.send({ type: 'heartbeat' });
            }
        }, 20000); // 20 seconds
    }

    private stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }

    private attemptReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('[WSManager] Max reconnect attempts reached');
            this.callbacks.onError?.('Connection lost');
            return;
        }

        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
        }

        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);
        console.log(`[WSManager] Reconnecting in ${delay}ms...`);

        this.reconnectTimeout = setTimeout(() => {
            this.reconnectAttempts++;
            this.connect(this.callbacks);
        }, delay);
    }

    isConnected(): boolean {
        return this.ws?.readyState === WebSocket.OPEN;
    }

    disconnect() {
        this.stopHeartbeat();

        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }

        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }

        console.log('[WSManager] Disconnected');
    }
}