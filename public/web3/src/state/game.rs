// Game state and lifecycle management

use anchor_lang::prelude::*;

/// Main game account that tracks the entire game lifecycle
#[account]
pub struct Game {
    // Basic game info
    pub game_id: u64,
    pub name: String,
    pub creator: Pubkey,
    pub entry_fee: u64,
    
    // Player tracking
    pub max_players: u8,
    pub current_players: u8,
    pub players: Vec<Pubkey>,
    
    // Timing
    pub start_time: i64,
    pub expire_time: i64,
    
    // Game state
    pub status: GameStatus,
    pub game_started: bool,
    pub prize_pool: u64,
    pub refunded_players: Vec<Pubkey>,
    
    // Phase management
    pub current_phase: u8,
    pub phase_start_time: i64,
    pub phase_end_time: i64,
    pub phase_advance_deadline: i64,
    pub phases: PhaseDurations,
    
    // Phase 2 requirements
    pub phase2_required_games: u8,
    pub phase2_max_games_per_opponent: u8,
    
    // Phase 3 purge state
    pub phase3_ready_deadline: i64,
    pub phase3_extended_deadline: i64,
    pub phase3_players_ready: u8,
    pub phase3_started: bool,
    pub phase3_winner: Option<Pubkey>,
    pub phase3_prize_claimed: bool,
    
    // Platform fees
    pub platform_fee_collected: u64,
}

impl Game {
    /// Calculate Phase 2 game requirements based on player count and duration
    /// More players = more games needed, longer phase = more games allowed
    pub fn calculate_phase2_requirements(&self) -> (u8, u8) {
        let total_players = self.max_players as f64;
        
        // Base requirement scales logarithmically with player count
        let base_requirement = (total_players.log2().floor() as u8) + 2;
        
        // Adjust based on phase duration
        let phase2_hours = self.phases.phase2_duration as f64 / 3600.0;
        let time_multiplier = if phase2_hours >= 4.0 {
            1.2  // Longer phase = more games expected
        } else if phase2_hours >= 2.0 {
            1.0
        } else {
            0.8  // Shorter phase = fewer games required
        };
        
        let adjusted_requirement = (base_requirement as f64 * time_multiplier).floor() as u8;
        let required_games = adjusted_requirement.max(3).min(10);
        
        // Max games per opponent prevents farming same player
        let max_per_opponent = if total_players <= 5.0 {
            2
        } else if total_players <= 20.0 {
            3
        } else if total_players <= 50.0 {
            2
        } else {
            1
        };
        
        (required_games, max_per_opponent)
    }
}

/// Phase duration configuration
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct PhaseDurations {
    pub phase1_duration: u64,  // Resource management phase
    pub phase2_duration: u64,  // PvP challenge phase
    pub phase3_duration: u64,  // Final purge phase
}

/// Game lifecycle status
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
pub enum GameStatus {
    WaitingForPlayers,      // Accepting new players
    ReadyToStart,           // Full but not started yet
    InProgress,             // Game is active
    Completed,              // Game finished, prizes claimed
    Cancelled,              // Creator cancelled
    Expired,                // Registration period expired
    ExpiredWithPenalty,     // Expired with creator penalty
}
