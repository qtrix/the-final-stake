// src/lib/battleHandler.ts - FIXED Battle Handler using Socket.IO

import { PublicKey } from '@solana/web3.js';
import { io, Socket } from 'socket.io-client';
import { rpsEngine, type RPSGameState, type RPSMove } from './gameEngines/rockPaperScissors';

const PHASE2_WS_URL = import.meta.env.VITE_PHASE2_WS_URL || 'wss://solana-survivor-pvp-server-production.up.railway.app';

export type BattleStatus = 'connecting' | 'waiting_for_opponent' | 'in_progress' | 'timeout' | 'completed' | 'error';

export interface BattleState {
    challengeId: string;
    playerAddress: PublicKey;
    opponentAddress: PublicKey;
    betAmount: number;
    gameState: RPSGameState;
    battleStatus: BattleStatus;
    playerMove: RPSMove;
    opponentMove: RPSMove;
    moveSubmittedAt: number | null;
    roundTimeLimit: number;
    error: string | null;
    waitingForOpponent: boolean;
    opponentConnected: boolean;
}

export class BattleHandler {
    private state: BattleState;
    private timeoutTimer: NodeJS.Timeout | null = null;
    private onStateChange?: (state: BattleState) => void;
    private onTimeout?: () => void;
    private onGameEnd?: (winner: PublicKey) => void;
    private socket: Socket | null = null;

    constructor(
        challengeId: string,
        playerAddress: PublicKey,
        opponentAddress: PublicKey,
        betAmount: number,
        roundTimeLimit: number = 30
    ) {
        this.state = {
            challengeId,
            playerAddress,
            opponentAddress,
            betAmount,
            gameState: rpsEngine.createInitialState(),
            battleStatus: 'connecting',
            playerMove: null,
            opponentMove: null,
            moveSubmittedAt: null,
            roundTimeLimit,
            error: null,
            waitingForOpponent: false,
            opponentConnected: false,
        };
    }

    onUpdate(callback: (state: BattleState) => void) {
        this.onStateChange = callback;
    }

    onTimeoutEvent(callback: () => void) {
        this.onTimeout = callback;
    }

    onGameEndEvent(callback: (winner: PublicKey) => void) {
        this.onGameEnd = callback;
    }

    getState(): BattleState {
        return { ...this.state };
    }

    startBattle() {
        console.log('🎮 [Battle] Connecting to Phase 2 server:', PHASE2_WS_URL);

        this.socket = io(PHASE2_WS_URL, {
            transports: ['websocket', 'polling'],
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
        });

        this.socket.on('connect', () => {
            console.log('✅ [Battle] Connected to server');
            this.state.battleStatus = 'waiting_for_opponent';
            this.notifyStateChange();

            // Join game room
            this.socket!.emit('join_game', {
                challengeId: this.state.challengeId,
                playerAddress: this.state.playerAddress.toBase58(),
            });
        });

        this.socket.on('player_joined', (data) => {
            console.log('👤 [Battle] Player joined:', data.playersCount, 'players');
            if (data.playersCount === 1) {
                this.state.battleStatus = 'waiting_for_opponent';
            } else if (data.playersCount === 2) {
                this.state.opponentConnected = true;
            }
            this.notifyStateChange();
        });

        this.socket.on('game_ready', (data) => {
            console.log('✅ [Battle] Game ready! Both players connected');
            this.state.battleStatus = 'in_progress';
            this.state.gameState.gameStatus = 'playing';
            this.state.opponentConnected = true;
            this.notifyStateChange();
            this.startRoundTimer();
        });

        this.socket.on('opponent_moved', (data) => {
            console.log('🤖 [Battle] Opponent moved');
            this.notifyStateChange();
        });

        this.socket.on('round_complete', (data) => {
            console.log('🎲 [Battle] Round complete:', data);

            const opponentMoveData = data.moves.find(
                (m: any) => m.playerAddress !== this.state.playerAddress.toBase58()
            );

            if (opponentMoveData) {
                this.receiveOpponentMove(opponentMoveData.move as RPSMove);
            }
        });

        this.socket.on('game_ended', (data) => {
            console.log('🏆 [Battle] Game ended');
        });

        this.socket.on('opponent_left', (data) => {
            console.log('👋 [Battle] Opponent disconnected');
            this.forceEnd('player', 'Opponent disconnected');
        });

        this.socket.on('disconnect', () => {
            console.log('❌ [Battle] Disconnected from server');
            this.state.battleStatus = 'error';
            this.state.error = 'Connection lost';
            this.notifyStateChange();
        });

        this.socket.on('connect_error', (error) => {
            console.error('❌ [Battle] Connection error:', error);
            this.state.battleStatus = 'error';
            this.state.error = 'Connection error';
            this.notifyStateChange();
        });
    }

    submitMove(move: RPSMove) {
        if (!rpsEngine.isValidMove(move)) {
            throw new Error('Invalid move');
        }

        if (this.state.playerMove !== null) {
            throw new Error('Move already submitted');
        }

        if (this.state.battleStatus !== 'in_progress') {
            throw new Error('Battle not in progress');
        }

        if (!this.socket?.connected) {
            throw new Error('Not connected to server');
        }

        this.state.playerMove = move;
        this.state.moveSubmittedAt = Date.now();
        this.state.waitingForOpponent = true;

        try {
            this.socket.emit('submit_move', {
                challengeId: this.state.challengeId,
                playerAddress: this.state.playerAddress.toBase58(),
                move,
                round: this.state.gameState.currentRound,
            });

            console.log(`✋ [Battle] Move submitted: ${move}`);
            this.notifyStateChange();
        } catch (error) {
            console.error('Failed to submit move:', error);
            this.state.error = 'Failed to submit move';
            this.state.waitingForOpponent = false;
            this.notifyStateChange();
        }
    }

    private receiveOpponentMove(move: RPSMove) {
        if (!rpsEngine.isValidMove(move)) {
            console.error('Invalid opponent move:', move);
            return;
        }

        this.state.opponentMove = move;
        this.state.waitingForOpponent = false;
        console.log(`🤖 [Battle] Opponent move: ${move}`);

        this.notifyStateChange();

        if (this.state.playerMove && this.state.opponentMove) {
            setTimeout(() => {
                this.processRound();
            }, 1500);
        }
    }

    private processRound() {
        if (!this.state.playerMove || !this.state.opponentMove) {
            throw new Error('Both players must submit moves');
        }

        this.stopRoundTimer();

        const newGameState = rpsEngine.processRound(
            this.state.gameState,
            this.state.playerMove,
            this.state.opponentMove
        );

        this.state.gameState = newGameState;
        this.state.playerMove = null;
        this.state.opponentMove = null;
        this.state.moveSubmittedAt = null;

        console.log(`📊 [Battle] Round ${newGameState.currentRound - 1} processed`);

        this.notifyStateChange();

        if (newGameState.gameStatus === 'finished') {
            this.endBattle();
        } else {
            this.startRoundTimer();
        }
    }

    private startRoundTimer() {
        this.stopRoundTimer();

        this.timeoutTimer = setTimeout(() => {
            console.warn('⏰ [Battle] Round timeout!');
            this.handleTimeout();
        }, this.state.roundTimeLimit * 1000);
    }

    private stopRoundTimer() {
        if (this.timeoutTimer) {
            clearTimeout(this.timeoutTimer);
            this.timeoutTimer = null;
        }
    }

    private handleTimeout() {
        console.log('⏰ [Battle] Timeout triggered');

        if (!this.state.playerMove) {
            const randomMove = rpsEngine.generateRandomMove();
            this.state.playerMove = randomMove;

            if (this.socket?.connected) {
                this.socket.emit('submit_move', {
                    challengeId: this.state.challengeId,
                    playerAddress: this.state.playerAddress.toBase58(),
                    move: randomMove,
                    round: this.state.gameState.currentRound,
                });
            }
        }

        this.state.battleStatus = 'timeout';
        this.notifyStateChange();

        if (this.onTimeout) {
            this.onTimeout();
        }
    }

    private endBattle() {
        this.stopRoundTimer();
        this.state.battleStatus = 'completed';

        const winner = this.state.gameState.winner === 'player'
            ? this.state.playerAddress
            : this.state.opponentAddress;

        console.log('🏆 [Battle] Battle ended! Winner:', winner.toBase58());

        if (this.socket?.connected) {
            this.socket.emit('game_end', {
                challengeId: this.state.challengeId,
                winner: winner.toBase58(),
            });
        }

        this.notifyStateChange();

        if (this.onGameEnd) {
            this.onGameEnd(winner);
        }
    }

    forceEnd(winner: 'player' | 'opponent', reason: string) {
        this.stopRoundTimer();
        this.state.battleStatus = 'error';
        this.state.error = reason;
        this.state.gameState.winner = winner;
        this.state.gameState.gameStatus = 'finished';

        const winnerAddress = winner === 'player'
            ? this.state.playerAddress
            : this.state.opponentAddress;

        console.log(`⚠️ [Battle] Battle force-ended: ${reason}`);

        this.notifyStateChange();

        if (this.onGameEnd) {
            this.onGameEnd(winnerAddress);
        }
    }

    private notifyStateChange() {
        if (this.onStateChange) {
            this.onStateChange(this.getState());
        }
    }

    destroy() {
        this.stopRoundTimer();

        if (this.socket) {
            if (this.socket.connected) {
                this.socket.emit('leave_game', {
                    challengeId: this.state.challengeId,
                    playerAddress: this.state.playerAddress.toBase58(),
                });
            }
            this.socket.disconnect();
            this.socket = null;
        }

        this.onStateChange = undefined;
        this.onTimeout = undefined;
        this.onGameEnd = undefined;
    }

    getTimeRemaining(): number {
        if (!this.state.moveSubmittedAt) {
            return this.state.roundTimeLimit;
        }

        const elapsed = (Date.now() - this.state.moveSubmittedAt) / 1000;
        return Math.max(0, this.state.roundTimeLimit - elapsed);
    }
}

export default BattleHandler;