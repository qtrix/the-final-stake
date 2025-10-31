// Game Registry - tracks all games and admin configuration

use anchor_lang::prelude::*;

/// Central registry that keeps track of all games created
/// and maintains the admin address for privileged operations
#[account]
pub struct GameRegistry {
    /// Current count of active games (used for game ID generation)
    pub game_count: u64,
    
    /// Total number of games ever created (for analytics)
    pub total_games_created: u64,
    
    /// Admin wallet address with emergency controls
    pub admin: Pubkey,
}

impl GameRegistry {
    /// Get the next game ID and increment the counter
    pub fn next_game_id(&mut self) -> u64 {
        let id = self.game_count;
        self.game_count += 1;
        self.total_games_created += 1;
        id
    }
}
