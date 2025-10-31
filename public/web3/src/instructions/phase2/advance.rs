// Phase advancement - moving from one phase to the next

use anchor_lang::prelude::*;
use crate::state::{Game, GameStatus};
use crate::events::PhaseAdvanced;
use crate::errors::GameError;
use crate::constants::PHASE_ADVANCE_BUFFER;

/// Advance to the next phase (Phase 1 → 2, or Phase 2 → 3)
pub fn advance_phase(ctx: Context<AdvancePhase>) -> Result<()> {
    let game = &mut ctx.accounts.game;
    let clock = Clock::get()?;
    
    require!(game.game_started, GameError::GameNotStarted);
    require!(
        clock.unix_timestamp >= game.phase_end_time,
        GameError::PhaseNotEnded
    );
    
    // Check authorization
    let is_creator = game.creator == ctx.accounts.caller.key();
    let timeout_passed = clock.unix_timestamp >= game.phase_advance_deadline;
    
    require!(
        is_creator || timeout_passed,
        GameError::NotAuthorizedToAdvance
    );
    
    // Advance phase
    game.current_phase += 1;
    game.phase_start_time = clock.unix_timestamp;
    
    let phase_duration = match game.current_phase {
        2 => game.phases.phase2_duration as i64,
        3 => game.phases.phase3_duration as i64,
        _ => 0,
    };
    
    game.phase_end_time = clock.unix_timestamp + phase_duration;
    game.phase_advance_deadline = game.phase_end_time + PHASE_ADVANCE_BUFFER;
    
    emit!(PhaseAdvanced {
        game_id: game.game_id,
        new_phase: game.current_phase,
        phase_end_time: game.phase_end_time,
    });
    
    Ok(())
}

#[derive(Accounts)]
pub struct AdvancePhase<'info> {
    #[account(mut)]
    pub game: Account<'info, Game>,
    
    pub caller: Signer<'info>,
}
