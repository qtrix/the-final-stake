// src/types/index.ts - Complete Types
import { PublicKey } from '@solana/web3.js';

export interface Game {
    gameId: number;
    name: string;
    creator: string;
    entryFee: number;
    maxPlayers: number;
    currentPlayers: number;
    startTime: Date;
    expireTime: Date;
    status: 'WaitingForPlayers' | 'ReadyToStart' | 'InProgress' | 'Completed' | 'Cancelled' | 'Expired' | 'ExpiredWithPenalty';
    prizePool: number;
    players: string[];
    gameStarted: boolean;
    refundedPlayers: string[];
    currentPhase: number;
    phaseEndTime: Date;
    phaseAdvanceDeadline: Date;
    phases: {
        phase1Duration: number;
        phase2Duration: number;
        phase3Duration: number;
    };
    txSignature?: string;
    phase2RequiredGames: number;
    phase2MaxGamesPerOpponent: number;
    phase3ReadyDeadline: Date;
    phase3ExtendedDeadline: Date | null;
    phase3PlayersReady: number;
    phase3Started: boolean;
    phase3Winner: string | null;
    platformFeeCollected: number;
    totalPhase2GamesPlayed?: number;
}

export interface Phase3ReadyState {
    gameId: number;
    player: string;
    ready: boolean;
    markedReadyAt: Date;
}

export interface PlayerState {
    id: string;
    x: number;
    y: number;
    hp: number;
    maxHp: number;
    alive: boolean;
    hasShield: boolean;
    hasSpeed: boolean;
    name: string;
    color: string;
    radius: number;
    vx: number;
    vy: number;
}

export interface WebSocketMessage {
    type: 'sync' | 'update' | 'eliminated' | 'winner' | 'heartbeat';
    gameId?: number;
    playerId?: string;
    data?: any;
    timestamp?: number;
}