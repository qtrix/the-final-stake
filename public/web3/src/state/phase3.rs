// Phase 3 ready state for the final purge

use anchor_lang::prelude::*;

/// Tracks which players have marked themselves ready for the purge
/// Players must actively opt-in to participate in the final game
#[account]
pub struct Phase3ReadyState {
    pub game_id: u64,
    pub player: Pubkey,
    pub ready: bool,
    pub marked_ready_at: i64,
    pub bump: u8,
}

impl Phase3ReadyState {
    pub const SIZE: usize = 8 + 8 + 32 + 1 + 8 + 1;
}
