// Constants and configuration values for the Solana Survivor game

use anchor_lang::prelude::*;

// Game timing constants (in seconds)
pub const GAME_START_GRACE_PERIOD: i64 = 1800; // 30 minutes to start game
pub const PHASE_ADVANCE_BUFFER: i64 = 600; // 10 minutes buffer to advance phase
pub const PHASE3_READY_WINDOW: i64 = 1800; // 30 minutes to mark ready for purge
pub const PHASE3_EXTENDED_WINDOW: i64 = 3600; // Additional 1 hour if no one ready

// Player requirements
pub const MIN_PLAYERS_TO_START: u8 = 3;
pub const MAX_PLAYERS_ALLOWED: u8 = 100;

// Phase 2 challenge limits
pub const MIN_PHASE2_GAMES: u8 = 3;
pub const MAX_PHASE2_GAMES: u8 = 10;
pub const MAX_OPPONENT_DECLINES: u8 = 5; // After 5 declines, challenge is forced

// Platform fees
pub const PLATFORM_FEE_PERCENTAGE: u64 = 1; // 1% of prize pool
pub const ADMIN_SHARE_NO_READY: u64 = 25; // 25% to admin if no players ready for purge

// Resource multipliers for Phase 1
pub const MINING_BASE_RATE: f64 = 7.0;
pub const FARMING_BASE_RATE: f64 = 10.0;
pub const TRADING_BASE_RATE: f64 = 20.0;
pub const SOCIAL_BASE_RATE: f64 = 4.0;

// Difficulty and competition factors
pub const MAX_MINING_DIFFICULTY: f64 = 0.5; // Mining becomes 50% harder at max pool
pub const MAX_SOCIAL_BONUS: f64 = 2.0; // Max 3x multiplier from collaboration

// Virtual token initial balance multiplier
pub const INITIAL_BALANCE_MULTIPLIER: u64 = 10; // entry_fee * 10

// Account space allocations (for rent calculation)
pub const GAME_ACCOUNT_SIZE: usize = 8 + 8 + 64 + 32 + 8 + 1 + 1 + 8 + 8 + 1 + 8 
    + (32 * 100) + 1 + (32 * 100) + 1 + 8 + 8 + 8 + 24 + 1 + 1 + 8 + 8 + 1 + 1 + 33 + 8;

pub const PLAYER_STATE_SIZE: usize = 8 + 32 + 8 + 8 + 8 + 8 + 1 + 40 + 1 + 1 
    + (33 * 10) + 1 + 1 + 1;

pub const POOL_STATE_SIZE: usize = 8 + 8 + 8 + 8 + 8 + 8 + 8 + 4 + 1 + 1 + 8;

pub const CHALLENGE_SIZE: usize = 8 + 8 + 8 + 32 + 32 + 8 + 1 + 1 + 8 + 9 + 9 + 33 + 1;

pub const PHASE3_READY_SIZE: usize = 8 + 8 + 32 + 1 + 8 + 1;

pub const REGISTRY_SIZE: usize = 8 + 8 + 8 + 32;
