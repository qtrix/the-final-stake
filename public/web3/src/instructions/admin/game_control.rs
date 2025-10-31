// Admin game controls - emergency start, phase advancement, and edge case handling

use anchor_lang::prelude::*;
use crate::state::{Game, GameRegistry, GameStatus, PlayerGameState};
use crate::events::{GameStarted, PhaseAdvanced, GameClosedNoReady};
use crate::errors::GameError;
use crate::constants::{MIN_PLAYERS_TO_START, PHASE_ADVANCE_BUFFER, ADMIN_SHARE_NO_READY};

/// Admin can start a game if creator is unresponsive
pub fn admin_start_game(ctx: Context<AdminStartGame>) -> Result<()> {
    let game = &mut ctx.accounts.game;
    let game_registry = &ctx.accounts.game_registry;
    let clock = Clock::get()?;
    
    // Verify admin
    require!(
        ctx.accounts.admin.key() == game_registry.admin,
        GameError::NotAdmin
    );
    require!(!game.game_started, GameError::GameAlreadyStarted);
    require!(
        game.current_players >= MIN_PLAYERS_TO_START,
        GameError::NotEnoughPlayers
    );
    require!(
        clock.unix_timestamp >= game.start_time,
        GameError::GameNotStarted
    );
    
    // Start the game
    game.game_started = true;
    game.status = GameStatus::InProgress;
    game.current_phase = 1;
    game.phase_start_time = clock.unix_timestamp;
    game.phase_end_time = clock.unix_timestamp + game.phases.phase1_duration as i64;
    game.phase_advance_deadline = game.phase_end_time + PHASE_ADVANCE_BUFFER;
    
    emit!(GameStarted {
        game_id: game.game_id,
        start_time: clock.unix_timestamp,
        phase1_end_time: game.phase_end_time,
    });
    
    Ok(())
}

/// Admin can advance phase anytime (emergency control)
pub fn admin_advance_phase(ctx: Context<AdminAdvancePhase>) -> Result<()> {
    let game = &mut ctx.accounts.game;
    let game_registry = &ctx.accounts.game_registry;
    let clock = Clock::get()?;
    
    // Verify admin
    require!(
        ctx.accounts.admin.key() == game_registry.admin,
        GameError::NotAdmin
    );
    require!(game.game_started, GameError::GameNotStarted);
    require!(game.current_phase < 3, GameError::InvalidPhase);
    
    game.current_phase += 1;
    game.phase_start_time = clock.unix_timestamp;
    
    match game.current_phase {
        2 => {
            game.phase_end_time = clock.unix_timestamp + game.phases.phase2_duration as i64;
            game.phase_advance_deadline = game.phase_end_time + PHASE_ADVANCE_BUFFER;
        }
        3 => {
            game.phase_end_time = clock.unix_timestamp + game.phases.phase3_duration as i64;
            game.phase3_ready_deadline = clock.unix_timestamp + 300; // 5 minutes
            game.phase3_extended_deadline = clock.unix_timestamp + 900; // 15 minutes total
        }
        _ => {}
    }
    
    emit!(PhaseAdvanced {
        game_id: game.game_id,
        new_phase: game.current_phase,
        phase_end_time: game.phase_end_time,
    });
    
    Ok(())
}

/// Admin closes purge if no players ready - redistributes 25% to admin, 75% to eligible players
pub fn admin_close_purge_no_ready<'info>(
    ctx: Context<'_, '_, 'info, 'info, AdminClosePurgeNoReady<'info>>
) -> Result<()> {
    let game = &mut ctx.accounts.game;
    let game_registry = &ctx.accounts.game_registry;
    let clock = Clock::get()?;
    
    // Verify admin
    require!(
        ctx.accounts.admin.key() == game_registry.admin,
        GameError::NotAdmin
    );
    require!(game.current_phase == 3, GameError::InvalidPhase);
    require!(
        clock.unix_timestamp > game.phase3_extended_deadline,
        GameError::ReadyPeriodNotExpired
    );
    require!(game.phase3_players_ready == 0, GameError::SomePlayersReady);
    
    // Calculate redistribution
    let platform_fee = game.prize_pool
        .checked_mul(ADMIN_SHARE_NO_READY)
        .ok_or(GameError::MathOverflow)?
        .checked_div(100)
        .ok_or(GameError::InvalidCalculation)?;
    
    let player_share_total = game.prize_pool
        .checked_sub(platform_fee)
        .ok_or(GameError::MathOverflow)?;
    
    // Find players who met Phase 2 requirements
    let mut purge_players = Vec::new();
    for player_pubkey in &game.players {
        for acc in ctx.remaining_accounts.iter() {
            if acc.key() == *player_pubkey {
                if let Ok(player_state) = Account::<PlayerGameState>::try_from(acc) {
                    if player_state.phase2_requirement_met {
                        purge_players.push(*player_pubkey);
                    }
                }
                break;
            }
        }
    }
    
    require!(purge_players.len() > 0, GameError::NoPurgePlayersFound);
    
    let share_per_player = player_share_total
        .checked_div(purge_players.len() as u64)
        .ok_or(GameError::InvalidCalculation)?;
    
    // Transfer platform fee to admin
    **game.to_account_info().try_borrow_mut_lamports()? -= platform_fee;
    **ctx.accounts.admin.to_account_info().try_borrow_mut_lamports()? += platform_fee;
    
    // Distribute shares to eligible players
    for player_pubkey in &purge_players {
        for acc in ctx.remaining_accounts.iter() {
            if acc.key() == *player_pubkey {
                **game.to_account_info().try_borrow_mut_lamports()? -= share_per_player;
                **acc.try_borrow_mut_lamports()? += share_per_player;
                break;
            }
        }
    }
    
    game.status = GameStatus::Completed;
    game.platform_fee_collected = platform_fee;
    
    emit!(GameClosedNoReady {
        game_id: game.game_id,
        platform_fee,
        purge_players: purge_players.len() as u8,
        share_per_player,
    });
    
    Ok(())
}

#[derive(Accounts)]
pub struct AdminStartGame<'info> {
    #[account(mut)]
    pub game: Account<'info, Game>,
    
    pub game_registry: Account<'info, GameRegistry>,
    
    pub admin: Signer<'info>,
}

#[derive(Accounts)]
pub struct AdminAdvancePhase<'info> {
    #[account(mut)]
    pub game: Account<'info, Game>,
    
    pub game_registry: Account<'info, GameRegistry>,
    
    pub admin: Signer<'info>,
}

#[derive(Accounts)]
pub struct AdminClosePurgeNoReady<'info> {
    #[account(mut)]
    pub game: Account<'info, Game>,
    
    pub game_registry: Account<'info, GameRegistry>,
    
    #[account(mut)]
    pub admin: Signer<'info>,
}
