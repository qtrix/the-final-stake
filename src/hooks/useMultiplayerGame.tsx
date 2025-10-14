import { useEffect, useRef, useState, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { PlayerState } from '@/types';

interface UseMultiplayerGameOptions {
    gameId: number;
    enabled: boolean;
    onPlayerUpdate?: (playerId: string, state: PlayerState) => void;
    onPlayerEliminated?: (playerId: string) => void;
    onWinnerDeclared?: (winnerId: string) => void;
}

const WS_URL = import.meta.env.VITE_WS_URL || 'wss://solana-survivor-ws.herokuapp.com';
const RECONNECT_DELAY = 3000;
const HEARTBEAT_INTERVAL = 20000;
const UPDATE_THROTTLE = 50; // Send updates every 50ms (20 updates/sec)

export const useMultiplayerGame = ({
    gameId,
    enabled,
    onPlayerUpdate,
    onPlayerEliminated,
    onWinnerDeclared
}: UseMultiplayerGameOptions) => {
    const wallet = useWallet();
    const wsRef = useRef<WebSocket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [otherPlayers, setOtherPlayers] = useState<Map<string, PlayerState>>(new Map());
    const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
    const heartbeatIntervalRef = useRef<NodeJS.Timeout>();
    const lastUpdateTimeRef = useRef<number>(0);
    const pendingUpdateRef = useRef<PlayerState | null>(null);

    const connect = useCallback(() => {
        if (!wallet.publicKey || !enabled) return;

        try {
            const playerId = wallet.publicKey.toBase58();
            const ws = new WebSocket(`${WS_URL}?gameId=${gameId}&playerId=${playerId}`);
            wsRef.current = ws;

            ws.onopen = () => {
                console.log('✅ Connected to multiplayer server');
                setIsConnected(true);

                // Start heartbeat
                heartbeatIntervalRef.current = setInterval(() => {
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({ type: 'heartbeat' }));
                    }
                }, HEARTBEAT_INTERVAL);
            };

            ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);

                    switch (message.type) {
                        case 'sync':
                            // Initial sync with all players
                            const players = new Map<string, PlayerState>();
                            message.players?.forEach((p: PlayerState) => {
                                if (p.id !== playerId) {
                                    players.set(p.id, p);
                                }
                            });
                            setOtherPlayers(players);
                            break;

                        case 'update':
                            // Player position update
                            if (message.playerId !== playerId && message.data) {
                                setOtherPlayers(prev => {
                                    const updated = new Map(prev);
                                    updated.set(message.playerId, message.data);
                                    return updated;
                                });
                                onPlayerUpdate?.(message.playerId, message.data);
                            }
                            break;

                        case 'eliminated':
                            // Player eliminated
                            setOtherPlayers(prev => {
                                const updated = new Map(prev);
                                const player = updated.get(message.playerId);
                                if (player) {
                                    updated.set(message.playerId, { ...player, alive: false });
                                }
                                return updated;
                            });
                            onPlayerEliminated?.(message.playerId);
                            break;

                        case 'winner':
                            // Winner declared
                            onWinnerDeclared?.(message.winnerId);
                            break;
                    }
                } catch (error) {
                    console.error('Failed to parse WebSocket message:', error);
                }
            };

            ws.onclose = () => {
                console.log('🔌 Disconnected from multiplayer server');
                setIsConnected(false);

                if (heartbeatIntervalRef.current) {
                    clearInterval(heartbeatIntervalRef.current);
                }

                // Auto-reconnect
                reconnectTimeoutRef.current = setTimeout(() => {
                    console.log('🔄 Reconnecting...');
                    connect();
                }, RECONNECT_DELAY);
            };

            ws.onerror = (error) => {
                console.error('❌ WebSocket error:', error);
            };
        } catch (error) {
            console.error('Failed to connect to multiplayer server:', error);
        }
    }, [gameId, wallet.publicKey, enabled, onPlayerUpdate, onPlayerEliminated, onWinnerDeclared]);

    // Throttled update sender
    useEffect(() => {
        if (!pendingUpdateRef.current) return;

        const now = Date.now();
        if (now - lastUpdateTimeRef.current < UPDATE_THROTTLE) {
            return;
        }

        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                type: 'update',
                data: pendingUpdateRef.current
            }));
            lastUpdateTimeRef.current = now;
            pendingUpdateRef.current = null;
        }
    }, []);

    const sendUpdate = useCallback((state: PlayerState) => {
        pendingUpdateRef.current = state;

        const now = Date.now();
        if (now - lastUpdateTimeRef.current >= UPDATE_THROTTLE) {
            if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({
                    type: 'update',
                    data: state
                }));
                lastUpdateTimeRef.current = now;
                pendingUpdateRef.current = null;
            }
        }
    }, []);

    const sendEliminated = useCallback(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                type: 'eliminated'
            }));
        }
    }, []);

    const sendWinner = useCallback((winnerId: string) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                type: 'winner',
                winnerId
            }));
        }
    }, []);

    useEffect(() => {
        if (enabled) {
            connect();
        }

        return () => {
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
            if (heartbeatIntervalRef.current) {
                clearInterval(heartbeatIntervalRef.current);
            }
            if (wsRef.current) {
                wsRef.current.close();
            }
        };
    }, [enabled, connect]);

    return {
        isConnected,
        otherPlayers,
        sendUpdate,
        sendEliminated,
        sendWinner
    };
};