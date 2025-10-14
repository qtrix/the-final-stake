// src/lib/pvpSync.ts - Sistem de sincronizare P2P prin polling

import { PublicKey } from '@solana/web3.js';
import type { RPSMove } from './gameEngines/rockPaperScissors';

export interface PvPGameState {
    challengeId: string;
    round: number;
    myMove: RPSMove | null;
    opponentMove: RPSMove | null;
    myScore: number;
    opponentScore: number;
    myReady: boolean;
    opponentReady: boolean;
}

export class PvPSyncManager {
    private state: PvPGameState;
    private storageKey: string;
    private pollInterval: NodeJS.Timeout | null = null;
    private onStateUpdate?: (state: PvPGameState) => void;

    constructor(challengeId: string) {
        this.storageKey = `pvp_game_${challengeId}`;

        // Try to load existing state or create new
        const saved = this.loadState();
        this.state = saved || {
            challengeId,
            round: 1,
            myMove: null,
            opponentMove: null,
            myScore: 0,
            opponentScore: 0,
            myReady: false,
            opponentReady: false,
        };
    }

    /**
     * Start syncing with opponent
     */
    startSync(callback: (state: PvPGameState) => void) {
        this.onStateUpdate = callback;

        // Poll every 500ms for opponent updates
        this.pollInterval = setInterval(() => {
            this.checkOpponentState();
        }, 500);
    }

    /**
     * Stop syncing
     */
    stopSync() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
    }

    /**
     * Submit my move
     */
    submitMove(move: RPSMove) {
        this.state.myMove = move;
        this.state.myReady = true;
        this.saveState();
        this.broadcast();

        console.log(`🎮 [PvP] Submitted move: ${move}`);
    }

    /**
     * Check for opponent's state
     */
    private checkOpponentState() {
        const opponentState = this.loadOpponentState();

        if (!opponentState) return;

        // If opponent made a move and we haven't detected it yet
        if (opponentState.myReady && !this.state.opponentReady) {
            this.state.opponentMove = opponentState.myMove;
            this.state.opponentReady = true;

            console.log(`🤖 [PvP] Opponent move detected: ${opponentState.myMove}`);

            if (this.onStateUpdate) {
                this.onStateUpdate(this.state);
            }
        }
    }

    /**
     * Process round result and prepare for next round
     */
    processRound(myScore: number, opponentScore: number) {
        this.state.myScore = myScore;
        this.state.opponentScore = opponentScore;
        this.state.round += 1;
        this.state.myMove = null;
        this.state.opponentMove = null;
        this.state.myReady = false;
        this.state.opponentReady = false;

        this.saveState();
        this.broadcast();
    }

    /**
     * Get current state
     */
    getState(): PvPGameState {
        return { ...this.state };
    }

    /**
     * Save state to localStorage
     */
    private saveState() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.state));
        } catch (e) {
            console.error('Failed to save PvP state:', e);
        }
    }

    /**
     * Load state from localStorage
     */
    private loadState(): PvPGameState | null {
        try {
            const saved = localStorage.getItem(this.storageKey);
            return saved ? JSON.parse(saved) : null;
        } catch (e) {
            return null;
        }
    }

    /**
     * Load opponent's state (from their localStorage via shared channel)
     */
    private loadOpponentState(): PvPGameState | null {
        try {
            // In real implementation, this would poll a shared endpoint
            // For now, simulate by checking alternate storage key pattern
            const opponentKey = `${this.storageKey}_opponent`;
            const saved = localStorage.getItem(opponentKey);
            return saved ? JSON.parse(saved) : null;
        } catch (e) {
            return null;
        }
    }

    /**
     * Broadcast my state to opponent
     */
    private broadcast() {
        try {
            // Store in "opponent's perspective" key so they can read it
            const opponentKey = `${this.storageKey}_my_broadcast`;
            localStorage.setItem(opponentKey, JSON.stringify(this.state));
        } catch (e) {
            console.error('Failed to broadcast:', e);
        }
    }

    /**
     * Clear game state
     */
    cleanup() {
        this.stopSync();
        try {
            localStorage.removeItem(this.storageKey);
            localStorage.removeItem(`${this.storageKey}_opponent`);
            localStorage.removeItem(`${this.storageKey}_my_broadcast`);
        } catch (e) {
            console.error('Cleanup failed:', e);
        }
    }
}