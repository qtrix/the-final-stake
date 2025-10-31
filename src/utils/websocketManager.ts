// src/utils/websocketManager.ts - WITH GAME ENDED HANDLING
import { PlayerState } from '@/types';

interface WebSocketHandlers {
    onConnected?: () => void;
    onDisconnected?: () => void;
    onSync?: (players: PlayerState[], readyPlayers?: string[]) => void;
    onUpdate?: (playerId: string, state: PlayerState) => void;
    onEliminated?: (playerId: string) => void;
    onWinner?: (winnerId: string, prizeAmount?: number) => void; // ✅ ADDED prizeAmount
    onPlayerConnected?: (playerId: string) => void;
    onPlayerDisconnected?: (playerId: string) => void;
    onGamePhaseChange?: (phase: 'waiting' | 'countdown' | 'active' | 'ended') => void;
    onCountdownSync?: (startTime: number, duration: number) => void;
    onReadyPlayersUpdate?: (readyPlayers: string[]) => void;
    onGameStateSync?: (gameTime: number, safeZoneRadius: number, alivePlayers: number) => void;
    onGameEnded?: () => void; // ✅ NEW: When game is permanently ended
}

interface QueuedMessage {
    type: string;
    data?: any;
    [key: string]: any;
}

class WebSocketManager {
    private ws: WebSocket | null = null;
    private handlers = new Map<string, WebSocketHandlers>();
    private gameId: string | null = null;
    private playerId: string | null = null;
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 3;
    private reconnectDelay = 3000;
    private reconnectTimeout: NodeJS.Timeout | null = null;
    private messageQueue: QueuedMessage[] = [];
    private isConnecting = false;
    private lastPingTime = 0;
    private pingInterval: NodeJS.Timeout | null = null;
    private gameEnded = false; // ✅ NEW: Track if game has ended

    private getWebSocketUrl(): string {
        const isDev = window.location.hostname === 'localhost';
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';

        if (isDev) {
            return 'ws://localhost:3001';
        }

        return 'wss://purge-server-production.up.railway.app';
    }

    connect(
        gameId: string,
        playerId: string,
        handlerId: string,
        handlers: WebSocketHandlers
    ): void {
        this.gameId = gameId;
        this.playerId = playerId;
        this.handlers.set(handlerId, handlers);

        // ✅ Don't reconnect if game has ended
        if (this.gameEnded) {
            console.log('[WS] Game has ended - not connecting');
            handlers.onGameEnded?.();
            return;
        }

        if (this.isConnecting) {
            console.log('[WS] Connection already in progress');
            return;
        }

        if (this.ws?.readyState === WebSocket.OPEN) {
            console.log('[WS] Already connected');
            handlers.onConnected?.();
            return;
        }

        this.attemptConnection();
    }

    private attemptConnection(): void {
        if (!this.gameId || !this.playerId) {
            console.error('[WS] Missing gameId or playerId');
            return;
        }

        // ✅ Don't reconnect if game has ended
        if (this.gameEnded) {
            console.log('[WS] Game has ended - aborting connection');
            return;
        }

        this.isConnecting = true;
        this.reconnectAttempts++;

        const wsUrl = this.getWebSocketUrl();
        const urlWithParams = `${wsUrl}?gameId=${this.gameId}&playerId=${this.playerId}`;

        console.log(`[WS] Connecting (${this.reconnectAttempts}/${this.maxReconnectAttempts}):`, urlWithParams);

        try {
            this.ws = new WebSocket(urlWithParams);

            this.ws.onopen = () => {
                console.log('[WS] Connected');
                this.isConnecting = false;
                this.reconnectAttempts = 0;

                this.send({
                    type: 'connect',
                    gameId: this.gameId,
                    playerId: this.playerId
                });

                this.flushMessageQueue();
                this.startPingInterval();

                this.handlers.forEach(h => h.onConnected?.());
            };

            this.ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    this.handleMessage(message);
                } catch (error) {
                    console.error('[WS] Error parsing message:', error);
                }
            };

            this.ws.onerror = (error) => {
                console.error('[WS] Error:', error);
                this.isConnecting = false;
            };

            this.ws.onclose = (event) => {
                console.log(`[WS] Closed (code: ${event.code})`);
                this.isConnecting = false;
                this.stopPingInterval();

                this.handlers.forEach(h => h.onDisconnected?.());

                // ✅ Don't reconnect if game has ended
                if (this.gameEnded) {
                    console.log('[WS] Game has ended - not reconnecting');
                    return;
                }

                if (this.reconnectAttempts < this.maxReconnectAttempts) {
                    console.log(`[WS] Reconnecting in ${this.reconnectDelay / 1000}s...`);
                    this.reconnectTimeout = setTimeout(() => {
                        this.attemptConnection();
                    }, this.reconnectDelay);
                } else {
                    console.error('[WS] Max reconnection attempts reached');
                }
            };

        } catch (error) {
            console.error('[WS] Connection error:', error);
            this.isConnecting = false;
        }
    }

    private handleMessage(message: any): void {
        const { type } = message;

        switch (type) {
            case 'connected':
                console.log('[WS] Server confirmed connection');
                break;

            case 'sync':
                this.handlers.forEach(h =>
                    h.onSync?.(message.players, message.readyPlayers)
                );
                break;

            case 'update':
                // ✅ Ignore updates if game has ended
                if (this.gameEnded) return;

                this.handlers.forEach(h =>
                    h.onUpdate?.(message.playerId, message.state)
                );
                break;

            case 'eliminated':
                this.handlers.forEach(h =>
                    h.onEliminated?.(message.playerId)
                );
                break;

            case 'winner':
                console.log('[WS] 🏆 Winner declared:', message.winnerId, 'Prize:', message.prizeAmount);
                this.handlers.forEach(h =>
                    h.onWinner?.(message.winnerId, message.prizeAmount)
                );
                break;

            case 'player_connected':
                this.handlers.forEach(h =>
                    h.onPlayerConnected?.(message.playerId)
                );
                break;

            case 'player_disconnected':
                this.handlers.forEach(h =>
                    h.onPlayerDisconnected?.(message.playerId)
                );
                break;

            case 'game_phase_change':
                this.handlers.forEach(h =>
                    h.onGamePhaseChange?.(message.phase)
                );

                // ✅ Mark game as ended
                if (message.phase === 'ended') {
                    console.log('[WS] 🛑 Game marked as ended');
                    this.gameEnded = true;
                }
                break;

            case 'countdown_sync':
                this.handlers.forEach(h =>
                    h.onCountdownSync?.(message.startTime, message.duration)
                );
                break;

            case 'ready_players_update':
                this.handlers.forEach(h =>
                    h.onReadyPlayersUpdate?.(message.readyPlayers)
                );
                break;

            case 'game_state_sync':
                this.handlers.forEach(h =>
                    h.onGameStateSync?.(message.gameTime, message.safeZoneRadius, message.alivePlayers)
                );
                break;

            // ✅ NEW: Handle explicit game ended message
            case 'game_ended':
                console.log('[WS] 🛑 Game ended by server');
                console.log('[WS] 🏆 Winner from game_ended:', message.winnerId?.slice(0, 8), 'Prize:', message.prizeAmount);

                this.gameEnded = true;

                // ✅ ADAUGĂ: Apelează onWinner ÎNAINTE de onGameEnded
                if (message.winnerId) {
                    this.handlers.forEach(h =>
                        h.onWinner?.(message.winnerId, message.prizeAmount || 0)
                    );
                }

                // Apoi apelează onGameEnded
                this.handlers.forEach(h => h.onGameEnded?.());

                this.stopPingInterval();
                break;

            case 'game_start_sync':
                console.log('[WS] Game start sync received:', message.startTime);
                break;

            // ✅ NEW: Handle error when trying to join ended game
            case 'error':
                console.error('[WS] Server error:', message.message);

                if (message.message?.includes('ended') || message.message?.includes('finished')) {
                    this.gameEnded = true;
                    this.handlers.forEach(h => h.onGameEnded?.());
                }
                break;

            default:
                console.warn('[WS] Unknown message type:', type);
        }
    }

    send(message: QueuedMessage): void {
        // ✅ Block sending if game has ended
        if (this.gameEnded && message.type !== 'disconnect') {
            console.log('[WS] Game ended - not sending:', message.type);
            return;
        }

        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        } else {
            this.messageQueue.push(message);
        }
    }

    private flushMessageQueue(): void {
        if (this.messageQueue.length === 0) return;

        console.log(`[WS] Flushing ${this.messageQueue.length} queued messages`);

        this.messageQueue.forEach(msg => {
            if (this.ws?.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify(msg));
            }
        });

        this.messageQueue = [];
    }

    private startPingInterval(): void {
        this.stopPingInterval();

        this.pingInterval = setInterval(() => {
            // ✅ Stop pinging if game has ended
            if (this.gameEnded) {
                this.stopPingInterval();
                return;
            }

            if (this.ws?.readyState === WebSocket.OPEN) {
                const now = Date.now();

                if (now - this.lastPingTime > 10000) {
                    this.send({ type: 'ping' });
                    this.lastPingTime = now;
                }
            }
        }, 10000);
    }

    private stopPingInterval(): void {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
    }

    isConnected(): boolean {
        return this.ws?.readyState === WebSocket.OPEN && !this.gameEnded;
    }

    disconnect(): void {
        this.stopPingInterval();

        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }

        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }

        this.handlers.clear();
        this.messageQueue = [];
        this.gameEnded = false; // ✅ Reset on disconnect
    }

    unregisterHandler(handlerId: string): void {
        this.handlers.delete(handlerId);

        if (this.handlers.size === 0) {
            this.disconnect();
        }
    }

    // ✅ NEW: Method to check if game has ended
    isGameEnded(): boolean {
        return this.gameEnded;
    }
}

export const wsManager = new WebSocketManager();