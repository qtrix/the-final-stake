// src/lib/gameEngines/rockPaperScissors.ts

export type RPSMove = 'rock' | 'paper' | 'scissors' | null;
export type RPSResult = 'win' | 'lose' | 'draw';

export interface RPSRound {
    roundNumber: number;
    playerMove: RPSMove;
    opponentMove: RPSMove;
    result: RPSResult | null;
    timestamp: number;
}

export interface RPSGameState {
    rounds: RPSRound[];
    playerScore: number;
    opponentScore: number;
    currentRound: number;
    gameStatus: 'waiting' | 'playing' | 'finished';
    winner: 'player' | 'opponent' | null;
    totalRounds: number;
}

export class RockPaperScissorsEngine {
    private readonly ROUNDS_TO_WIN = 3; // Best of 5 = first to 3 wins
    private readonly MAX_ROUNDS = 5;

    constructor() { }

    createInitialState(): RPSGameState {
        return {
            rounds: [],
            playerScore: 0,
            opponentScore: 0,
            currentRound: 1,
            gameStatus: 'waiting',
            winner: null,
            totalRounds: this.MAX_ROUNDS,
        };
    }

    determineRoundWinner(playerMove: RPSMove, opponentMove: RPSMove): RPSResult {
        if (!playerMove || !opponentMove) {
            throw new Error('Both players must make a move');
        }

        if (playerMove === opponentMove) {
            return 'draw';
        }

        const winConditions: Record<string, string> = {
            rock: 'scissors',
            paper: 'rock',
            scissors: 'paper',
        };

        return winConditions[playerMove] === opponentMove ? 'win' : 'lose';
    }

    processRound(
        state: RPSGameState,
        playerMove: RPSMove,
        opponentMove: RPSMove
    ): RPSGameState {
        if (state.gameStatus === 'finished') {
            throw new Error('Game is already finished');
        }

        if (!playerMove || !opponentMove) {
            throw new Error('Both players must submit moves');
        }

        const result = this.determineRoundWinner(playerMove, opponentMove);

        const newRound: RPSRound = {
            roundNumber: state.currentRound,
            playerMove,
            opponentMove,
            result,
            timestamp: Date.now(),
        };

        const newState = { ...state };
        newState.rounds = [...state.rounds, newRound];

        if (result === 'win') {
            newState.playerScore += 1;
        } else if (result === 'lose') {
            newState.opponentScore += 1;
        }

        if (newState.playerScore >= this.ROUNDS_TO_WIN) {
            newState.gameStatus = 'finished';
            newState.winner = 'player';
        } else if (newState.opponentScore >= this.ROUNDS_TO_WIN) {
            newState.gameStatus = 'finished';
            newState.winner = 'opponent';
        } else if (newState.currentRound >= this.MAX_ROUNDS) {
            newState.gameStatus = 'finished';
            if (newState.playerScore > newState.opponentScore) {
                newState.winner = 'player';
            } else if (newState.opponentScore > newState.playerScore) {
                newState.winner = 'opponent';
            } else {
                newState.winner = 'player'; // Draw = player wins
            }
        } else {
            newState.currentRound += 1;
            newState.gameStatus = 'playing';
        }

        return newState;
    }

    getMoveEmoji(move: RPSMove): string {
        const emojis: Record<string, string> = {
            rock: '🪨',
            paper: '📄',
            scissors: '✂️',
        };
        return move ? emojis[move] : '❓';
    }

    getResultColor(result: RPSResult | null): string {
        if (!result) return 'text-muted-foreground';
        const colors: Record<RPSResult, string> = {
            win: 'text-green-400',
            lose: 'text-red-400',
            draw: 'text-yellow-400',
        };
        return colors[result];
    }

    getResultText(result: RPSResult | null): string {
        if (!result) return 'Waiting...';
        const texts: Record<RPSResult, string> = {
            win: 'You Win!',
            lose: 'You Lose',
            draw: 'Draw',
        };
        return texts[result];
    }

    isValidMove(move: any): move is RPSMove {
        return move === 'rock' || move === 'paper' || move === 'scissors';
    }

    generateRandomMove(): RPSMove {
        const moves: RPSMove[] = ['rock', 'paper', 'scissors'];
        return moves[Math.floor(Math.random() * moves.length)];
    }
}

export const rpsEngine = new RockPaperScissorsEngine();