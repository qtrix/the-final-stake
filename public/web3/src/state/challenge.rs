// Challenge and mini-game system for Phase 2

use anchor_lang::prelude::*;

/// Challenge account representing a PvP match between two players
#[account]
pub struct Challenge {
    pub challenge_id: u64,
    pub game_id: u64,
    
    // Participants
    pub challenger: Pubkey,
    pub opponent: Pubkey,
    
    // Game details
    pub bet_amount: u64,
    pub game_type: MiniGameType,
    pub status: ChallengeStatus,
    
    // Timing
    pub created_at: i64,
    pub accepted_at: Option<i64>,
    pub game_started_at: Option<i64>,
    
    // Results
    pub winner: Option<Pubkey>,
    
    // Opponent behavior tracking
    pub opponent_decline_count: u8,  // Force accept after 5 declines
}

/// Types of mini-games players can challenge each other to
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
pub enum MiniGameType {
    CryptoTrivia,        // Knowledge-based questions
    RockPaperScissors,   // Classic game
    SpeedTrading,        // Quick decision making
    MemeBattle,          // Creative competition
}

/// Challenge lifecycle states
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
pub enum ChallengeStatus {
    Pending,        // Waiting for opponent response
    Accepted,       // Opponent accepted, waiting for both ready
    BothReady,      // Both players ready to start
    InProgress,     // Game is being played
    Completed,      // Winner determined
    Expired,        // Challenge timed out
    ForcedAccept,   // Forced after too many declines
}
