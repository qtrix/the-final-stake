// Phase 2 mini-game execution - playing and resolving challenges

use anchor_lang::prelude::*;
use crate::state::{Game, PlayerGameState, Challenge, ChallengeStatus};
use crate::events::MiniGameCompleted;
use crate::errors::GameError;

/// Mark player as ready for the mini-game
pub fn ready_for_game(ctx: Context<ReadyForGame>) -> Result<()> {
    let challenge = &mut ctx.accounts.challenge;
    
    require!(
        challenge.status == ChallengeStatus::Accepted 
            || challenge.status == ChallengeStatus::ForcedAccept,
        GameError::InvalidChallengeStatus
    );
    
    let player = ctx.accounts.player.key();
    require!(
        player == challenge.challenger || player == challenge.opponent,
        GameError::NotChallengeParticipant
    );
    
    // Once both are ready, this gets called twice and moves to BothReady
    challenge.status = ChallengeStatus::BothReady;
    
    Ok(())
}

/// Start the mini-game
pub fn start_mini_game(ctx: Context<StartMiniGame>) -> Result<()> {
    let challenge = &mut ctx.accounts.challenge;
    let clock = Clock::get()?;
    
    require!(
        challenge.status == ChallengeStatus::BothReady,
        GameError::InvalidChallengeStatus
    );
    
    challenge.status = ChallengeStatus::InProgress;
    challenge.game_started_at = Some(clock.unix_timestamp);
    
    Ok(())
}

/// Claim victory and transfer tokens
pub fn claim_mini_game_win(ctx: Context<ClaimMiniGameWin>, winner: Pubkey) -> Result<()> {
    let challenge = &mut ctx.accounts.challenge;
    let winner_state = &mut ctx.accounts.winner_state;
    let loser_state = &mut ctx.accounts.loser_state;
    
    require!(
        challenge.status == ChallengeStatus::InProgress,
        GameError::InvalidChallengeStatus
    );
    require!(
        winner == challenge.challenger || winner == challenge.opponent,
        GameError::InvalidWinner
    );
    
    let loser = if winner == challenge.challenger {
        challenge.opponent
    } else {
        challenge.challenger
    };
    
    let bet_amount = challenge.bet_amount;
    
    // Verify loser has enough balance
    require!(
        loser_state.virtual_balance >= bet_amount,
        GameError::InsufficientBalance
    );
    
    // Transfer tokens
    loser_state.virtual_balance -= bet_amount;
    winner_state.virtual_balance += bet_amount;
    
    // Update game statistics
    winner_state.record_game_played(&loser, true)?;
    loser_state.record_game_played(&winner, false)?;
    
    // Mark challenge complete
    challenge.status = ChallengeStatus::Completed;
    challenge.winner = Some(winner);
    
    emit!(MiniGameCompleted {
        challenge_id: challenge.challenge_id,
        winner,
        loser,
        bet_amount,
    });
    
    Ok(())
}

#[derive(Accounts)]
pub struct ReadyForGame<'info> {
    #[account(mut)]
    pub challenge: Account<'info, Challenge>,
    
    pub player: Signer<'info>,
}

#[derive(Accounts)]
pub struct StartMiniGame<'info> {
    #[account(mut)]
    pub challenge: Account<'info, Challenge>,
    
    pub player: Signer<'info>,
}

#[derive(Accounts)]
pub struct ClaimMiniGameWin<'info> {
    #[account(mut)]
    pub challenge: Account<'info, Challenge>,
    
    pub game: Account<'info, Game>,
    
    #[account(mut)]
    pub winner_state: Account<'info, PlayerGameState>,
    
    #[account(mut)]
    pub loser_state: Account<'info, PlayerGameState>,
    
    pub claimer: Signer<'info>,
}
