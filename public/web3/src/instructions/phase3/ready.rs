// Phase 3 ready system - players must opt-in to the final purge

use anchor_lang::prelude::*;
use crate::state::{Game, Phase3ReadyState};
use crate::errors::GameError;

/// Mark yourself as ready for the final purge
/// Players must actively participate - no automatic enrollment
pub fn mark_ready_phase3(ctx: Context<MarkReadyPhase3>) -> Result<()> {
    let game = &mut ctx.accounts.game;
    let ready_state = &mut ctx.accounts.ready_state;
    let clock = Clock::get()?;
    
    require!(game.current_phase == 3, GameError::InvalidPhase);
    require!(!game.phase3_started, GameError::Phase3AlreadyStarted);
    
    // Check deadline
    let deadline = if game.phase3_extended_deadline > 0 {
        game.phase3_extended_deadline
    } else {
        game.phase3_ready_deadline
    };
    
    require!(
        clock.unix_timestamp <= deadline,
        GameError::ReadyDeadlineExpired
    );
    require!(
        game.players.contains(&ctx.accounts.player.key()),
        GameError::NotInGame
    );
    
    // Mark as ready (only count once)
    if !ready_state.ready {
        ready_state.game_id = game.game_id;
        ready_state.player = ctx.accounts.player.key();
        ready_state.ready = true;
        ready_state.marked_ready_at = clock.unix_timestamp;
        ready_state.bump = ctx.bumps.ready_state;
        
        game.phase3_players_ready += 1;
    }
    
    Ok(())
}

#[derive(Accounts)]
pub struct MarkReadyPhase3<'info> {
    #[account(mut)]
    pub game: Account<'info, Game>,
    
    #[account(
        init_if_needed,
        payer = player,
        space = Phase3ReadyState::SIZE,
        seeds = [
            b"phase3_ready",
            game.game_id.to_le_bytes().as_ref(),
            player.key().as_ref()
        ],
        bump
    )]
    pub ready_state: Account<'info, Phase3ReadyState>,
    
    #[account(mut)]
    pub player: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}
