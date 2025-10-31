// Refund logic - cancellation and forced refunds

use anchor_lang::prelude::*;
use crate::state::{Game, GameStatus};
use crate::events::{GameCancelled, RefundClaimed, ForcedRefundClaimed, GameExpiredWithPenalty};
use crate::errors::GameError;
use crate::constants::{GAME_START_GRACE_PERIOD, MIN_PLAYERS_TO_START};

/// Creator cancels the game before it starts (within 30-minute window)
pub fn creator_cancel_game(ctx: Context<CreatorCancelGame>) -> Result<()> {
    let game = &mut ctx.accounts.game;
    let clock = Clock::get()?;
    
    require!(
        game.creator == ctx.accounts.creator.key(),
        GameError::NotCreator
    );
    require!(!game.game_started, GameError::GameAlreadyStarted);
    
    // Creator can only cancel within the 30-minute grace period
    let cancel_deadline = game.start_time + GAME_START_GRACE_PERIOD;
    require!(
        clock.unix_timestamp <= cancel_deadline,
        GameError::CancelWindowExpired
    );
    
    game.status = GameStatus::Cancelled;
    
    emit!(GameCancelled {
        game_id: game.game_id,
        cancelled_at: clock.unix_timestamp,
    });
    
    Ok(())
}

/// Claim refund from a cancelled or expired game
pub fn claim_refund(ctx: Context<ClaimRefund>) -> Result<()> {
    let game = &mut ctx.accounts.game;
    let player = &ctx.accounts.player;
    let clock = Clock::get()?;
    
    // Check game status allows refunds
    require!(
        game.status == GameStatus::Cancelled
            || game.status == GameStatus::Expired
            || game.status == GameStatus::ExpiredWithPenalty,
        GameError::GameNotCancelled
    );
    
    require!(
        game.players.contains(&player.key()),
        GameError::NotInGame
    );
    require!(
        !game.refunded_players.contains(&player.key()),
        GameError::AlreadyRefunded
    );
    
    // Special rule: creator forfeits funds if they missed their obligations
    if player.key() == game.creator {
        let deadline = game.start_time + GAME_START_GRACE_PERIOD;
        
        if clock.unix_timestamp > deadline
            && game.status == GameStatus::ExpiredWithPenalty
        {
            return Err(GameError::CreatorForfeitedFunds.into());
        }
    }
    
    // Process refund
    **game.to_account_info().try_borrow_mut_lamports()? -= game.entry_fee;
    **player.to_account_info().try_borrow_mut_lamports()? += game.entry_fee;
    game.refunded_players.push(player.key());
    
    emit!(RefundClaimed {
        game_id: game.game_id,
        player: player.key(),
        amount: game.entry_fee,
    });
    
    Ok(())
}

/// Players can force refund if creator didn't fulfill their obligations
pub fn force_refund_expired_game(ctx: Context<ForceRefund>) -> Result<()> {
    let game = &mut ctx.accounts.game;
    let player = &ctx.accounts.player;
    let clock = Clock::get()?;
    
    require!(
        game.players.contains(&player.key()),
        GameError::NotInGame
    );
    require!(
        !game.refunded_players.contains(&player.key()),
        GameError::AlreadyRefunded
    );
    require!(!game.game_started, GameError::GameAlreadyStarted);
    require!(
        game.status == GameStatus::WaitingForPlayers,
        GameError::GameNotOpen
    );
    
    // Must wait 30 minutes after start time
    let refund_available_time = game.start_time + GAME_START_GRACE_PERIOD;
    require!(
        clock.unix_timestamp >= refund_available_time,
        GameError::RefundNotYetAvailable
    );
    
    // Determine why refund is valid
    let should_have_started = game.current_players >= MIN_PLAYERS_TO_START;
    let should_have_cancelled = game.current_players < MIN_PLAYERS_TO_START;
    
    require!(
        should_have_started || should_have_cancelled,
        GameError::InvalidRefundCondition
    );
    
    // Process forced refund
    **game.to_account_info().try_borrow_mut_lamports()? -= game.entry_fee;
    **player.to_account_info().try_borrow_mut_lamports()? += game.entry_fee;
    game.refunded_players.push(player.key());
    
    // Mark game as expired with penalty (creator loses their entry fee)
    if game.status != GameStatus::ExpiredWithPenalty {
        game.status = GameStatus::ExpiredWithPenalty;
        
        let reason = if should_have_started {
            "Creator failed to start game with sufficient players"
        } else {
            "Creator failed to cancel game with insufficient players"
        };
        
        emit!(GameExpiredWithPenalty {
            game_id: game.game_id,
            expired_at: clock.unix_timestamp,
            reason: reason.to_string(),
        });
    }
    
    emit!(ForcedRefundClaimed {
        game_id: game.game_id,
        player: player.key(),
        amount: game.entry_fee,
    });
    
    Ok(())
}

#[derive(Accounts)]
pub struct CreatorCancelGame<'info> {
    #[account(mut)]
    pub game: Account<'info, Game>,
    
    pub creator: Signer<'info>,
}

#[derive(Accounts)]
pub struct ClaimRefund<'info> {
    #[account(mut)]
    pub game: Account<'info, Game>,
    
    #[account(mut)]
    pub player: Signer<'info>,
}

#[derive(Accounts)]
pub struct ForceRefund<'info> {
    #[account(mut)]
    pub game: Account<'info, Game>,
    
    #[account(mut)]
    pub player: Signer<'info>,
}
