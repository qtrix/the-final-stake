// src/hooks/usePurgeMultiplayer.ts - Optimized Multiplayer Hook

import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

const WS_URL = import.meta.env.VITE_PURGE_WS_URL || 'ws://localhost:3001';

export type GamePhase = 'waiting' | 'countdown' | 'active' | 'ended';

interface Vector2D {
    x: number;
    y: number;
}

export interface PlayerState {
    id: string;
    walletAddress: string;
    username?: string;
    x: number;
    y: number;
    velocityX: number;
    velocityY: number;
    rotation: number;
    hp: number;
    maxHp: number;
    vsolBalance: number;
    score: number;
    kills: number;
    ready: boolean;
    eliminated: boolean;
    isAlive: boolean;
    isInSafeZone: boolean;
    joinedAt: number;
    lastUpdate: number;
}

interface SafeZone {
    centerX: number;
    centerY: number;
    radius: number;
    targetRadius: number;
    shrinking: boolean;
    nextShrinkAt: number;
}

interface UsePurgeMultiplayerProps {
    gameId: string;
    playerId: string;
    enabled?: boolean;
}

interface PlayerMap {
    [playerId: string]: PlayerState;
}

export function usePurgeMultiplayer({
    gameId,
    playerId,
    enabled = true
}: UsePurgeMultiplayerProps) {
    const navigate = useNavigate();

    // Connection state
    const [connected, setConnected] = useState(false);
    const [reconnecting, setReconnecting] = useState(false);
    const [connectionQuality, setConnectionQuality] = useState<'good' | 'fair' | 'poor'>('good');

    // Game state
    const [gamePhase, setGamePhase] = useState<GamePhase>('waiting');
    const [countdown, setCountdown] = useState<number | null>(null);
    const [safeZone, setSafeZone] = useState<SafeZone | null>(null);

    // Players
    const [players, setPlayers] = useState<PlayerMap>({});

    // WebSocket
    const ws = useRef<WebSocket | null>(null);
    const reconnectAttempts = useRef(0);
    const reconnectTimeout = useRef<NodeJS.Timeout | null>(null);
    const heartbeatInterval = useRef<NodeJS.Timeout | null>(null);
    const countdownInterval = useRef<NodeJS.Timeout | null>(null);
    const handlerId = useRef(`hook-${Date.now()}`);

    // Update batching
    const updateQueue = useRef<Partial<PlayerState>[]>([]);
    const batchInterval = useRef<NodeJS.Timeout | null>(null);
    const lastUpdateTime = useRef(0);

    // Interpolation
    const interpolationTargets = useRef<Map<string, PlayerState>>(new Map());
    const lastInterpolationTime = useRef(Date.now());

    // Ping monitoring
    const pingTime = useRef(0);
    const latency = useRef(0);

    // Connect to WebSocket
    const connect = useCallback(() => {
        if (!enabled || !gameId || !playerId) {
            console.log('[usePurgeMP] Not enabled or missing params');
            return;
        }

        const url = `${WS_URL}/game?gameId=${gameId}&playerId=${playerId}`;
        console.log('[usePurgeMP] Connecting:', url);

        try {
            ws.current = new WebSocket(url);

            ws.current.onopen = () => {
                console.log('[usePurgeMP] ✅ Connected');
                setConnected(true);
                setReconnecting(false);
                reconnectAttempts.current = 0;

                startHeartbeat();
                startBatching();

                // Request initial sync
                send({ type: 'request_sync' });
            };

            ws.current.onmessage = (event) => {
                handleMessage(JSON.parse(event.data));
            };

            ws.current.onclose = () => {
                console.log('[usePurgeMP] ❌ Disconnected');
                setConnected(false);
                stopHeartbeat();
                stopBatching();

                if (enabled && reconnectAttempts.current < 5) {
                    attemptReconnect();
                }
            };

            ws.current.onerror = (error) => {
                console.error('[usePurgeMP] Error:', error);
            };

        } catch (error) {
            console.error('[usePurgeMP] Connection failed:', error);
        }
    }, [enabled, gameId, playerId]);

    // Handle incoming messages
    const handleMessage = useCallback((message: any) => {
        switch (message.type) {
            case 'sync':
                console.log('[usePurgeMP] 📦 Sync:', message.players?.length || 0, 'players');
                const newPlayers: PlayerMap = {};
                message.players?.forEach((p: PlayerState) => {
                    newPlayers[p.id] = p;
                    interpolationTargets.current.set(p.id, p);
                });
                setPlayers(newPlayers);

                if (message.safeZone) {
                    setSafeZone(message.safeZone);
                }
                if (message.phase) {
                    setGamePhase(message.phase);
                }
                break;

            case 'player:update':
                if (message.id === playerId) return; // Skip own updates

                interpolationTargets.current.set(message.id, message.state as PlayerState);

                // Immediate update for critical changes
                if (message.state.eliminated || message.state.hp !== undefined) {
                    setPlayers(prev => ({
                        ...prev,
                        [message.id]: { ...prev[message.id], ...message.state }
                    }));
                }
                break;

            case 'player:connected':
                console.log('[usePurgeMP] 👋 Player joined:', message.playerId?.slice(0, 8));
                setPlayers(prev => ({
                    ...prev,
                    [message.playerId]: message.state
                }));
                interpolationTargets.current.set(message.playerId, message.state);
                break;

            case 'player:disconnected':
                console.log('[usePurgeMP] 👋 Player left:', message.playerId?.slice(0, 8));
                setPlayers(prev => {
                    const newPlayers = { ...prev };
                    delete newPlayers[message.playerId];
                    return newPlayers;
                });
                interpolationTargets.current.delete(message.playerId);
                break;

            case 'player:eliminated':
                console.log('[usePurgeMP] 💀 Player eliminated:', message.playerId?.slice(0, 8));
                setPlayers(prev => ({
                    ...prev,
                    [message.playerId]: { ...prev[message.playerId], eliminated: true, isAlive: false }
                }));
                break;

            case 'player:ready':
                console.log('[usePurgeMP] ✅ Player ready:', message.playerId?.slice(0, 8));
                setPlayers(prev => ({
                    ...prev,
                    [message.playerId]: { ...prev[message.playerId], ready: true }
                }));
                break;

            case 'game:phase':
                console.log('[usePurgeMP] 🎮 Phase:', message.phase);
                setGamePhase(message.phase);
                break;

            case 'game:countdown':
                console.log('[usePurgeMP] ⏱️ Countdown started');
                startCountdownTimer(message.startTime, message.duration);
                break;

            case 'game:start':
                console.log('[usePurgeMP] 🚀 Game started!');
                setCountdown(null);
                setGamePhase('active');
                // Auto-navigate to game
                navigate(`/phase3/game/${gameId}`);
                break;

            case 'game:winner':
                console.log('[usePurgeMP] 🏆 Winner:', message.winnerId?.slice(0, 8));
                setGamePhase('ended');
                // Navigate to results
                setTimeout(() => {
                    navigate(`/phase3/winner?gameId=${gameId}&winner=${message.winnerId}&prize=${message.finalStats?.prize || 0}`);
                }, 2000);
                break;

            case 'safezone:update':
                setSafeZone(message.safeZone);
                break;

            case 'pong':
                if (pingTime.current > 0) {
                    latency.current = Date.now() - pingTime.current;
                    pingTime.current = 0;

                    // Update connection quality
                    const newQuality = latency.current < 50 ? 'good' :
                        latency.current < 150 ? 'fair' : 'poor';
                    setConnectionQuality(newQuality);
                }
                break;

            case 'error':
                console.error('[usePurgeMP] Server error:', message.message);
                break;
        }
    }, [playerId, gameId, navigate]);

    // Countdown timer
    const startCountdownTimer = useCallback((startTime: number, duration: number) => {
        if (countdownInterval.current) {
            clearInterval(countdownInterval.current);
        }

        const updateCountdown = () => {
            const now = Date.now();
            const elapsed = now - startTime;
            const remaining = Math.max(0, duration - elapsed);

            setCountdown(Math.ceil(remaining / 1000));

            if (remaining <= 0) {
                if (countdownInterval.current) {
                    clearInterval(countdownInterval.current);
                    countdownInterval.current = null;
                }
                setCountdown(null);
            }
        };

        updateCountdown();
        countdownInterval.current = setInterval(updateCountdown, 100);
    }, []);

    // Send message
    const send = useCallback((message: any) => {
        if (ws.current?.readyState === WebSocket.OPEN) {
            try {
                ws.current.send(JSON.stringify(message));
            } catch (error) {
                console.error('[usePurgeMP] Send error:', error);
            }
        }
    }, []);

    // Batch updates
    const startBatching = useCallback(() => {
        stopBatching();
        batchInterval.current = setInterval(() => {
            if (updateQueue.current.length > 0 && ws.current?.readyState === WebSocket.OPEN) {
                const latestState = updateQueue.current[updateQueue.current.length - 1];
                send({
                    type: 'player:update',
                    state: latestState
                });
                updateQueue.current = [];
            }
        }, 50); // 20 updates/sec
    }, [send]);

    const stopBatching = useCallback(() => {
        if (batchInterval.current) {
            clearInterval(batchInterval.current);
            batchInterval.current = null;
        }
        updateQueue.current = [];
    }, []);

    // Heartbeat
    const startHeartbeat = useCallback(() => {
        stopHeartbeat();
        heartbeatInterval.current = setInterval(() => {
            if (ws.current?.readyState === WebSocket.OPEN) {
                pingTime.current = Date.now();
                send({ type: 'ping' });
            }
        }, 20000);
    }, [send]);

    const stopHeartbeat = useCallback(() => {
        if (heartbeatInterval.current) {
            clearInterval(heartbeatInterval.current);
            heartbeatInterval.current = null;
        }
    }, []);

    // Reconnect
    const attemptReconnect = useCallback(() => {
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 10000);
        console.log(`[usePurgeMP] Reconnecting in ${delay}ms...`);

        setReconnecting(true);
        reconnectAttempts.current++;

        reconnectTimeout.current = setTimeout(() => {
            connect();
        }, delay);
    }, [connect]);

    // Interpolation
    const interpolatePlayerPositions = useCallback(() => {
        const now = Date.now();
        const delta = now - lastInterpolationTime.current;
        lastInterpolationTime.current = now;

        if (delta > 100) return;

        setPlayers(prev => {
            const updated: PlayerMap = { ...prev };
            let hasChanges = false;

            interpolationTargets.current.forEach((target, id) => {
                if (id === playerId) return;

                const current = updated[id];
                if (!current || current.eliminated) return;

                const lerpFactor = Math.min(delta / 100, 1);

                if (target.x !== undefined && target.y !== undefined) {
                    const newX = current.x + (target.x - current.x) * lerpFactor;
                    const newY = current.y + (target.y - current.y) * lerpFactor;

                    if (Math.abs(newX - current.x) > 0.1 || Math.abs(newY - current.y) > 0.1) {
                        updated[id] = {
                            ...current,
                            x: newX,
                            y: newY
                        };
                        hasChanges = true;
                    }
                }
            });

            return hasChanges ? updated : prev;
        });
    }, [playerId]);

    // Initialize connection
    useEffect(() => {
        if (!enabled || !gameId || !playerId) return;

        connect();

        // Interpolation loop
        const interpolationLoop = setInterval(() => {
            interpolatePlayerPositions();
        }, 16);

        return () => {
            clearInterval(interpolationLoop);
            if (countdownInterval.current) clearInterval(countdownInterval.current);
            if (heartbeatInterval.current) clearInterval(heartbeatInterval.current);
            if (batchInterval.current) clearInterval(batchInterval.current);
            if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
            if (ws.current) {
                ws.current.close();
                ws.current = null;
            }
        };
    }, [enabled, gameId, playerId, connect, interpolatePlayerPositions]);

    // Public API
    const sendUpdate = useCallback((state: Partial<PlayerState>) => {
        if (!connected) return;

        const now = Date.now();
        const timeSinceLastUpdate = now - lastUpdateTime.current;
        const minInterval = connectionQuality === 'good' ? 16 :
            connectionQuality === 'fair' ? 33 : 50;

        if (timeSinceLastUpdate < minInterval) return;

        lastUpdateTime.current = now;

        // Update local state immediately (client-side prediction)
        setPlayers(prev => ({
            ...prev,
            [playerId]: { ...prev[playerId], ...state }
        }));

        // Queue for sending
        updateQueue.current.push({
            ...state,
            lastUpdate: now
        });
    }, [connected, playerId, connectionQuality]);

    const sendReady = useCallback(() => {
        console.log('[usePurgeMP] 🎯 Sending ready');
        send({ type: 'player:ready' });

        // Update local state
        setPlayers(prev => ({
            ...prev,
            [playerId]: { ...prev[playerId], ready: true }
        }));
    }, [send, playerId]);

    const sendEliminated = useCallback(() => {
        console.log('[usePurgeMP] 💀 Sending eliminated');
        send({ type: 'player:eliminated' });
    }, [send]);

    const requestSync = useCallback(() => {
        console.log('[usePurgeMP] 🔄 Requesting sync');
        send({ type: 'request_sync' });
    }, [send]);

    const getStats = useCallback(() => {
        return {
            connected,
            gameId,
            playerId: playerId.slice(0, 8),
            latency: latency.current,
            connectionQuality,
            gamePhase,
            playerCount: Object.keys(players).length
        };
    }, [connected, gameId, playerId, connectionQuality, gamePhase, players]);

    // Computed values
    const playersArray = Object.values(players);
    const activePlayers = playersArray.filter(p => !p.eliminated);
    const readyPlayers = playersArray.filter(p => p.ready);
    const totalPlayers = playersArray.length;
    const readyCount = readyPlayers.length;

    return {
        // Connection
        connected,
        reconnecting,
        connectionQuality,

        // Game state
        gamePhase,
        countdown,
        safeZone,

        // Players
        players,
        playersArray,
        activePlayers,
        readyPlayers,
        totalPlayers,
        readyCount,

        // Actions
        sendUpdate,
        sendReady,
        sendEliminated,
        requestSync,
        getStats,
    };
}