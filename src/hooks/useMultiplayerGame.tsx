// src/hooks/useMultiplayerGame.tsx - Enhanced Multiplayer Hook with Server-Driven Sync

import { useEffect, useRef, useState } from 'react';
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

const UPDATE_THROTTLE = 50;

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
    const [otherPlayers, setOtherPlayers] = useState<Map<string, PlayerState>>(new Map());
    const [gamePhase, setGamePhase] = useState<'waiting' | 'countdown' | 'active' | 'ended'>('waiting');
    const lastUpdateTimeRef = useRef<number>(0);
    const handlerIdRef = useRef<string>(`handler-${Date.now()}-${Math.random()}`);

    useEffect(() => {
        if (!enabled || !wallet.publicKey) {
            return;
        }

        const playerId = wallet.publicKey.toBase58();
        const handlersId = handlerIdRef.current;

        console.log('[Hook] Registering multiplayer handlers');

        wsManager.connect(gameId, playerId, handlersId, {
            onConnected: () => {
                console.log('[Hook] Connected');
                setIsConnected(true);
            },
            onDisconnected: () => {
                console.log('[Hook] Disconnected');
                setIsConnected(false);
            },
            onSync: (players) => {
                const playersMap = new Map<string, PlayerState>();
                players.forEach(p => {
                    if (p.id !== playerId) {
                        playersMap.set(p.id, p);
                    }
                });
                setOtherPlayers(playersMap);
                console.log('[Hook] Synced players:', players.length);
            },
            onUpdate: (id, state) => {
                setOtherPlayers(prev => {
                    const updated = new Map(prev);
                    updated.set(id, state);
                    return updated;
                });
                onPlayerUpdate?.(id, state);
            },
            onEliminated: (id) => {
                setOtherPlayers(prev => {
                    const updated = new Map(prev);
                    const player = updated.get(id);
                    if (player) {
                        updated.set(id, { ...player, alive: false });
                    }
                    return updated;
                });
                onPlayerEliminated?.(id);
            },
            onWinner: (winnerId) => {
                console.log('[Hook] Winner:', winnerId);
                onWinnerDeclared?.(winnerId);
            },
            onPlayerConnected: (id) => {
                console.log('[Hook] Player joined:', id.slice(0, 8));
            },
            onPlayerDisconnected: (id) => {
                setOtherPlayers(prev => {
                    const updated = new Map(prev);
                    updated.delete(id);
                    return updated;
                });
                console.log('[Hook] Player left:', id.slice(0, 8));
            },
            onGamePhaseChange: (phase) => {
                console.log('[Hook] Game phase:', phase);
                setGamePhase(phase);
                onGamePhaseChange?.(phase);
            },
            onCountdownSync: (startTime, duration) => {
                console.log('[Hook] Countdown sync:', { startTime, duration });
                onCountdownSync?.(startTime, duration);
            }
        });

        return () => {
            console.log('[Hook] Unregistering handlers');
            wsManager.unregisterHandler(handlersId);
        };
    }, [gameId, enabled, wallet.publicKey, onPlayerUpdate, onPlayerEliminated, onWinnerDeclared, onGamePhaseChange, onCountdownSync]);

    const sendUpdate = (state: PlayerState) => {
        if (!wsManager.isConnected()) return;

        const now = Date.now();
        if (now - lastUpdateTimeRef.current >= UPDATE_THROTTLE) {
            wsManager.send({ type: 'update', data: state });
            lastUpdateTimeRef.current = now;
        }
    };

    const sendEliminated = () => {
        if (wsManager.isConnected()) {
            wsManager.send({ type: 'eliminated' });
            console.log('[Hook] Sent elimination');
        }
    };

    const sendWinner = (winnerId: string) => {
        if (wsManager.isConnected()) {
            wsManager.send({ type: 'winner', winnerId });
            console.log('[Hook] Sent winner:', winnerId.slice(0, 8));
        }
    };

    return {
        isConnected,
        otherPlayers,
        gamePhase,
        sendUpdate,
        sendEliminated,
        sendWinner
    };
};