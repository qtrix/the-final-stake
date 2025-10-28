// src/lib/purgeWsManager.ts - OPTIMIZED WebSocket Manager pentru Purge (100 players)

import { PlayerState } from '@/types/multiplayer';

export type GamePhase = 'waiting' | 'countdown' | 'active' | 'ended';

interface PurgeCallbacks {
    onConnected?: () => void;
    onDisconnected?: () => void;
    onReconnecting?: (attempt: number) => void;
    onSync?: (players: PlayerState[]) => void;
    onPlayerUpdate?: (id: string, state: Partial<PlayerState>) => void;
    onPlayerJoined?: (id: string, state: PlayerState) => void;
    onPlayerLeft?: (id: string) => void;
    onPlayerEliminated?: (id: string) => void;
    onPlayerReady?: (id: string) => void;
    onGamePhaseChange?: (phase: GamePhase) => void;
    onCountdownStart?: (startTime: number, duration: number) => void;
    onGameStart?: () => void;
    onGameEnd?: (winnerId: string) => void;
    onError?: (error: string) => void;
}

interface QueuedUpdate {
    state: Partial<PlayerState>;
    timestamp: number;
}

interface GameStateUpdate {
    phase: GamePhase;
    countdownStartTime?: number;
    countdownDuration?: number;
    readyPlayers: number;
    totalPlayers: number;
    activePlayers?: number;
}

class PurgeWSManager {
    private ws: WebSocket | null = null;
    private gameId: string;
    private playerId: string;
    private callbacks: PurgeCallbacks = {};
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 5;
    private reconnectTimeout: NodeJS.Timeout | null = null;
    private heartbeatInterval: NodeJS.Timeout | null = null;
    private wsUrl: string;
    private isIntentionalClose = false;
    private lastSentUpdate: number = 0;
    private connectionQuality: 'good' | 'fair' | 'poor' = 'good';

    // 🚀 OPTIMIZED BATCHING SYSTEM
    private updateQueue: QueuedUpdate[] = [];
    private batchInterval: NodeJS.Timeout | null = null;
    private readonly MIN_UPDATE_INTERVAL = 50; // 20 updates/sec max
    private readonly MAX_QUEUE_SIZE = 5; // Keep only last 5 updates

    // 🎯 CLIENT-SIDE PREDICTION
    private lastAcknowledgedState: Partial<PlayerState> | null = null;
    private pendingUpdates: Map<number, QueuedUpdate> = new Map();
    private updateSequence = 0;

    // 📊 PERFORMANCE MONITORING
    private messageCount = 0;
    private lastMessageTime = Date.now();
    private latency = 0;
    private pingInterval: NodeJS.Timeout | null = null;
    private lastPingTime = 0;

    constructor(gameId: string, playerId: string) {
        this.gameId = gameId;
        this.playerId = playerId;
        this.wsUrl = import.meta.env.VITE_WS_URL || 'wss://purge-server-production.up.railway.app';

        console.log('[Purge-WS] 🎮 Initializing for game:', gameId.slice(0, 8));
    }

    connect(callbacks: PurgeCallbacks): void {
        this.callbacks = callbacks;
        this.isIntentionalClose = false;

        const url = `${this.wsUrl}/game?gameId=${this.gameId}&playerId=${this.playerId}`;
        console.log('[Purge-WS] 🔌 Connecting to:', url);

        try {
            this.ws = new WebSocket(url);
            this.setupEventHandlers();
        } catch (error) {
            console.error('[Purge-WS] ❌ Connection failed:', error);
            this.callbacks.onError?.('Failed to connect to server');
            this.attemptReconnect();
        }
    }

    private setupEventHandlers(): void {
        if (!this.ws) return;

        this.ws.onopen = () => {
            console.log('[Purge-WS] ✅ Connected successfully');
            this.reconnectAttempts = 0;
            this.connectionQuality = 'good';

            this.startHeartbeat();
            this.startBatching();
            this.startPingMonitoring();

            this.callbacks.onConnected?.();

            // Request full sync immediately
            this.send({ type: 'sync_request' });
        };

        this.ws.onmessage = (event) => {
            this.messageCount++;
            this.updateConnectionQuality();

            try {
                const message = JSON.parse(event.data);
                this.handleMessage(message);
            } catch (error) {
                console.error('[Purge-WS] ⚠️ Failed to parse message:', error);
            }
        };

        this.ws.onclose = (event) => {
            console.log('[Purge-WS] 🔌 Connection closed:', event.code, event.reason);
            this.cleanup();
            this.callbacks.onDisconnected?.();

            if (!this.isIntentionalClose && event.code !== 1000) {
                this.attemptReconnect();
            }
        };

        this.ws.onerror = (error) => {
            console.error('[Purge-WS] ❌ WebSocket error:', error);
            this.connectionQuality = 'poor';
        };
    }

    private handleMessage(message: any): void {
        switch (message.type) {
            // 📦 FULL SYNC - All players state
            case 'sync':
            case 'full_sync':
                console.log('[Purge-WS] 📦 Full sync:', message.players?.length || 0, 'players');
                this.callbacks.onSync?.(message.players || []);
                break;

            // 🔄 INCREMENTAL UPDATE - Single player
            case 'player:update':
            case 'player_update':
                if (message.playerId !== this.playerId) {
                    this.callbacks.onPlayerUpdate?.(message.playerId || message.id, message.state || message.data);
                }
                break;

            // 👤 PLAYER EVENTS
            case 'player:joined':
            case 'player_joined':
                console.log('[Purge-WS] 👋 Player joined:', message.playerId?.slice(0, 8));
                this.callbacks.onPlayerJoined?.(message.playerId, message.state);
                break;

            case 'player:left':
            case 'player_left':
            case 'player:disconnected':
            case 'player_disconnected':
                console.log('[Purge-WS] 👋 Player left:', message.playerId?.slice(0, 8));
                this.callbacks.onPlayerLeft?.(message.playerId);
                break;

            case 'player:eliminated':
            case 'player_eliminated':
                console.log('[Purge-WS] 💀 Player eliminated:', message.playerId?.slice(0, 8));
                this.callbacks.onPlayerEliminated?.(message.playerId);
                break;

            case 'player:ready':
            case 'player_ready':
                console.log('[Purge-WS] ✅ Player ready:', message.playerId?.slice(0, 8));
                this.callbacks.onPlayerReady?.(message.playerId);
                break;

            // 🎮 GAME STATE EVENTS
            case 'game_state_update':
            case 'game:state':
                this.handleGameStateUpdate(message.gameState || message.state);
                break;

            case 'game:phase':
            case 'phase_change':
                console.log('[Purge-WS] 🎮 Phase change:', message.phase);
                this.callbacks.onGamePhaseChange?.(message.phase);
                break;

            case 'game:countdown':
            case 'countdown_start':
                console.log('[Purge-WS] ⏱️ Countdown started');
                this.callbacks.onCountdownStart?.(
                    message.startTime || message.countdownStartTime,
                    message.duration || message.countdownDuration || 15000
                );
                break;

            case 'game:start':
            case 'game_start':
                console.log('[Purge-WS] 🚀 Game started!');
                this.callbacks.onGameStart?.();
                break;

            case 'game:end':
            case 'game:winner':
            case 'game_end':
                console.log('[Purge-WS] 🏆 Game ended, winner:', message.winnerId?.slice(0, 8));
                this.callbacks.onGameEnd?.(message.winnerId || message.winner);
                break;

            // 🏓 HEARTBEAT & MONITORING
            case 'pong':
                if (this.lastPingTime > 0) {
                    this.latency = Date.now() - this.lastPingTime;
                    this.updateConnectionQuality();
                }
                break;

            // ✅ ACKNOWLEDGEMENTS
            case 'update_ack':
                if (message.sequence !== undefined) {
                    this.pendingUpdates.delete(message.sequence);
                }
                break;

            // ⚠️ ERRORS
            case 'error':
                console.error('[Purge-WS] Server error:', message.message || message.error);
                this.callbacks.onError?.(message.message || message.error || 'Unknown error');
                break;

            default:
                // console.log('[Purge-WS] ❓ Unknown message type:', message.type);
                break;
        }
    }

    private handleGameStateUpdate(state: GameStateUpdate): void {
        console.log('[Purge-WS] 📊 Game state:', {
            phase: state.phase,
            ready: state.readyPlayers,
            total: state.totalPlayers,
            active: state.activePlayers
        });

        this.callbacks.onGamePhaseChange?.(state.phase);

        if (state.phase === 'countdown' && state.countdownStartTime) {
            this.callbacks.onCountdownStart?.(
                state.countdownStartTime,
                state.countdownDuration || 15000
            );
        }
    }

    // 🚀 OPTIMIZED UPDATE QUEUING
    public queueUpdate(state: Partial<PlayerState>): void {
        const now = Date.now();

        // Add to queue with timestamp
        this.updateQueue.push({
            state,
            timestamp: now
        });

        // Keep only last few updates to prevent memory bloat
        if (this.updateQueue.length > this.MAX_QUEUE_SIZE) {
            this.updateQueue.shift();
        }
    }

    // 📤 BATCH PROCESSING WITH THROTTLING
    private startBatching(): void {
        this.stopBatching();

        this.batchInterval = setInterval(() => {
            const now = Date.now();

            // Throttle based on connection quality
            const minInterval = this.connectionQuality === 'good' ? this.MIN_UPDATE_INTERVAL :
                this.connectionQuality === 'fair' ? 100 : 200;

            if (now - this.lastSentUpdate < minInterval) {
                return;
            }

            if (this.updateQueue.length > 0 && this.isConnected()) {
                // Send only the most recent state
                const latestUpdate = this.updateQueue[this.updateQueue.length - 1];
                const sequence = this.updateSequence++;

                this.send({
                    type: 'player:update',
                    sequence,
                    state: latestUpdate.state,
                    timestamp: latestUpdate.timestamp
                });

                // Store for potential resend
                this.pendingUpdates.set(sequence, latestUpdate);

                // Clean old pending updates
                if (this.pendingUpdates.size > 10) {
                    const oldestKey = Math.min(...this.pendingUpdates.keys());
                    this.pendingUpdates.delete(oldestKey);
                }

                this.lastSentUpdate = now;
                this.updateQueue = [];
            }
        }, this.MIN_UPDATE_INTERVAL);
    }

    private stopBatching(): void {
        if (this.batchInterval) {
            clearInterval(this.batchInterval);
            this.batchInterval = null;
        }
        this.updateQueue = [];
    }

    // 📊 CONNECTION QUALITY MONITORING
    private updateConnectionQuality(): void {
        const now = Date.now();
        const timeSinceLastMessage = now - this.lastMessageTime;
        this.lastMessageTime = now;

        if (this.latency < 100 && timeSinceLastMessage < 1000) {
            this.connectionQuality = 'good';
        } else if (this.latency < 300 && timeSinceLastMessage < 3000) {
            this.connectionQuality = 'fair';
        } else {
            this.connectionQuality = 'poor';
        }
    }

    // 🏓 PING MONITORING
    private startPingMonitoring(): void {
        this.stopPingMonitoring();

        this.pingInterval = setInterval(() => {
            if (this.isConnected()) {
                this.lastPingTime = Date.now();
                this.send({ type: 'ping' });
            }
        }, 5000); // Ping every 5 seconds
    }

    private stopPingMonitoring(): void {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
    }

    // 💓 HEARTBEAT
    private startHeartbeat(): void {
        this.stopHeartbeat();

        this.heartbeatInterval = setInterval(() => {
            if (this.isConnected()) {
                this.send({ type: 'heartbeat' });
            }
        }, 30000); // Every 30 seconds
    }

    private stopHeartbeat(): void {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }

    // 🔄 RECONNECTION LOGIC
    private attemptReconnect(): void {
        if (this.isIntentionalClose) {
            return;
        }

        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('[Purge-WS] 💔 Max reconnection attempts reached');
            this.callbacks.onError?.('Failed to reconnect. Please refresh the page.');
            return;
        }

        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
        }

        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);
        this.reconnectAttempts++;

        console.log(`[Purge-WS] 🔄 Reconnecting in ${delay}ms... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

        this.callbacks.onReconnecting?.(this.reconnectAttempts);

        this.reconnectTimeout = setTimeout(() => {
            console.log('[Purge-WS] 🔌 Attempting reconnection...');
            this.connect(this.callbacks);
        }, delay);
    }

    // 📤 PUBLIC API METHODS
    public sendReady(): void {
        this.send({ type: 'player:ready' });
    }

    public sendEliminated(): void {
        this.send({ type: 'player:eliminated' });
    }

    public sendWinner(winnerId: string): void {
        this.send({ type: 'game:winner', winnerId });
    }

    public requestSync(): void {
        this.send({ type: 'sync_request' });
    }

    // 📨 SEND WITH ERROR HANDLING
    private send(message: any): void {
        if (!this.isConnected()) {
            console.warn('[Purge-WS] ⚠️ Cannot send - not connected');
            return;
        }

        try {
            this.ws!.send(JSON.stringify(message));
        } catch (error) {
            console.error('[Purge-WS] ❌ Send error:', error);
            this.connectionQuality = 'poor';
        }
    }

    // 🧹 CLEANUP
    private cleanup(): void {
        this.stopHeartbeat();
        this.stopBatching();
        this.stopPingMonitoring();

        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }

        this.updateQueue = [];
        this.pendingUpdates.clear();
        this.lastSentUpdate = 0;
    }

    // 🔌 PUBLIC METHODS
    public isConnected(): boolean {
        return this.ws?.readyState === WebSocket.OPEN;
    }

    public disconnect(): void {
        console.log('[Purge-WS] 🔌 Disconnecting...');
        this.isIntentionalClose = true;
        this.cleanup();

        if (this.ws) {
            this.ws.close(1000, 'Client disconnect');
            this.ws = null;
        }
    }

    public getStats() {
        return {
            connected: this.isConnected(),
            connectionQuality: this.connectionQuality,
            latency: this.latency,
            reconnectAttempts: this.reconnectAttempts,
            queueSize: this.updateQueue.length,
            pendingUpdates: this.pendingUpdates.size,
            messageCount: this.messageCount
        };
    }
}

// 🎯 SINGLETON MANAGER WITH MULTI-HANDLER SUPPORT
class PurgeSingletonManager {
    private instance: PurgeWSManager | null = null;
    private handlers: Map<string, PurgeCallbacks> = new Map();
    private currentGameId: string | null = null;
    private currentPlayerId: string | null = null;

    connect(gameId: string, playerId: string, handlerId: string, callbacks: PurgeCallbacks): void {
        console.log('[Purge-Singleton] 🔌 Connect request:', {
            gameId: gameId.slice(0, 8),
            playerId: playerId.slice(0, 8),
            handlerId,
            hasInstance: !!this.instance
        });

        // Reuse connection if same game & player
        if (this.instance && this.currentGameId === gameId && this.currentPlayerId === playerId) {
            this.handlers.set(handlerId, callbacks);
            console.log('[Purge-Singleton] ♻️ Reusing connection, handlers:', this.handlers.size);

            if (this.instance.isConnected()) {
                callbacks.onConnected?.();
            }
            return;
        }

        // Disconnect old if switching games
        if (this.instance) {
            console.log('[Purge-Singleton] 🔄 Switching games, disconnecting...');
            this.instance.disconnect();
        }

        this.currentGameId = gameId;
        this.currentPlayerId = playerId;
        this.handlers.clear();
        this.handlers.set(handlerId, callbacks);

        this.instance = new PurgeWSManager(gameId, playerId);
        this.instance.connect(this.getMergedCallbacks());
    }

    private getMergedCallbacks(): PurgeCallbacks {
        return {
            onConnected: () => {
                console.log('[Purge-Singleton] ✅ Broadcasting onConnected to', this.handlers.size, 'handlers');
                this.handlers.forEach(h => h.onConnected?.());
            },
            onDisconnected: () => {
                console.log('[Purge-Singleton] ❌ Broadcasting onDisconnected');
                this.handlers.forEach(h => h.onDisconnected?.());
            },
            onReconnecting: (attempt) => {
                this.handlers.forEach(h => h.onReconnecting?.(attempt));
            },
            onSync: (players) => {
                console.log('[Purge-Singleton] 📦 Broadcasting sync:', players.length, 'players');
                this.handlers.forEach(h => h.onSync?.(players));
            },
            onPlayerUpdate: (id, state) => {
                this.handlers.forEach(h => h.onPlayerUpdate?.(id, state));
            },
            onPlayerJoined: (id, state) => {
                this.handlers.forEach(h => h.onPlayerJoined?.(id, state));
            },
            onPlayerLeft: (id) => {
                this.handlers.forEach(h => h.onPlayerLeft?.(id));
            },
            onPlayerEliminated: (id) => {
                this.handlers.forEach(h => h.onPlayerEliminated?.(id));
            },
            onPlayerReady: (id) => {
                this.handlers.forEach(h => h.onPlayerReady?.(id));
            },
            onGamePhaseChange: (phase) => {
                this.handlers.forEach(h => h.onGamePhaseChange?.(phase));
            },
            onCountdownStart: (start, dur) => {
                this.handlers.forEach(h => h.onCountdownStart?.(start, dur));
            },
            onGameStart: () => {
                this.handlers.forEach(h => h.onGameStart?.());
            },
            onGameEnd: (winnerId) => {
                this.handlers.forEach(h => h.onGameEnd?.(winnerId));
            },
            onError: (err) => {
                this.handlers.forEach(h => h.onError?.(err));
            }
        };
    }

    queueUpdate(state: Partial<PlayerState>): void {
        if (!this.instance) {
            console.warn('[Purge-Singleton] ⚠️ No active instance');
            return;
        }
        this.instance.queueUpdate(state);
    }

    sendReady(): void {
        this.instance?.sendReady();
    }

    sendEliminated(): void {
        this.instance?.sendEliminated();
    }

    requestSync(): void {
        this.instance?.requestSync();
    }

    isConnected(): boolean {
        return this.instance?.isConnected() || false;
    }

    unregisterHandler(handlerId: string): void {
        console.log('[Purge-Singleton] 🗑️ Unregister:', handlerId);
        this.handlers.delete(handlerId);

        if (this.handlers.size === 0) {
            console.log('[Purge-Singleton] 🧹 No more handlers, disconnecting');
            this.instance?.disconnect();
            this.instance = null;
            this.currentGameId = null;
            this.currentPlayerId = null;
        }
    }

    disconnect(): void {
        console.log('[Purge-Singleton] 🔌 Manual disconnect');
        this.instance?.disconnect();
        this.instance = null;
        this.handlers.clear();
        this.currentGameId = null;
        this.currentPlayerId = null;
    }

    getStats() {
        if (!this.instance) {
            return {
                connected: false,
                handlers: 0
            };
        }

        return {
            ...this.instance.getStats(),
            handlers: this.handlers.size,
            gameId: this.currentGameId?.slice(0, 8),
            playerId: this.currentPlayerId?.slice(0, 8)
        };
    }
}

export const purgeWsManager = new PurgeSingletonManager();