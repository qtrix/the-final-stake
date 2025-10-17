// src/hooks/useMultiplayerGame.tsx - ULTRA OPTIMIZED for Zero Lag

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { PlayerState } from '@/types';
import { wsManager } from '@/utils/websocketManager';

interface UseMultiplayerGameOptions {
    gameId: number;
    enabled: boolean;
    onPlayerUpdate?: (playerId: string, state: PlayerState) => void;
    onPlayerEliminated?: (playerId: string) => void;
    onWinnerDeclared?: (winnerId: string) => void;
    onGamePhaseChange?: (phase: 'waiting' | 'countdown' | 'active' | 'ended') => void;
    onCountdownSync?: (startTime: number, duration: number) => void;
}

// ✅ OPTIMIZATION: Reduce throttle to 16ms (60fps)
const UPDATE_THROTTLE = 16;
const DEV_MODE = process.env.NODE_ENV === 'development';

// ✅ OPTIMIZATION: Conditional logging only in dev mode
const log = (...args: any[]) => {
    if (DEV_MODE) console.log(...args);
};

export const useMultiplayerGame = ({
    gameId,
    enabled,
    onPlayerUpdate,
    onPlayerEliminated,
    onWinnerDeclared,
    onGamePhaseChange,
    onCountdownSync
}: UseMultiplayerGameOptions) => {
    const wallet = useWallet();
    const [isConnected, setIsConnected] = useState(false);
    const [gamePhase, setGamePhase] = useState<'waiting' | 'countdown' | 'active' | 'ended'>('waiting');

    // ✅ OPTIMIZATION: Use ref for otherPlayers to avoid re-renders
    const otherPlayersRef = useRef<Map<string, PlayerState>>(new Map());
    const [, forceUpdate] = useState({});

    const lastUpdateTimeRef = useRef<number>(0);
    const handlerIdRef = useRef<string>(`h${Date.now()}${Math.random().toString(36).slice(2, 7)}`);

    // ✅ OPTIMIZATION: Batch updates queue
    const updateQueueRef = useRef<Array<{ id: string; state: PlayerState }>>([]);
    const batchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // ✅ OPTIMIZATION: Memoized player ID
    const playerId = useMemo(() =>
        wallet.publicKey?.toBase58() || '',
        [wallet.publicKey]
    );

    // ✅ OPTIMIZATION: Batched update processor
    const processBatchedUpdates = useCallback(() => {
        if (updateQueueRef.current.length === 0) return;

        const updates = updateQueueRef.current;
        updateQueueRef.current = [];

        // Process all updates at once
        updates.forEach(({ id, state }) => {
            otherPlayersRef.current.set(id, state);
        });

        // Single re-render for all updates
        forceUpdate({});

        log('[Hook] Processed batch:', updates.length, 'updates');
    }, []);

    // ✅ OPTIMIZATION: Efficient player update handler
    const handlePlayerUpdate = useCallback((id: string, state: PlayerState) => {
        // Add to batch queue
        updateQueueRef.current.push({ id, state });

        // Schedule batch processing
        if (batchTimeoutRef.current) {
            clearTimeout(batchTimeoutRef.current);
        }

        batchTimeoutRef.current = setTimeout(processBatchedUpdates, 5); // 5ms batch window

        // Call callback if provided
        onPlayerUpdate?.(id, state);
    }, [onPlayerUpdate, processBatchedUpdates]);

    // ✅ OPTIMIZATION: Memoized sync handler
    const handleSync = useCallback((players: PlayerState[]) => {
        const playersMap = new Map<string, PlayerState>();

        players.forEach(p => {
            if (p.id !== playerId) {
                playersMap.set(p.id, p);
            }
        });

        otherPlayersRef.current = playersMap;
        forceUpdate({});
        log('[Hook] Synced players:', players.length);
    }, [playerId]);

    // ✅ OPTIMIZATION: Efficient elimination handler
    const handleElimination = useCallback((id: string) => {
        const player = otherPlayersRef.current.get(id);
        if (player) {
            otherPlayersRef.current.set(id, { ...player, alive: false });
            forceUpdate({});
        }
        onPlayerEliminated?.(id);
        log('[Hook] Player eliminated:', id.slice(0, 8));
    }, [onPlayerEliminated]);

    // ✅ OPTIMIZATION: Memoized winner handler
    const handleWinner = useCallback((winnerId: string) => {
        log('[Hook] Winner:', winnerId.slice(0, 8));
        onWinnerDeclared?.(winnerId);
    }, [onWinnerDeclared]);

    // ✅ OPTIMIZATION: Efficient disconnection handler
    const handlePlayerDisconnected = useCallback((id: string) => {
        otherPlayersRef.current.delete(id);
        forceUpdate({});
        log('[Hook] Player left:', id.slice(0, 8));
    }, []);

    // ✅ OPTIMIZATION: Memoized phase change handler
    const handleGamePhaseChange = useCallback((phase: 'waiting' | 'countdown' | 'active' | 'ended') => {
        log('[Hook] Game phase:', phase);
        setGamePhase(phase);
        onGamePhaseChange?.(phase);
    }, [onGamePhaseChange]);

    // ✅ OPTIMIZATION: Memoized countdown sync handler
    const handleCountdownSync = useCallback((startTime: number, duration: number) => {
        log('[Hook] Countdown sync:', { startTime, duration });
        onCountdownSync?.(startTime, duration);
    }, [onCountdownSync]);

    // ✅ WebSocket handlers setup
    useEffect(() => {
        if (!enabled || !playerId) {
            return;
        }

        const handlersId = handlerIdRef.current;
        log('[Hook] Registering multiplayer handlers');

        wsManager.connect(gameId, playerId, handlersId, {
            onConnected: () => {
                log('[Hook] Connected');
                setIsConnected(true);
            },
            onDisconnected: () => {
                log('[Hook] Disconnected');
                setIsConnected(false);
            },
            onSync: handleSync,
            onUpdate: handlePlayerUpdate,
            onEliminated: handleElimination,
            onWinner: handleWinner,
            onPlayerConnected: (id) => {
                log('[Hook] Player joined:', id.slice(0, 8));
            },
            onPlayerDisconnected: handlePlayerDisconnected,
            onGamePhaseChange: handleGamePhaseChange,
            onCountdownSync: handleCountdownSync
        });

        return () => {
            log('[Hook] Unregistering handlers');
            wsManager.unregisterHandler(handlersId);

            // Cleanup batch timeout
            if (batchTimeoutRef.current) {
                clearTimeout(batchTimeoutRef.current);
            }
        };
    }, [
        gameId,
        enabled,
        playerId,
        handleSync,
        handlePlayerUpdate,
        handleElimination,
        handleWinner,
        handlePlayerDisconnected,
        handleGamePhaseChange,
        handleCountdownSync
    ]);

    // ✅ OPTIMIZATION: Throttled send with RAF for smoothest updates
    const sendUpdate = useCallback((state: PlayerState) => {
        if (!wsManager.isConnected()) return;

        const now = performance.now();
        if (now - lastUpdateTimeRef.current >= UPDATE_THROTTLE) {
            requestAnimationFrame(() => {
                wsManager.send({ type: 'update', data: state });
            });
            lastUpdateTimeRef.current = now;
        }
    }, []);

    // ✅ OPTIMIZATION: Immediate send for critical events
    const sendEliminated = useCallback(() => {
        if (wsManager.isConnected()) {
            wsManager.send({ type: 'eliminated' });
            log('[Hook] Sent elimination');
        }
    }, []);

    // ✅ OPTIMIZATION: Immediate send for winner
    const sendWinner = useCallback((winnerId: string) => {
        if (wsManager.isConnected()) {
            wsManager.send({ type: 'winner', winnerId });
            log('[Hook] Sent winner:', winnerId.slice(0, 8));
        }
    }, []);

    // ✅ OPTIMIZATION: Return stable Map reference
    const otherPlayers = useMemo(() =>
        otherPlayersRef.current,
        [otherPlayersRef.current.size]
    );

    return {
        isConnected,
        otherPlayers,
        gamePhase,
        sendUpdate,
        sendEliminated,
        sendWinner
    };
};