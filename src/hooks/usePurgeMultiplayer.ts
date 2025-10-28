// src/hooks/usePurgeMultiplayer.ts - WORKING VERSION (accepts balance from props)

import { useState, useEffect, useRef, useCallback } from 'react';

const WS_URL = import.meta.env.VITE_PURGE_WS_URL || 'wss://purge-server-production.up.railway.app';

export interface Player {
    id: string;
    walletAddress: string;
    position: { x: number; y: number };
    velocity: { x: number; y: number };
    hp: number;
    maxHp: number;
    radius: number;
    speed: number;
    eliminated: boolean;
    vsolBalance: number;
    ready: boolean;
    lastUpdate: number;
}

interface UsePurgeMultiplayerProps {
    gameId: string;
    playerId: string;
    enabled?: boolean;
    vsolBalance?: number; // ✅ Balance venit din exterior
}

export const usePurgeMultiplayer = ({
    gameId,
    playerId,
    enabled = true,
    vsolBalance: externalBalance // ✅ Primim balance din props
}: UsePurgeMultiplayerProps) => {

    // Connection state
    const [connected, setConnected] = useState(false);
    const [reconnecting, setReconnecting] = useState(false);

    // Game state
    const [gamePhase, setGamePhase] = useState<'waiting' | 'countdown' | 'active' | 'ended'>('waiting');
    const [countdown, setCountdown] = useState<number | null>(null);
    const [players, setPlayers] = useState<Record<string, Player>>({});
    const [safeZone, setSafeZone] = useState({ x: 400, y: 300, radius: 350 });
    const [winner, setWinner] = useState<string | null>(null);

    // WebSocket refs
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const reconnectAttemptsRef = useRef(0);
    const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);

    const vsolBalanceRef = useRef<number>(0);
    const isConnectingRef = useRef(false);
    const hasInitializedRef = useRef(false);

    // Derived state
    const playersArray = Object.values(players);
    const readyPlayers = playersArray.filter(p => p.ready);

    // ✅ Update balance când vine din props
    useEffect(() => {
        if (externalBalance && externalBalance > 0) {
            vsolBalanceRef.current = externalBalance;
            console.log('[usePurgeMP] ✅ Balance set:', (externalBalance / 1e9).toFixed(4), 'SOL');
        }
    }, [externalBalance]);



    // Message handler
    const handleMessage = useCallback((data: any) => {
        switch (data.type) {
            case 'connected':
            case 'joined':
                console.log('[usePurgeMP] ✅', data.type);
                break;

            case 'game_state':
                if (data.state) {
                    console.log('[usePurgeMP] 📦 State:', data.state.phase);
                    setGamePhase(data.state.phase);
                    setPlayers(data.state.players || {});
                    setSafeZone(data.state.safeZone);
                    setCountdown(data.state.countdown);
                    setWinner(data.state.winner);
                }
                break;

            case 'phase_change':
                setGamePhase(data.phase);
                break;

            case 'countdown':
                setCountdown(data.seconds);
                break;

            case 'player_joined':
                if (data.player) {
                    setPlayers(prev => ({
                        ...prev,
                        [data.player.id]: data.player
                    }));
                }
                break;

            case 'player_left':
                setPlayers(prev => {
                    const newPlayers = { ...prev };
                    delete newPlayers[data.playerId];
                    return newPlayers;
                });
                break;

            case 'player_ready':
                setPlayers(prev => ({
                    ...prev,
                    [data.playerId]: {
                        ...prev[data.playerId],
                        ready: true
                    }
                }));
                break;

            case 'player_update':
                if (data.player) {
                    setPlayers(prev => ({
                        ...prev,
                        [data.player.id]: data.player
                    }));
                }
                break;

            case 'player_eliminated':
                setPlayers(prev => ({
                    ...prev,
                    [data.playerId]: {
                        ...prev[data.playerId],
                        eliminated: true,
                        hp: 0
                    }
                }));
                break;

            case 'safe_zone_update':
                if (data.safeZone) {
                    setSafeZone(data.safeZone);
                }
                break;

            case 'winner':
                setWinner(data.winnerId);
                setGamePhase('ended');
                break;

            case 'error':
                console.error('[usePurgeMP] ❌ Error:', data.message);
                break;

            case 'pong':
                break;

            default:
                console.log('[usePurgeMP] ❓ Unknown:', data.type);
        }
    }, []);

    // WebSocket connection
    const connect = useCallback(() => {
        if (isConnectingRef.current || wsRef.current?.readyState === WebSocket.OPEN) {
            return;
        }

        if (!enabled || !gameId || !playerId) {
            console.log('[usePurgeMP] ❌ Missing params');
            return;
        }

        // ✅ Așteaptă balance
        if (!vsolBalanceRef.current || vsolBalanceRef.current <= 0) {
            console.log('[usePurgeMP] ⏳ Waiting for balance...');
            setTimeout(() => connect(), 500);
            return;
        }

        isConnectingRef.current = true;

        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }

        try {
            const url = `${WS_URL}/game?gameId=${gameId}&playerId=${playerId}`;
            console.log('[usePurgeMP] 🔗 Connecting...');

            const ws = new WebSocket(url);
            wsRef.current = ws;

            ws.onopen = () => {
                console.log('[usePurgeMP] ✅ OPEN');
                isConnectingRef.current = false;
                setConnected(true);
                setReconnecting(false);
                reconnectAttemptsRef.current = 0;

                // Send join
                const joinMsg = {
                    type: 'join',
                    gameId,
                    playerId,
                    vsolBalance: vsolBalanceRef.current
                };
                console.log('[usePurgeMP] 📤 Join:', (vsolBalanceRef.current / 1e9).toFixed(4), 'SOL');
                ws.send(JSON.stringify(joinMsg));

                // Start ping
                if (pingIntervalRef.current) {
                    clearInterval(pingIntervalRef.current);
                }
                pingIntervalRef.current = setInterval(() => {
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({ type: 'ping' }));
                    }
                }, 30000);
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    handleMessage(data);
                } catch (error) {
                    console.error('[usePurgeMP] ❌ Parse error:', error);
                }
            };

            ws.onerror = (error) => {
                console.error('[usePurgeMP] ❌ Error:', error);
                isConnectingRef.current = false;
            };

            ws.onclose = (event) => {
                console.log('[usePurgeMP] 🔌 Closed:', event.code);
                isConnectingRef.current = false;
                setConnected(false);

                if (pingIntervalRef.current) {
                    clearInterval(pingIntervalRef.current);
                    pingIntervalRef.current = null;
                }

                if (enabled && event.code !== 1000 && reconnectAttemptsRef.current < 5) {
                    const delay = Math.min(1000 * Math.pow(1.5, reconnectAttemptsRef.current), 10000);
                    console.log('[usePurgeMP] 🔄 Reconnect in', delay + 'ms');
                    setReconnecting(true);
                    reconnectAttemptsRef.current++;

                    if (reconnectTimeoutRef.current) {
                        clearTimeout(reconnectTimeoutRef.current);
                    }
                    reconnectTimeoutRef.current = setTimeout(() => {
                        connect();
                    }, delay);
                }
            };
        } catch (error) {
            console.error('[usePurgeMP] ❌ Connect error:', error);
            isConnectingRef.current = false;
        }
    }, [enabled, gameId, playerId, handleMessage]);

    // Initialize
    useEffect(() => {
        if (!enabled || hasInitializedRef.current) return;

        hasInitializedRef.current = true;
        console.log('[usePurgeMP] 🚀 Init');

        connect();

        return () => {
            console.log('[usePurgeMP] 🧹 Cleanup');
            hasInitializedRef.current = false;
            isConnectingRef.current = false;

            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
                reconnectTimeoutRef.current = null;
            }
            if (pingIntervalRef.current) {
                clearInterval(pingIntervalRef.current);
                pingIntervalRef.current = null;
            }
            if (wsRef.current) {
                wsRef.current.close(1000);
                wsRef.current = null;
            }
        };
    }, [enabled, connect]);

    // Send methods
    const sendReady = useCallback(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            console.log('[usePurgeMP] 📤 Ready');
            wsRef.current.send(JSON.stringify({
                type: 'player:ready',
                playerId
            }));
        } else {
            console.warn('[usePurgeMP] ⚠️ Not connected');
        }
    }, [playerId]);

    const sendMove = useCallback((direction: { x: number; y: number }) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                type: 'move',
                playerId,
                direction
            }));
        }
    }, [playerId]);

    const sendPosition = useCallback((position: { x: number; y: number }) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                type: 'position',
                playerId,
                position
            }));
        }
    }, [playerId]);

    return {
        connected,
        reconnecting,
        gamePhase,
        countdown,
        players,
        playersArray,
        safeZone,
        winner,
        readyPlayers,
        totalPlayers: playersArray.length,
        readyCount: readyPlayers.length,
        sendReady,
        sendMove,
        sendPosition,
        reconnect: connect,
        vsolBalance: vsolBalanceRef.current,
    };
};