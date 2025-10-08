import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { PublicKey } from '@solana/web3.js';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:8081';

interface UseGameSocketProps {
    challengeId: string;
    playerAddress: PublicKey;
    isChallenger: boolean;
    gameType: string;
    onOpponentMove?: (move: any, moveType: string, roundNumber?: number) => void;
    onOpponentReady?: () => void;
    onOpponentDisconnected?: () => void;
    onGameResult?: (data: { winner: string; loser: string; finalScores?: any }) => void;
    onRoundComplete?: (data: { moves: any; roundNumber?: number; moveType: string }) => void;
    onBothPlayersConnected?: () => void;
}

export function useGameSocket({
    challengeId,
    playerAddress,
    isChallenger,
    gameType,
    onOpponentMove,
    onOpponentReady,
    onOpponentDisconnected,
    onGameResult,
    onRoundComplete,
    onBothPlayersConnected,
}: UseGameSocketProps) {
    const socketRef = useRef<Socket | null>(null);
    const [connected, setConnected] = useState(false);
    const [opponentConnected, setOpponentConnected] = useState(false);
    const reconnectAttempts = useRef(0);
    const maxReconnectAttempts = 5;

    useEffect(() => {
        const socket = io(SOCKET_URL, {
            transports: ['websocket', 'polling'],
            reconnectionAttempts: maxReconnectAttempts,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            timeout: 10000,
        });

        socketRef.current = socket;

        socket.on('connect', () => {
            console.log('✅ Connected to game server');
            setConnected(true);
            reconnectAttempts.current = 0;

            socket.emit('join_game', {
                challengeId,
                playerAddress: playerAddress.toBase58(),
                role: isChallenger ? 'challenger' : 'opponent',
                gameType,
            });
        });

        socket.on('disconnect', (reason) => {
            console.log('❌ Disconnected from game server:', reason);
            setConnected(false);

            if (reason === 'io server disconnect') {
                socket.connect();
            }
        });

        socket.on('connect_error', (error) => {
            console.error('Connection error:', error);
            reconnectAttempts.current++;
            setConnected(false);
        });

        socket.on('reconnect_attempt', (attemptNumber) => {
            console.log(`🔄 Reconnection attempt ${attemptNumber}/${maxReconnectAttempts}`);
        });

        socket.on('reconnect_failed', () => {
            console.error('❌ Failed to reconnect after maximum attempts');
        });

        socket.on('player_joined', ({ playerAddress: joinedPlayer }) => {
            console.log('👥 Player joined:', joinedPlayer);
            setOpponentConnected(true);
        });

        socket.on('both_players_connected', () => {
            console.log('✅ Both players connected');
            setOpponentConnected(true);
            onBothPlayersConnected?.();
        });

        socket.on('opponent_move', ({ playerAddress: movedPlayer, move, moveType, roundNumber }) => {
            console.log('🎯 Opponent move:', { movedPlayer, move, moveType, roundNumber });
            onOpponentMove?.(move, moveType, roundNumber);
        });

        socket.on('round_complete', (data) => {
            console.log('🔄 Round complete:', data);
            onRoundComplete?.(data);
        });

        socket.on('opponent_ready', ({ playerAddress: readyPlayer }) => {
            console.log('✅ Opponent ready:', readyPlayer);
            onOpponentReady?.();
        });

        socket.on('opponent_disconnected', ({ playerAddress: disconnectedPlayer }) => {
            console.log('❌ Opponent disconnected:', disconnectedPlayer);
            setOpponentConnected(false);
            onOpponentDisconnected?.();
        });

        socket.on('game_result', (data) => {
            console.log('🏆 Game result:', data);
            onGameResult?.(data);
        });

        socket.on('game_state_updated', (state) => {
            console.log('📊 Game state updated:', state);
        });

        socket.on('pong_response', () => {
            console.log('🏓 Pong received from opponent');
            setOpponentConnected(true);
        });

        return () => {
            socket.disconnect();
        };
    }, [challengeId, playerAddress.toBase58(), isChallenger, gameType]);

    const sendMove = useCallback((move: any, moveType: string, roundNumber?: number) => {
        if (!socketRef.current?.connected) {
            console.error('❌ Socket not connected, cannot send move');
            return false;
        }

        socketRef.current.emit('player_move', {
            challengeId,
            playerAddress: playerAddress.toBase58(),
            move,
            moveType,
            roundNumber,
        });

        return true;
    }, [challengeId, playerAddress]);

    const updateGameState = useCallback((state: any) => {
        if (!socketRef.current?.connected) {
            console.error('❌ Socket not connected');
            return false;
        }

        socketRef.current.emit('update_game_state', {
            challengeId,
            state,
        });

        return true;
    }, [challengeId]);

    const notifyReady = useCallback(() => {
        if (!socketRef.current?.connected) {
            console.error('❌ Socket not connected');
            return false;
        }

        socketRef.current.emit('player_ready', {
            challengeId,
            playerAddress: playerAddress.toBase58(),
        });

        return true;
    }, [challengeId, playerAddress]);

    const endGame = useCallback((winner: PublicKey, loser: PublicKey, finalScores?: any) => {
        if (!socketRef.current?.connected) {
            console.error('❌ Socket not connected');
            return false;
        }

        socketRef.current.emit('game_ended', {
            challengeId,
            winner: winner.toBase58(),
            loser: loser.toBase58(),
            finalScores,
        });

        return true;
    }, [challengeId]);

    const pingOpponent = useCallback(() => {
        if (!socketRef.current?.connected) {
            return false;
        }

        socketRef.current.emit('ping_opponent', { challengeId });
        return true;
    }, [challengeId]);

    return {
        connected,
        opponentConnected,
        sendMove,
        updateGameState,
        notifyReady,
        endGame,
        pingOpponent,
    };
}