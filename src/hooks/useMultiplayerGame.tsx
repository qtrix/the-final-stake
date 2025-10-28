// useMultiplayerGame.ts - Custom Hook with Singleton WebSocket Manager
// ✅ FIX: This resolves the multiple WebSocket connections issue

import { useState, useEffect, useRef, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { PlayerState } from '@/types';

// ============================================================================
// SINGLETON WEBSOCKET MANAGER
// ============================================================================

type MessageHandler = {
    id: string;
    onPlayerUpdate?: (playerId: string, state: PlayerState) => void;
    onPlayerEliminated?: (playerId: string) => void;
    onWinnerDeclared?: (winnerId: string) => void;
    onGamePhaseChange?: (phase: string) => void;
    onCountdownSync?: (startTime: number, duration: number) => void;
    onSync?: (players: PlayerState[]) => void;
};

class WebSocketManager {
    private static instance: WebSocketManager | null = null;
    private ws: WebSocket | null = null;
    private handlers: Map<string, MessageHandler> = new Map();
    private connectionState: 'disconnected' | 'connecting' | 'connected' = 'disconnected';
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 5;
    private reconnectDelay = 2000;
    private messageQueue: any[] = [];
    private currentGameId: number | null = null;
    private currentPlayerId: string | null = null;
    private heartbeatInterval: NodeJS.Timeout | null = null;

    private constructor() {
        console.log('🔧 [WebSocketManager] Singleton instance created');
    }

    public static getInstance(): WebSocketManager {
        if (!WebSocketManager.instance) {
            WebSocketManager.instance = new WebSocketManager();
        }
        return WebSocketManager.instance;
    }

    public connect(gameId: number, playerId: string, onConnected?: () => void, onError?: (error: any) => void): void {
        // ✅ FIX: If already connected to the same game, don't reconnect
        if (
            this.ws &&
            this.ws.readyState === WebSocket.OPEN &&
            this.currentGameId === gameId &&
            this.currentPlayerId === playerId
        ) {
            console.log('✅ [WebSocketManager] Already connected to game', gameId);
            onConnected?.();
            return;
        }

        // ✅ FIX: Disconnect any existing connection first
        if (this.ws) {
            console.log('🔌 [WebSocketManager] Closing previous connection');
            this.disconnect();
        }

        this.currentGameId = gameId;
        this.currentPlayerId = playerId;
        this.connectionState = 'connecting';

        const wsUrl = import.meta.env.VITE_WS_URL || 'wss://purge-server-production.up.railway.app';
        const url = `${wsUrl}?gameId=${gameId}&playerId=${playerId}`;

        console.log(`🔗 [WebSocketManager] Connecting (${this.reconnectAttempts + 1}/${this.maxReconnectAttempts}):`, url);

        try {
            this.ws = new WebSocket(url);

            this.ws.onopen = () => {
                console.log('✅ [WebSocketManager] WebSocket connected!');
                this.connectionState = 'connected';
                this.reconnectAttempts = 0;
                this.flushMessageQueue();
                this.startHeartbeat();
                onConnected?.();
            };

            this.ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    this.handleMessage(message);
                } catch (error) {
                    console.error('❌ [WebSocketManager] Error parsing message:', error);
                }
            };

            this.ws.onerror = (error) => {
                console.error('❌ [WebSocketManager] WebSocket error:', error);
                this.connectionState = 'disconnected';
                onError?.(error);
            };

            this.ws.onclose = () => {
                console.log('🔌 [WebSocketManager] WebSocket closed');
                this.connectionState = 'disconnected';
                this.stopHeartbeat();

                // ✅ FIX: Auto-reconnect with exponential backoff
                if (this.reconnectAttempts < this.maxReconnectAttempts && this.currentGameId && this.currentPlayerId) {
                    this.reconnectAttempts++;
                    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
                    console.log(`🔄 [WebSocketManager] Reconnecting in ${delay}ms...`);

                    setTimeout(() => {
                        if (this.currentGameId && this.currentPlayerId) {
                            this.connect(this.currentGameId, this.currentPlayerId, onConnected, onError);
                        }
                    }, delay);
                } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
                    console.error('❌ [WebSocketManager] Max reconnect attempts reached');
                }
            };
        } catch (error) {
            console.error('❌ [WebSocketManager] Error creating WebSocket:', error);
            this.connectionState = 'disconnected';
            onError?.(error);
        }
    }

    public disconnect(): void {
        this.stopHeartbeat();

        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }

        this.currentGameId = null;
        this.currentPlayerId = null;
        this.reconnectAttempts = 0;
        this.messageQueue = [];
        this.connectionState = 'disconnected';

        console.log('🔌 [WebSocketManager] Disconnected');
    }

    public send(message: any): void {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        } else {
            console.warn('⚠️ [WebSocketManager] WebSocket not connected, queueing message');
            this.messageQueue.push(message);
        }
    }

    public registerHandler(handler: MessageHandler): void {
        this.handlers.set(handler.id, handler);
        console.log(`📝 [WebSocketManager] Registered handler: ${handler.id}`);
    }

    public unregisterHandler(id: string): void {
        this.handlers.delete(id);
        console.log(`📝 [WebSocketManager] Unregistered handler: ${id}`);
    }

    public isConnected(): boolean {
        return this.connectionState === 'connected' && this.ws !== null && this.ws.readyState === WebSocket.OPEN;
    }

    public getConnectionState(): 'disconnected' | 'connecting' | 'connected' {
        return this.connectionState;
    }

    private handleMessage(message: any): void {
        // ✅ FIX: Notify all registered handlers
        this.handlers.forEach((handler) => {
            switch (message.type) {
                case 'sync':
                    handler.onSync?.(message.players || []);
                    break;

                case 'player_state_update':
                    handler.onPlayerUpdate?.(message.playerId, message.state);
                    break;

                case 'player_eliminated':
                    handler.onPlayerEliminated?.(message.playerId);
                    break;

                case 'winner_declared':
                    handler.onWinnerDeclared?.(message.winnerId);
                    break;

                case 'game_state_update':
                    if (message.gameState?.phase) {
                        handler.onGamePhaseChange?.(message.gameState.phase);

                        if (message.gameState.phase === 'countdown' && message.gameState.countdownStartTime) {
                            handler.onCountdownSync?.(
                                message.gameState.countdownStartTime,
                                message.gameState.countdownDuration || 15000
                            );
                        }
                    }
                    break;

                case 'heartbeat_ack':
                    // Silent ack
                    break;

                default:
                    console.warn('⚠️ [WebSocketManager] Unknown message type:', message.type);
            }
        });
    }

    private flushMessageQueue(): void {
        if (this.messageQueue.length > 0) {
            console.log(`📤 [WebSocketManager] Flushing ${this.messageQueue.length} queued messages`);
            this.messageQueue.forEach((message) => this.send(message));
            this.messageQueue = [];
        }
    }

    private startHeartbeat(): void {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }

        this.heartbeatInterval = setInterval(() => {
            if (this.isConnected()) {
                this.send({ type: 'heartbeat' });
            }
        }, 30000); // Every 30 seconds

        console.log('❤️ [WebSocketManager] Heartbeat started');
    }

    private stopHeartbeat(): void {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
            console.log('❤️ [WebSocketManager] Heartbeat stopped');
        }
    }
}

// ============================================================================
// REACT HOOK
// ============================================================================

interface UseMultiplayerGameOptions {
    gameId: number;
    enabled: boolean;
    onPlayerUpdate?: (playerId: string, state: PlayerState) => void;
    onPlayerEliminated?: (playerId: string) => void;
    onWinnerDeclared?: (winnerId: string) => void;
    onGamePhaseChange?: (phase: string) => void;
    onCountdownSync?: (startTime: number, duration: number) => void;
}

interface UseMultiplayerGameResult {
    isConnected: boolean;
    otherPlayers: Map<string, PlayerState>;
    gamePhase: string;
    sendUpdate: (state: PlayerState) => void;
    sendEliminated: () => void;
    sendWinner: (winnerId: string) => void;
    requestSync: () => void;
}

export const useMultiplayerGame = ({
    gameId,
    enabled,
    onPlayerUpdate,
    onPlayerEliminated,
    onWinnerDeclared,
    onGamePhaseChange,
    onCountdownSync,
}: UseMultiplayerGameOptions): UseMultiplayerGameResult => {
    const wallet = useWallet();
    const [isConnected, setIsConnected] = useState(false);
    const [otherPlayers, setOtherPlayers] = useState<Map<string, PlayerState>>(new Map());
    const [gamePhase, setGamePhase] = useState<string>('waiting');
    const lastUpdateTimeRef = useRef<number>(0);
    const UPDATE_THROTTLE = 50; // 20 FPS

    // ✅ FIX: Get singleton instance
    const wsManager = useRef(WebSocketManager.getInstance());

    useEffect(() => {
        if (!enabled || !wallet.publicKey || !gameId) {
            console.log('❌ [useMultiplayerGame] Multiplayer disabled:', { enabled, hasWallet: !!wallet.publicKey, gameId });
            return;
        }

        const playerId = wallet.publicKey.toBase58();
        const handlerId = `multiplayer-${gameId}-${Date.now()}`;

        console.log('🎮 [useMultiplayerGame] Initializing multiplayer for game', gameId);

        // ✅ FIX: Register handlers BEFORE connecting
        wsManager.current.registerHandler({
            id: handlerId,
            onSync: (players: PlayerState[]) => {
                console.log('📊 [useMultiplayerGame] Synced players:', players.length);
                const playersMap = new Map<string, PlayerState>();
                players.forEach((player) => {
                    if (player.id !== playerId) {
                        playersMap.set(player.id, player);
                    }
                });
                setOtherPlayers(playersMap);
            },
            onPlayerUpdate: (id: string, state: PlayerState) => {
                if (id !== playerId) {
                    setOtherPlayers((prev) => {
                        const updated = new Map(prev);
                        updated.set(id, state);
                        return updated;
                    });
                    onPlayerUpdate?.(id, state);
                }
            },
            onPlayerEliminated: (id: string) => {
                console.log('💀 [useMultiplayerGame] Player eliminated:', id.slice(0, 8));
                if (id === playerId) {
                    onPlayerEliminated?.(id);
                } else {
                    setOtherPlayers((prev) => {
                        const updated = new Map(prev);
                        updated.delete(id);
                        return updated;
                    });
                }
            },
            onWinnerDeclared: (winnerId: string) => {
                console.log('🏆 [useMultiplayerGame] Winner declared:', winnerId.slice(0, 8));
                onWinnerDeclared?.(winnerId);
            },
            onGamePhaseChange: (phase: string) => {
                console.log('🎮 [useMultiplayerGame] Game phase changed:', phase);
                setGamePhase(phase);
                onGamePhaseChange?.(phase);
            },
            onCountdownSync: (startTime: number, duration: number) => {
                console.log('⏱️ [useMultiplayerGame] Countdown synced:', { startTime, duration });
                onCountdownSync?.(startTime, duration);
            },
        });

        // ✅ FIX: Connect WebSocket
        wsManager.current.connect(
            gameId,
            playerId,
            () => {
                console.log('✅ [useMultiplayerGame] Connected to multiplayer!');
                setIsConnected(true);

                // Request initial sync
                setTimeout(() => {
                    wsManager.current.send({ type: 'request_sync' });
                }, 500);
            },
            (error) => {
                console.error('❌ [useMultiplayerGame] Connection error:', error);
                setIsConnected(false);
            }
        );

        // ✅ FIX: Update connection state periodically
        const checkInterval = setInterval(() => {
            setIsConnected(wsManager.current.isConnected());
        }, 1000);

        // Cleanup
        return () => {
            console.log('🧹 [useMultiplayerGame] Cleaning up multiplayer');
            wsManager.current.unregisterHandler(handlerId);
            clearInterval(checkInterval);
            // ✅ FIX: Don't disconnect singleton - let it manage its own lifecycle
        };
    }, [gameId, enabled, wallet.publicKey, onPlayerUpdate, onPlayerEliminated, onWinnerDeclared, onGamePhaseChange, onCountdownSync]);

    const sendUpdate = useCallback((state: PlayerState) => {
        if (!wsManager.current.isConnected()) return;

        const now = Date.now();
        if (now - lastUpdateTimeRef.current >= UPDATE_THROTTLE) {
            wsManager.current.send({
                type: 'player_state_update',
                state,
            });
            lastUpdateTimeRef.current = now;
        }
    }, []);

    const sendEliminated = useCallback(() => {
        if (wsManager.current.isConnected()) {
            wsManager.current.send({ type: 'player_eliminated' });
            console.log('💀 [useMultiplayerGame] Sent elimination');
        }
    }, []);

    const sendWinner = useCallback((winnerId: string) => {
        if (wsManager.current.isConnected()) {
            wsManager.current.send({ type: 'declare_winner', winnerId });
            console.log('🏆 [useMultiplayerGame] Sent winner:', winnerId.slice(0, 8));
        }
    }, []);

    const requestSync = useCallback(() => {
        if (wsManager.current.isConnected()) {
            wsManager.current.send({ type: 'request_sync' });
            console.log('🔄 [useMultiplayerGame] Requested sync');
        }
    }, []);

    return {
        isConnected,
        otherPlayers,
        gamePhase,
        sendUpdate,
        sendEliminated,
        sendWinner,
        requestSync,
    };
};