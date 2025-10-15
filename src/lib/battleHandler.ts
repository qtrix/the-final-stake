// src/lib/battleHandler.ts - Battle Handler with WebSocket

import { PublicKey } from '@solana/web3.js';
import { rpsEngine, type RPSGameState, type RPSMove } from './gameEngines/rockPaperScissors';
import { WebSocketManager } from './wsManager';

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
    private wsManager: WebSocketManager;

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

        this.wsManager = new WebSocketManager(challengeId, playerAddress.toBase58());
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
        console.log('🎮 Starting battle with WebSocket...');

        this.wsManager.connect({
            onPlayerJoined: (data) => {
                console.log('👤 Player joined:', data);
                if (data.playersCount === 1) {
                    this.state.battleStatus = 'waiting_for_opponent';
                } else if (data.playersCount === 2) {
                    this.state.opponentConnected = true;
                }
                this.notifyStateChange();
            },

            onGameReady: (data) => {
                console.log('✅ Both players connected!');
                this.state.battleStatus = 'in_progress';
                this.state.gameState.gameStatus = 'playing';
                this.state.opponentConnected = true;
                this.notifyStateChange();
                this.startRoundTimer();
            },

            onOpponentMoved: (data) => {
                console.log('🤖 Opponent moved');
                this.notifyStateChange();
            },

            onRoundComplete: (data) => {
                console.log('🎲 Round complete:', data);

                const opponentMove = data.moves.find(
                    m => m.playerAddress !== this.state.playerAddress.toBase58()
                );

                if (opponentMove) {
                    this.receiveOpponentMove(opponentMove.move as RPSMove);
                }
            },

            onGameEnded: (data) => {
                console.log('🏆 Game ended');
            },

            onOpponentLeft: (data) => {
                console.log('👋 Opponent disconnected');
                this.forceEnd('player', 'Opponent disconnected');
            },

            onError: (error) => {
                console.error('❌ WebSocket error:', error);
                this.state.battleStatus = 'error';
                this.state.error = 'Connection error';
                this.notifyStateChange();
            },
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

        this.state.playerMove = move;
        this.state.moveSubmittedAt = Date.now();
        this.state.waitingForOpponent = true;

        try {
            this.wsManager.submitMove(move, this.state.gameState.currentRound);
            console.log(`✋ Move submitted: ${move}`);
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
        console.log(`🤖 Opponent move: ${move}`);

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

        console.log(`📊 Round ${newGameState.currentRound - 1} processed`);

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
            console.warn('⏰ Round timeout!');
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
        console.log('⏰ Timeout triggered');

        if (!this.state.playerMove) {
            const randomMove = rpsEngine.generateRandomMove();
            this.state.playerMove = randomMove;
            this.wsManager.submitMove(randomMove, this.state.gameState.currentRound);
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

        console.log('🏆 Battle ended! Winner:', winner.toBase58());

        this.wsManager.endGame(winner.toBase58());

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

        console.log(`⚠️ Battle force-ended: ${reason}`);

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
        this.wsManager.disconnect();
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

// IMPORTANT: Default export
export default BattleHandler;