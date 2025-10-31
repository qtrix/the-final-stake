// Player state and resource management

use anchor_lang::prelude::*;
use crate::errors::GameError;

/// Per-player game state tracking virtual balance and activities
#[account]
pub struct PlayerGameState {
    pub player: Pubkey,
    pub game_id: u64,
    
    // Virtual economy
    pub virtual_balance: u64,
    pub total_earned: u64,
    pub last_claim_time: i64,
    
    // Phase 1: Resource allocation
    pub has_active_allocation: bool,
    pub allocations: ResourceAllocations,
    
    // Phase 2: PvP tracking
    pub phase2_games_played: u8,
    pub phase2_games_won: u8,
    pub phase2_opponents_played: Vec<OpponentRecord>,
    pub phase2_requirement_met: bool,
    pub phase2_penalty_applied: bool,
    
    // Phase 3: Prize eligibility
    pub phase3_prize_claimed: bool,
}

impl PlayerGameState {
    /// Check if player can challenge a specific opponent
    /// Respects the max games per opponent limit
    pub fn can_challenge_opponent(&self, opponent: &Pubkey, max_games: u8) -> bool {
        let games_against = self.phase2_opponents_played
            .iter()
            .find(|record| record.opponent == *opponent)
            .map(|record| record.games_count)
            .unwrap_or(0);
        
        games_against < max_games
    }
    
    /// Record a completed mini-game
    pub fn record_game_played(&mut self, opponent: &Pubkey, won: bool) -> Result<()> {
        self.phase2_games_played += 1;
        
        if won {
            self.phase2_games_won += 1;
        }
        
        // Update or add opponent record
        if let Some(record) = self.phase2_opponents_played
            .iter_mut()
            .find(|r| r.opponent == *opponent) 
        {
            record.games_count += 1;
        } else {
            // Only track up to 10 unique opponents to save space
            if self.phase2_opponents_played.len() < 10 {
                self.phase2_opponents_played.push(OpponentRecord {
                    opponent: *opponent,
                    games_count: 1,
                });
            }
        }
        
        Ok(())
    }
    
    /// Check if player met Phase 2 requirements (80% of required games)
    pub fn check_phase2_requirement(&self, required_games: u8) -> bool {
        let min_games = ((required_games as f64) * 0.8).ceil() as u8;
        self.phase2_games_played >= min_games
    }
}

/// Resource allocation across different activities in Phase 1
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Default)]
pub struct ResourceAllocations {
    pub mining: u64,      // Steady but slows with competition
    pub farming: u64,     // Seasonal bonuses
    pub trading: u64,     // High risk/reward
    pub research: u64,    // Future feature
    pub social: u64,      // Collaboration bonus
}

/// Track games played against each opponent
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct OpponentRecord {
    pub opponent: Pubkey,
    pub games_count: u8,
}
