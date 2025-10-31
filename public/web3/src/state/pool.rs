// Global pool state for Phase 1 resource competition

use anchor_lang::prelude::*;

/// Global state tracking total allocations across all players
/// Used to calculate competition-based rewards in Phase 1
#[account]
pub struct GamePoolState {
    pub game_id: u64,
    
    // Total tokens allocated to each resource type
    pub mining_pool_total: u64,
    pub farming_pool_total: u64,
    pub trading_pool_total: u64,
    pub research_pool_total: u64,
    pub social_pool_total: u64,
    
    // Social activity tracking
    pub social_pool_participants: u32,
    
    // Dynamic event states
    pub farming_season: u8,        // 0-3: affects farming rewards
    pub trading_market_state: u8,  // 0=crash, 1=normal, 2=boom
    pub last_event_time: i64,      // Last time events were updated
}

impl GamePoolState {
    /// Calculate mining difficulty based on total pool competition
    /// More tokens in mining = higher difficulty = lower rewards
    pub fn get_mining_difficulty_factor(&self) -> f64 {
        use crate::constants::MAX_MINING_DIFFICULTY;
        
        // Difficulty increases as more players mine
        let difficulty = (self.mining_pool_total as f64 / 10_000_000_000_000.0)
            .min(MAX_MINING_DIFFICULTY);
        
        1.0 - difficulty
    }
    
    /// Get current farming season multiplier
    /// Cycles through 4 seasons with different yields
    pub fn get_farming_multiplier(&self) -> f64 {
        match self.farming_season % 4 {
            0 => 30.0,  // Spring - best season
            1 => 20.0,  // Summer
            2 => 10.0,  // Fall
            _ => 24.0,  // Winter
        }
    }
    
    /// Get trading market multiplier
    /// Can be negative during crashes!
    pub fn get_trading_multiplier(&self) -> f64 {
        match self.trading_market_state {
            0 => -60.0,  // Market crash - lose tokens!
            1 => 20.0,   // Normal market
            2 => 100.0,  // Bull run - big gains
            _ => 0.0,
        }
    }
    
    /// Calculate social collaboration bonus
    /// More participants = better rewards for everyone
    pub fn get_social_multiplier(&self) -> f64 {
        use crate::constants::MAX_SOCIAL_BONUS;
        
        let base_multiplier = 1.0;
        let bonus = (self.social_pool_participants as f64 * 0.1).min(MAX_SOCIAL_BONUS);
        
        base_multiplier + bonus
    }
}
