// src/hooks/useMultiplayerGame.tsx - WITH GAME ENDED HANDLING
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { PlayerState } from '@/types';
import { wsManager } from '@/utils/websocketManager';

interface UseMultiplayerGameOptions {
    gameId: string;
    enabled: boolean;
    onPlayerUpdate?: (id: string, state: PlayerState) => void;
    onPlayerEliminated?: (id: string) => void;
    onWinnerDeclared?: (winnerId: string, prizeAmount: number) => void; // ✅ ADDED prizeAmount
    onGamePhaseChange?: (phase: 'waiting' | 'countdown' | 'active' | 'ended') => void;
    onCountdownSync?: (startTime: number, duration: number) => void;
    onReadyPlayersUpdate?: (readyPlayers: string[]) => void;
    onGameStateSync?: (gameTime: number, safeZoneRadius: number) => void;
    onGameEnded?: () => void; // ✅ NEW: When game is permanently ended
}

const UPDATE_THROTTLE = 50;
const DEV_MODE = process.env.NODE_ENV === 'development';

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
    onCountdownSync,
    onReadyPlayersUpdate,
    onGameStateSync,
    onGameEnded // ✅ NEW
}: UseMultiplayerGameOptions) => {
    const wallet = useWallet();
    const [isConnected, setIsConnected] = useState(false);
    const [gamePhase, setGamePhase] = useState<'waiting' | 'countdown' | 'active' | 'ended'>('waiting');
    const [readyPlayers, setReadyPlayers] = useState<string[]>([]);
    const [isGameEnded, setIsGameEnded] = useState(false); // ✅ NEW: Track if game is permanently ended

    const otherPlayersRef = useRef<Map<string, PlayerState>>(new Map());
    const [updateTrigger, setUpdateTrigger] = useState(0);

    const lastUpdateTimeRef = useRef<number>(0);
    const handlerIdRef = useRef<string>(`h${Date.now()}${Math.random().toString(36).slice(2, 7)}`);

    const updateQueueRef = useRef<Array<{ id: string; state: PlayerState }>>([]);
    const batchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const playerId = useMemo(() =>
        wallet.publicKey?.toBase58() || '',
        [wallet.publicKey]
    );

    const processBatchedUpdates = useCallback(() => {
        if (updateQueueRef.current.length === 0) return;

        const updates = updateQueueRef.current;
        updateQueueRef.current = [];

        updates.forEach(({ id, state }) => {
            otherPlayersRef.current.set(id, state);
        });

        setUpdateTrigger(prev => prev + 1);
    }, []);

    const handlePlayerUpdate = useCallback((id: string, state: PlayerState) => {
        // ✅ Block updates if game has ended
        if (isGameEnded) {
            log('[Hook] Ignoring update - game has ended');
            return;
        }

        updateQueueRef.current.push({ id, state });

        if (batchTimeoutRef.current) {
            clearTimeout(batchTimeoutRef.current);
        }

        batchTimeoutRef.current = setTimeout(processBatchedUpdates, 5);

        onPlayerUpdate?.(id, state);
    }, [onPlayerUpdate, processBatchedUpdates, isGameEnded]);

    const handleSync = useCallback((players: PlayerState[], serverReadyPlayers?: string[]) => {
        const playersMap = new Map<string, PlayerState>();

        players.forEach(p => {
            if (p.id !== playerId) {
                playersMap.set(p.id, p);
            }
        });

        otherPlayersRef.current = playersMap;
        setUpdateTrigger(prev => prev + 1);

        if (serverReadyPlayers) {
            setReadyPlayers(serverReadyPlayers);
            onReadyPlayersUpdate?.(serverReadyPlayers);
        }

        log('[Hook] Synced players:', players.length);
    }, [playerId, onReadyPlayersUpdate]);

    const handleElimination = useCallback((id: string) => {
        const player = otherPlayersRef.current.get(id);
        if (player) {
            otherPlayersRef.current.set(id, { ...player, alive: false });
            setUpdateTrigger(prev => prev + 1);
        }
        onPlayerEliminated?.(id);
    }, [onPlayerEliminated]);

    // ✅ UPDATED: Handle winner with prize amount
    const handleWinner = useCallback((winnerId: string, prizeAmount?: number) => {
        log('[Hook] 🏆 Winner declared:', winnerId.slice(0, 8), 'Prize:', prizeAmount);
        onWinnerDeclared?.(winnerId, prizeAmount || 0);
    }, [onWinnerDeclared]);

    const handlePlayerDisconnected = useCallback((id: string) => {
        log('[Hook] Player disconnected (kept in game):', id.slice(0, 8));
        setUpdateTrigger(prev => prev + 1);
    }, []);

    const handlePlayerConnected = useCallback((id: string) => {
        log('[Hook] Player joined:', id.slice(0, 8));
    }, []);

    const handleGamePhaseChange = useCallback((phase: 'waiting' | 'countdown' | 'active' | 'ended') => {
        log('[Hook] Game phase:', phase);
        setGamePhase(phase);

        // ✅ If phase is 'ended', mark game as permanently ended
        if (phase === 'ended') {
            setIsGameEnded(true);
            onGameEnded?.();
        }

        onGamePhaseChange?.(phase);
    }, [onGamePhaseChange, onGameEnded]);

    const handleCountdownSync = useCallback((startTime: number, duration: number) => {
        log('[Hook] Countdown sync:', { startTime, duration });
        onCountdownSync?.(startTime, duration);
    }, [onCountdownSync]);

    const handleReadyPlayersUpdate = useCallback((serverReadyPlayers: string[]) => {
        log('[Hook] Ready players update:', serverReadyPlayers.length);
        setReadyPlayers(serverReadyPlayers);
        onReadyPlayersUpdate?.(serverReadyPlayers);
    }, [onReadyPlayersUpdate]);

    const handleGameStateSync = useCallback((gameTime: number, safeZoneRadius: number, alivePlayers: number) => {
        onGameStateSync?.(gameTime, safeZoneRadius);
    }, [onGameStateSync]);

    // ✅ NEW: Handle game ended from server
    const handleGameEnded = useCallback(() => {
        log('[Hook] 🛑 Game permanently ended by server');
        setIsGameEnded(true);
        setGamePhase('ended');
        onGameEnded?.();
    }, [onGameEnded]);

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
            onSync: (players: PlayerState[], readyPlayersFromServer?: string[]) => {
                handleSync(players, readyPlayersFromServer);
            },
            onUpdate: handlePlayerUpdate,
            onEliminated: handleElimination,
            onWinner: handleWinner,
            onPlayerConnected: handlePlayerConnected,
            onPlayerDisconnected: handlePlayerDisconnected,
            onGamePhaseChange: handleGamePhaseChange,
            onCountdownSync: handleCountdownSync,
            onReadyPlayersUpdate: handleReadyPlayersUpdate,
            onGameStateSync: handleGameStateSync,
            onGameEnded: handleGameEnded // ✅ NEW
        });

        return () => {
            log('[Hook] Unregistering handlers');
            wsManager.unregisterHandler(handlersId);

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
        handlePlayerConnected,
        handlePlayerDisconnected,
        handleGamePhaseChange,
        handleCountdownSync,
        handleReadyPlayersUpdate,
        handleGameStateSync,
        handleGameEnded // ✅ NEW
    ]);

    const sendUpdate = useCallback((state: PlayerState) => {
        // ✅ Block sending updates if game has ended
        if (!wsManager.isConnected() || isGameEnded) return;

        const now = performance.now();
        if (now - lastUpdateTimeRef.current >= UPDATE_THROTTLE) {
            requestAnimationFrame(() => {
                wsManager.send({ type: 'update', data: state });
            });
            lastUpdateTimeRef.current = now;
        }
    }, [isGameEnded]);

    const sendEliminated = useCallback(() => {
        if (wsManager.isConnected() && !isGameEnded) {
            wsManager.send({ type: 'eliminated' });
            log('[Hook] Sent elimination');
        }
    }, [isGameEnded]);

    const sendWinner = useCallback((winnerId: string) => {
        if (wsManager.isConnected() && !isGameEnded) {
            wsManager.send({ type: 'winner', winnerId });
            log('[Hook] Sent winner:', winnerId.slice(0, 8));
        }
    }, [isGameEnded]);

    const sendMarkReady = useCallback(() => {
        if (wsManager.isConnected() && !isGameEnded) {
            wsManager.send({ type: 'mark_ready' });
            log('[Hook] Sent mark ready');
        }
    }, [isGameEnded]);

    const otherPlayers = useMemo(() => {
        return otherPlayersRef.current;
    }, [updateTrigger]);

    return {
        isConnected,
        otherPlayers,
        gamePhase,
        sendUpdate,
        sendEliminated,
        sendWinner,
        readyPlayers,
        sendMarkReady,
        isGameEnded // ✅ NEW: Expose game ended state
    };
};