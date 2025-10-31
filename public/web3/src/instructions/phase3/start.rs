// Phase 3 purge start - initiating the final game and declaring winner

use anchor_lang::prelude::*;
use crate::state::{Game, GameStatus, PlayerGameState, Phase3ReadyState};
use crate::events::Phase3WinnerDeclared;
use crate::errors::GameError;
use crate::constants::{PHASE3_READY_WINDOW, PHASE3_EXTENDED_WINDOW, PLATFORM_FEE_PERCENTAGE};
use crate::utils::{count_eligible_players_for_phase3, find_ready_player};

/// Advance from Phase 2 to Phase 3
pub fn advance_to_phase3(ctx: Context<AdvanceToPhase3>) -> Result<()> {
    let game = &mut ctx.accounts.game;
    let clock = Clock::get()?;
    
    require!(game.current_phase == 2, GameError::InvalidPhase);
    require!(game.game_started, GameError::GameNotStarted);
    
    // Check time requirements
    let time_since_phase_start = clock.unix_timestamp - game.phase_start_time;
    if ctx.accounts.caller.key() != game.creator {
        require!(
            time_since_phase_start >= 300,
            GameError::OnlyCreatorCanAdvanceEarly
        );
    }
    
    require!(
        clock.unix_timestamp >= game.phase_end_time,
        GameError::PhaseNotEnded
    );
    
    // Set up Phase 3
    game.current_phase = 3;
    game.phase_start_time = clock.unix_timestamp;
    game.phase_end_time = clock.unix_timestamp + game.phases.phase3_duration as i64;
    game.phase3_ready_deadline = clock.unix_timestamp + PHASE3_READY_WINDOW;
    game.phase3_extended_deadline = 0;
    game.phase3_players_ready = 0;
    game.phase3_started = false;
    game.phase3_winner = None;
    
    emit!(crate::events::PhaseAdvanced {
        game_id: game.game_id,
        new_phase: 3,
        phase_end_time: game.phase_end_time,
    });
    
    Ok(())
}

/// Start the purge or declare winner based on ready count
pub fn start_phase3_game<'info>(
    ctx: Context<'_, '_, 'info, 'info, StartPhase3Game<'info>>
) -> Result<()> {
    let game = &mut ctx.accounts.game;
    let clock = Clock::get()?;
    
    require!(game.current_phase == 3, GameError::InvalidPhase);
    require!(!game.phase3_started, GameError::Phase3AlreadyStarted);
    
    // Count eligible players who met Phase 2 requirements
    let eligible_count = count_eligible_players_for_phase3(
        ctx.remaining_accounts,
        game
    )?;
    
    let all_eligible_ready = eligible_count > 0 
        && game.phase3_players_ready == eligible_count;
    
    // Check if we can start
    let deadline = if game.phase3_extended_deadline > 0 {
        game.phase3_extended_deadline
    } else {
        game.phase3_ready_deadline
    };
    
    require!(
        clock.unix_timestamp >= deadline || all_eligible_ready,
        GameError::ReadyPeriodNotExpired
    );
    
    let ready_count = game.phase3_players_ready;
    
    // No players ready - extend deadline or end game
    if ready_count == 0 {
        if game.phase3_extended_deadline == 0 {
            game.phase3_extended_deadline = clock.unix_timestamp + PHASE3_EXTENDED_WINDOW;
            return Ok(());
        } else {
            // Game ends with no winner
            game.phase3_winner = None;
            game.status = GameStatus::Completed;
            return Ok(());
        }
    }
    
    // One player ready - they win by default!
    if ready_count == 1 {
        let ready_player = find_ready_player(ctx.remaining_accounts, game)?;
        game.phase3_winner = Some(ready_player);
        game.status = GameStatus::Completed;
        
        let platform_fee = game.prize_pool / 100;
        game.platform_fee_collected += platform_fee;
        
        return Ok(());
    }
    
    // Multiple players ready - start the purge!
    game.phase3_started = true;
    
    Ok(())
}

/// Submit the winner of the purge
pub fn submit_phase3_winner(ctx: Context<SubmitPhase3Winner>, winner: Pubkey) -> Result<()> {
    let game = &mut ctx.accounts.game;
    
    require!(game.current_phase == 3, GameError::InvalidPhase);
    require!(game.phase3_started, GameError::Phase3NotStarted);
    require!(game.phase3_winner.is_none(), GameError::WinnerAlreadyDeclared);
    require!(game.players.contains(&winner), GameError::NotInGame);
    
    game.phase3_winner = Some(winner);
    game.status = GameStatus::Completed;
    
    let platform_fee = game.prize_pool / 100;
    game.platform_fee_collected += platform_fee;
    
    emit!(Phase3WinnerDeclared {
        game_id: game.game_id,
        winner,
        prize_amount: game.prize_pool - platform_fee,
    });
    
    Ok(())
}

#[derive(Accounts)]
pub struct AdvanceToPhase3<'info> {
    #[account(mut)]
    pub game: Account<'info, Game>,
    
    pub caller: Signer<'info>,
}

#[derive(Accounts)]
pub struct StartPhase3Game<'info> {
    #[account(mut)]
    pub game: Account<'info, Game>,
    
    pub caller: Signer<'info>,
}

#[derive(Accounts)]
pub struct SubmitPhase3Winner<'info> {
    #[account(mut)]
    pub game: Account<'info, Game>,
    
    pub submitter: Signer<'info>,
}
