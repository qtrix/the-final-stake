// Helper functions and utilities used across the program

use anchor_lang::prelude::*;
use crate::state::{Game, PlayerGameState, Phase3ReadyState};
use crate::errors::GameError;

/// Count how many players are eligible for Phase 3
/// (those who met the Phase 2 requirements)
pub fn count_eligible_players_for_phase3<'info>(
    remaining_accounts: &'info [AccountInfo<'info>],
    game: &Game,
) -> Result<u8> {
    let mut count = 0u8;
    
    for account_info in remaining_accounts {
        if let Ok(player_state) = Account::<PlayerGameState>::try_from(account_info) {
            if player_state.game_id == game.game_id && player_state.phase2_requirement_met {
                count += 1;
            }
        }
    }
    
    Ok(count)
}

/// Find the first ready player in the remaining accounts
pub fn find_ready_player<'info>(
    remaining_accounts: &'info [AccountInfo<'info>],
    game: &Game,
) -> Result<Pubkey> {
    for account_info in remaining_accounts {
        if let Ok(ready_state) = Account::<Phase3ReadyState>::try_from(account_info) {
            if ready_state.ready && ready_state.game_id == game.game_id {
                return Ok(ready_state.player);
            }
        }
    }
    
    Err(GameError::ReadyPlayerNotFound.into())
}

/// Calculate the current effective time for reward claims
/// Returns the earlier of: current time or phase end time
pub fn get_effective_claim_time(current_time: i64, phase_end: i64) -> i64 {
    if current_time > phase_end {
        phase_end
    } else {
        current_time
    }
}

/// Convert seconds to hours (as f64) for rate calculations
pub fn seconds_to_hours(seconds: i64) -> f64 {
    seconds as f64 / 3600.0
}

/// Check if enough time has passed since a timestamp
pub fn has_time_passed(current_time: i64, reference_time: i64, required_duration: i64) -> bool {
    current_time >= reference_time + required_duration
}
