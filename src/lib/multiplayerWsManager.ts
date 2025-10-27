// src/lib/multiplayerWsManager.ts - FIXED pentru Phase 3 (Purge Game)

import { PlayerState } from '@/types/multiplayer';

const PHASE3_WS_URL = import.meta.env.VITE_WS_URL || 'wss://purge-server-production.up.railway.app';

interface MultiplayerCallbacks {
    onConnected?: () => void;
    onDisconnected?: () => void;
    onSync?: (players: PlayerState[]) => void;
    onUpdate?: (id: string, state: PlayerState) => void;
    onPlayerConnected?: (id: string) => void;
    onPlayerDisconnected?: (id: string) => void;
    onEliminated?: (id: string) => void;
    onGamePhaseChange?: (phase: 'waiting' | 'countdown' | 'active' | 'ended') => void;
    onCountdownSync?: (startTime: number, duration: number) => void;
    onWinner?: (winnerId: string) => void;
    onError?: (error: string) => void;
}

class MultiplayerWSManager {
    private ws: WebSocket | null = null;
    private gameId: string;
    private playerId: string;
    private callbacks: MultiplayerCallbacks = {};
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 3;
    private reconnectTimeout: NodeJS.Timeout | null = null;
    private heartbeatInterval: NodeJS.Timeout | null = null;
    private isIntentionalClose = false;

    // Batching pentru 100 players
    private updateQueue: Partial<PlayerState>[] = [];
    private batchInterval: NodeJS.Timeout | null = null;
    private readonly BATCH_INTERVAL = 50; // 20 updates/sec

    constructor(gameId: string, playerId: string) {
        this.gameId = gameId;
        this.playerId = playerId;
        console.log('[MP-WS] Phase 3 URL:', PHASE3_WS_URL);
    }

    connect(callbacks: MultiplayerCallbacks) {
        this.callbacks = callbacks;
        this.isIntentionalClose = false;

        // ✅ Folosește /game endpoint pentru Purge
        const url = `${PHASE3_WS_URL}/game?gameId=${this.gameId}&playerId=${this.playerId}`;
        console.log('[MP-WS] Connecting to Phase 3:', url);

        try {
            this.ws = new WebSocket(url);

            this.ws.onopen = () => {
                console.log('[MP-WS] ✅ Connected to Phase 3 server');
                this.reconnectAttempts = 0;
                this.startHeartbeat();
                this.startBatching();
                this.callbacks.onConnected?.();

                // Request immediate sync
                this.send({ type: 'request_sync' });
            };

            this.ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    this.handleMessage(message);
                } catch (error) {
                    console.error('[MP-WS] Parse error:', error);
                }
            };

            this.ws.onclose = (event) => {
                console.log('[MP-WS] ❌ Disconnected, code:', event.code);
                this.stopHeartbeat();
                this.stopBatching();
                this.callbacks.onDisconnected?.();

                if (!this.isIntentionalClose) {
                    this.attemptReconnect();
                }
            };

            this.ws.onerror = (error) => {
                console.error('[MP-WS] Error:', error);
                this.callbacks.onError?.('Connection error');
            };

        } catch (error) {
            console.error('[MP-WS] Failed to connect:', error);
            this.callbacks.onError?.('Failed to connect');
        }
    }

    private handleMessage(message: any) {
        switch (message.type) {
            case 'sync':
                console.log('[MP-WS] 📦 Sync:', message.players?.length || 0, 'players');
                this.callbacks.onSync?.(message.players || []);
                break;

            case 'player:update':
                this.callbacks.onUpdate?.(message.id, message.state);
                break;

            case 'player:connected':
                console.log('[MP-WS] 👋 Player joined:', message.playerId?.slice(0, 8));
                this.callbacks.onPlayerConnected?.(message.playerId);
                break;

            case 'player:disconnected':
                console.log('[MP-WS] 👋 Player left:', message.playerId?.slice(0, 8));
                this.callbacks.onPlayerDisconnected?.(message.playerId);
                break;

            case 'player:eliminated':
                console.log('[MP-WS] 💀 Player eliminated:', message.playerId?.slice(0, 8));
                this.callbacks.onEliminated?.(message.playerId);
                break;

            case 'game:phase':
                console.log('[MP-WS] 🎮 Phase change:', message.phase);
                this.callbacks.onGamePhaseChange?.(message.phase);
                break;

            case 'game:countdown':
                console.log('[MP-WS] ⏱️ Countdown started');
                this.callbacks.onCountdownSync?.(message.startTime, message.duration);
                break;

            case 'game:winner':
                console.log('[MP-WS] 🏆 Winner:', message.winnerId?.slice(0, 8));
                this.callbacks.onWinner?.(message.winnerId);
                break;

            case 'error':
                console.error('[MP-WS] Server error:', message.message);
                this.callbacks.onError?.(message.message);
                break;

            case 'pong':
                // Heartbeat response
                break;

            default:
                console.log('[MP-WS] ❓ Unknown message:', message.type);
        }
    }

    // ✅ Queue updates for batching
    sendUpdate(state: Partial<PlayerState>) {
        this.updateQueue.push(state);
    }

    // ✅ Batch processing
    private startBatching() {
        this.stopBatching();
        this.batchInterval = setInterval(() => {
            if (this.updateQueue.length > 0 && this.isConnected()) {
                // Send only the latest state
                const latestState = this.updateQueue[this.updateQueue.length - 1];
                this.send({
                    type: 'player:update',
                    state: latestState
                });
                this.updateQueue = [];
            }
        }, this.BATCH_INTERVAL);
    }

    private stopBatching() {
        if (this.batchInterval) {
            clearInterval(this.batchInterval);
            this.batchInterval = null;
        }
        this.updateQueue = [];
    }

    sendEliminated() {
        this.send({ type: 'player:eliminated' });
    }

    sendWinner(winnerId: string) {
        this.send({ type: 'game:winner', winnerId });
    }

    private send(message: any) {
        if (this.ws?.readyState === WebSocket.OPEN) {
            try {
                this.ws.send(JSON.stringify(message));
            } catch (error) {
                console.error('[MP-WS] Send error:', error);
            }
        } else {
            console.warn('[MP-WS] ⚠️ Cannot send - not connected');
        }
    }

    private startHeartbeat() {
        this.stopHeartbeat();
        this.heartbeatInterval = setInterval(() => {
            if (this.isConnected()) {
                this.send({ type: 'ping' });
            }
        }, 20000); // 20s
    }

    private stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }

    private attemptReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('[MP-WS] Max reconnect attempts reached');
            this.callbacks.onError?.('Connection lost - please refresh');
            return;
        }

        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
        }

        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 5000);
        console.log(`[MP-WS] Reconnecting in ${delay}ms... (${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`);

        this.reconnectTimeout = setTimeout(() => {
            this.reconnectAttempts++;
            this.connect(this.callbacks);
        }, delay);
    }

    isConnected(): boolean {
        return this.ws?.readyState === WebSocket.OPEN;
    }

    disconnect() {
        console.log('[MP-WS] 🔌 Disconnecting...');
        this.isIntentionalClose = true;
        this.stopHeartbeat();
        this.stopBatching();

        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }

        if (this.ws) {
            this.ws.close(1000, 'Client disconnect');
            this.ws = null;
        }
    }
}

// ✅ Singleton Pattern cu Multi-Handler Support
class MultiplayerWSManagerSingleton {
    private instance: MultiplayerWSManager | null = null;
    private handlers: Map<string, MultiplayerCallbacks> = new Map();
    private currentGameId: string | null = null;
    private currentPlayerId: string | null = null;

    connect(gameId: string, playerId: string, handlerId: string, callbacks: MultiplayerCallbacks) {
        console.log('[MP-Singleton] Connect request:', {
            gameId,
            playerId: playerId.slice(0, 8),
            handlerId,
            existing: this.instance ? 'yes' : 'no'
        });

        // Reuse if same game & player
        if (this.instance && this.currentGameId === gameId && this.currentPlayerId === playerId) {
            this.handlers.set(handlerId, callbacks);
            console.log('[MP-Singleton] ♻️ Reusing connection, handlers:', this.handlers.size);

            // Call onConnected immediately if already connected
            if (this.instance.isConnected()) {
                callbacks.onConnected?.();
            }
            return;
        }

        // Disconnect old if switching games
        if (this.instance) {
            console.log('[MP-Singleton] 🔄 Switching games, disconnecting old');
            this.instance.disconnect();
        }

        this.currentGameId = gameId;
        this.currentPlayerId = playerId;
        this.handlers.clear();
        this.handlers.set(handlerId, callbacks);

        this.instance = new MultiplayerWSManager(gameId, playerId);
        const mergedCallbacks = this.getMergedCallbacks();
        this.instance.connect(mergedCallbacks);
    }

    private getMergedCallbacks(): MultiplayerCallbacks {
        return {
            onConnected: () => {
                console.log('[MP-Singleton] ✅ Broadcasting onConnected to', this.handlers.size, 'handlers');
                this.handlers.forEach(h => h.onConnected?.());
            },
            onDisconnected: () => {
                console.log('[MP-Singleton] ❌ Broadcasting onDisconnected');
                this.handlers.forEach(h => h.onDisconnected?.());
            },
            onSync: (players) => {
                console.log('[MP-Singleton] 📦 Broadcasting sync:', players.length, 'players');
                this.handlers.forEach(h => h.onSync?.(players));
            },
            onUpdate: (id, state) => {
                this.handlers.forEach(h => h.onUpdate?.(id, state));
            },
            onPlayerConnected: (id) => {
                this.handlers.forEach(h => h.onPlayerConnected?.(id));
            },
            onPlayerDisconnected: (id) => {
                this.handlers.forEach(h => h.onPlayerDisconnected?.(id));
            },
            onEliminated: (id) => {
                this.handlers.forEach(h => h.onEliminated?.(id));
            },
            onGamePhaseChange: (phase) => {
                this.handlers.forEach(h => h.onGamePhaseChange?.(phase));
            },
            onCountdownSync: (start, dur) => {
                this.handlers.forEach(h => h.onCountdownSync?.(start, dur));
            },
            onWinner: (id) => {
                this.handlers.forEach(h => h.onWinner?.(id));
            },
            onError: (err) => {
                this.handlers.forEach(h => h.onError?.(err));
            }
        };
    }

    send(message: any) {
        if (!this.instance) {
            console.warn('[MP-Singleton] ⚠️ No active instance');
            return;
        }

        if (message.type === 'player:update') {
            this.instance.sendUpdate(message.state);
        } else {
            // Direct send for critical messages
            this.instance['send'](message);
        }
    }

    isConnected(): boolean {
        return this.instance?.isConnected() || false;
    }

    unregisterHandler(handlerId: string) {
        console.log('[MP-Singleton] Unregister:', handlerId);
        this.handlers.delete(handlerId);

        if (this.handlers.size === 0) {
            console.log('[MP-Singleton] 🧹 No more handlers, disconnecting');
            this.instance?.disconnect();
            this.instance = null;
            this.currentGameId = null;
            this.currentPlayerId = null;
        }
    }

    disconnect() {
        console.log('[MP-Singleton] 🔌 Manual disconnect');
        this.instance?.disconnect();
        this.instance = null;
        this.handlers.clear();
        this.currentGameId = null;
        this.currentPlayerId = null;
    }

    getStats() {
        return {
            connected: this.isConnected(),
            gameId: this.currentGameId,
            playerId: this.currentPlayerId?.slice(0, 8),
            handlers: this.handlers.size
        };
    }
}

export const multiplayerWsManager = new MultiplayerWSManagerSingleton();