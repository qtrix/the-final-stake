// Event definitions for on-chain logging and indexing
// These events help track game state changes and player actions

use anchor_lang::prelude::*;

// Game lifecycle events

#[event]
pub struct GameCreated {
    pub game_id: u64,
    pub creator: Pubkey,
    pub entry_fee: u64,
    pub max_players: u8,
    pub start_time: i64,
    pub phase2_required_games: u8,
    pub phase2_max_games_per_opponent: u8,
}

#[event]
pub struct PlayerJoined {
    pub game_id: u64,
    pub player: Pubkey,
    pub current_players: u8,
}

#[event]
pub struct GameStarted {
    pub game_id: u64,
    pub start_time: i64,
    pub phase1_end_time: i64,
}

#[event]
pub struct GameCancelled {
    pub game_id: u64,
    pub cancelled_at: i64,
}

#[event]
pub struct GameExpiredWithPenalty {
    pub game_id: u64,
    pub expired_at: i64,
    pub reason: String,
}

// Refund events

#[event]
pub struct RefundClaimed {
    pub game_id: u64,
    pub player: Pubkey,
    pub amount: u64,
}

#[event]
pub struct ForcedRefundClaimed {
    pub game_id: u64,
    pub player: Pubkey,
    pub amount: u64,
}

// Phase progression events

#[event]
pub struct PhaseAdvanced {
    pub game_id: u64,
    pub new_phase: u8,
    pub phase_end_time: i64,
}

// Phase 2: Challenge events

#[event]
pub struct ChallengeCreated {
    pub challenge_id: u64,
    pub game_id: u64,
    pub challenger: Pubkey,
    pub opponent: Pubkey,
    pub bet_amount: u64,
}

#[event]
pub struct MiniGameCompleted {
    pub challenge_id: u64,
    pub winner: Pubkey,
    pub loser: Pubkey,
    pub bet_amount: u64,
}

#[event]
pub struct Phase2PenaltyApplied {
    pub player: Pubkey,
    pub games_played: u8,
    pub required_games: u8,
    pub penalty_amount: u64,
}

// Phase 3: Purge events

#[event]
pub struct Phase3WinnerDeclared {
    pub game_id: u64,
    pub winner: Pubkey,
    pub prize_amount: u64,
}

#[event]
pub struct Phase3PrizeClaimed {
    pub game_id: u64,
    pub winner: Pubkey,
    pub amount: u64,
}

#[event]
pub struct GameClosedNoReady {
    pub game_id: u64,
    pub platform_fee: u64,
    pub purge_players: u8,
    pub share_per_player: u64,
}
