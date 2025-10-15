// src/utils/websocketManager.ts - Singleton WebSocket Manager with Game State Orchestration

import { PlayerState } from '@/types';

type MessageHandler = {
    onSync?: (players: PlayerState[]) => void;
    onUpdate?: (playerId: string, state: PlayerState) => void;
    onEliminated?: (playerId: string) => void;
    onWinner?: (winnerId: string) => void;
    onPlayerConnected?: (playerId: string) => void;
    onPlayerDisconnected?: (playerId: string) => void;
    onConnected?: () => void;
    onDisconnected?: () => void;
    onCountdownSync?: (startTime: number, duration: number) => void;
    onGamePhaseChange?: (phase: 'waiting' | 'countdown' | 'active' | 'ended') => void;
};

interface GameStateMessage {
    type: 'game_state_update';
    gameState: {
        phase: 'waiting' | 'countdown' | 'active' | 'ended';
        countdownStartTime?: number;
        countdownDuration?: number;
        readyPlayers: number;
        totalPlayers: number;
    };
}

class WebSocketManager {
    private ws: WebSocket | null = null;
    private handlers: Map<string, MessageHandler> = new Map();
    private isConnecting = false;
    private reconnectTimeout: NodeJS.Timeout | null = null;
    private heartbeatInterval: NodeJS.Timeout | null = null;
    private gameId: number | null = null;
    private playerId: string | null = null;
    private wsUrl: string;
    private connectionAttempts = 0;
    private maxAttempts = 3;
    private gameStateCallbacks: Set<(state: GameStateMessage['gameState']) => void> = new Set();

    constructor() {
        this.wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:3001';
    }

    connect(gameId: number, playerId: string, handlersId: string, handlers: MessageHandler) {
        this.gameId = gameId;
        this.playerId = playerId;
        this.handlers.set(handlersId, handlers);

        if (this.ws?.readyState === WebSocket.OPEN && this.gameId === gameId && this.playerId === playerId) {
            console.log('[WS] Already connected, registering handlers');
            handlers.onConnected?.();
            return;
        }

        if (this.ws && (this.gameId !== gameId || this.playerId !== playerId)) {
            console.log('[WS] Switching games, closing old connection');
            this.disconnect();
        }

        if (this.isConnecting) {
            console.log('[WS] Connection already in progress');
            return;
        }

        if (this.connectionAttempts >= this.maxAttempts) {
            console.warn('[WS] Max connection attempts reached');
            return;
        }

        this.isConnecting = true;
        this.connectionAttempts++;

        const url = `${this.wsUrl}?gameId=${gameId}&playerId=${playerId}`;
        console.log(`[WS] Connecting (${this.connectionAttempts}/${this.maxAttempts}): ${url}`);

        try {
            this.ws = new WebSocket(url);

            this.ws.onopen = () => {
                console.log('[WS] Connected');
                this.isConnecting = false;
                this.connectionAttempts = 0;

                this.handlers.forEach(h => h.onConnected?.());

                this.heartbeatInterval = setInterval(() => {
                    if (this.ws?.readyState === WebSocket.OPEN) {
                        this.ws.send(JSON.stringify({ type: 'heartbeat' }));
                    }
                }, 20000);
            };

            this.ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);

                    // Handle game state updates
                    if (message.type === 'game_state_update') {
                        this.gameStateCallbacks.forEach(cb => cb(message.gameState));
                        this.handlers.forEach(handler => {
                            handler.onGamePhaseChange?.(message.gameState.phase);
                            if (message.gameState.phase === 'countdown' && message.gameState.countdownStartTime) {
                                handler.onCountdownSync?.(
                                    message.gameState.countdownStartTime,
                                    message.gameState.countdownDuration || 15000
                                );
                            }
                        });
                        return;
                    }

                    // Handle other messages
                    this.handlers.forEach(handler => {
                        switch (message.type) {
                            case 'sync':
                                handler.onSync?.(message.players || []);
                                break;
                            case 'update':
                                if (message.playerId !== this.playerId) {
                                    handler.onUpdate?.(message.playerId, message.data);
                                }
                                break;
                            case 'eliminated':
                                handler.onEliminated?.(message.playerId);
                                break;
                            case 'winner':
                                handler.onWinner?.(message.winnerId);
                                break;
                            case 'player_connected':
                                handler.onPlayerConnected?.(message.playerId);
                                break;
                            case 'player_disconnected':
                                handler.onPlayerDisconnected?.(message.playerId);
                                break;
                        }
                    });
                } catch (error) {
                    console.error('[WS] Message parse error:', error);
                }
            };

            this.ws.onclose = (event) => {
                console.log(`[WS] Closed (code: ${event.code})`);
                this.isConnecting = false;

                if (this.heartbeatInterval) {
                    clearInterval(this.heartbeatInterval);
                    this.heartbeatInterval = null;
                }

                this.handlers.forEach(h => h.onDisconnected?.());

                if (this.connectionAttempts < this.maxAttempts && this.gameId && this.playerId) {
                    console.log('[WS] Reconnecting in 3s...');
                    this.reconnectTimeout = setTimeout(() => {
                        if (this.gameId && this.playerId) {
                            const firstHandler = this.handlers.values().next().value;
                            if (firstHandler) {
                                this.connect(this.gameId, this.playerId, 'reconnect', firstHandler);
                            }
                        }
                    }, 3000);
                }
            };

            this.ws.onerror = (error) => {
                console.error('[WS] Error:', error);
                this.isConnecting = false;
            };
        } catch (error) {
            console.error('[WS] Failed to create:', error);
            this.isConnecting = false;
        }
    }

    disconnect() {
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }

        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }

        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }

        this.handlers.clear();
        this.gameStateCallbacks.clear();
        this.isConnecting = false;
        this.gameId = null;
        this.playerId = null;
    }

    unregisterHandler(handlersId: string) {
        this.handlers.delete(handlersId);

        if (this.handlers.size === 0) {
            console.log('[WS] No more handlers, disconnecting');
            this.disconnect();
        }
    }

    send(message: any) {
        if (this.ws?.readyState === WebSocket.OPEN) {
            try {
                this.ws.send(JSON.stringify(message));
            } catch (error) {
                console.error('[WS] Failed to send:', error);
            }
        }
    }

    isConnected(): boolean {
        return this.ws?.readyState === WebSocket.OPEN;
    }

    onGameStateChange(callback: (state: GameStateMessage['gameState']) => void): () => void {
        this.gameStateCallbacks.add(callback);
        return () => this.gameStateCallbacks.delete(callback);
    }
}

export const wsManager = new WebSocketManager();