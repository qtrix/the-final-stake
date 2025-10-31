// Phase 2 challenge system - creating and responding to PvP challenges

use anchor_lang::prelude::*;
use crate::state::{Game, PlayerGameState, Challenge, ChallengeStatus, MiniGameType};
use crate::events::ChallengeCreated;
use crate::errors::GameError;
use crate::constants::{CHALLENGE_SIZE, MAX_OPPONENT_DECLINES};

/// Create a challenge to another player
pub fn create_challenge(
    ctx: Context<CreateChallenge>,
    opponent: Pubkey,
    timestamp: i64,
    bet_amount: u64,
    game_type: MiniGameType,
) -> Result<()> {
    let challenge = &mut ctx.accounts.challenge;
    let game = &ctx.accounts.game;
    let player_state = &ctx.accounts.player_state;
    
    // Validate phase and game state
    require!(game.current_phase == 2, GameError::InvalidPhase);
    require!(
        player_state.virtual_balance >= bet_amount,
        GameError::InsufficientBalance
    );
    require!(
        game.players.contains(&opponent),
        GameError::OpponentNotInGame
    );
    require!(
        opponent != ctx.accounts.challenger.key(),
        GameError::CannotChallengeSelf
    );
    
    // Check opponent limit
    require!(
        player_state.can_challenge_opponent(
            &opponent,
            game.phase2_max_games_per_opponent
        ),
        GameError::MaxGamesPerOpponentReached
    );
    
    // Initialize challenge
    challenge.challenge_id = timestamp as u64;
    challenge.game_id = game.game_id;
    challenge.challenger = ctx.accounts.challenger.key();
    challenge.opponent = opponent;
    challenge.bet_amount = bet_amount;
    challenge.game_type = game_type;
    challenge.status = ChallengeStatus::Pending;
    challenge.created_at = timestamp;
    challenge.accepted_at = None;
    challenge.game_started_at = None;
    challenge.winner = None;
    challenge.opponent_decline_count = 0;
    
    emit!(ChallengeCreated {
        challenge_id: challenge.challenge_id,
        game_id: game.game_id,
        challenger: challenge.challenger,
        opponent: challenge.opponent,
        bet_amount: challenge.bet_amount,
    });
    
    Ok(())
}

/// Respond to a challenge (accept or decline)
pub fn respond_challenge(ctx: Context<RespondChallenge>, accept: bool) -> Result<()> {
    let challenge = &mut ctx.accounts.challenge;
    let opponent_state = &ctx.accounts.opponent_state;
    let clock = Clock::get()?;
    
    require!(
        challenge.status == ChallengeStatus::Pending,
        GameError::InvalidChallengeStatus
    );
    require!(
        challenge.opponent == ctx.accounts.opponent.key(),
        GameError::NotChallengeOpponent
    );
    
    if accept {
        // Check opponent has enough balance
        require!(
            opponent_state.virtual_balance >= challenge.bet_amount,
            GameError::InsufficientBalance
        );
        
        challenge.status = ChallengeStatus::Accepted;
        challenge.accepted_at = Some(clock.unix_timestamp);
    } else {
        // Track declines - after 5, challenge is forced
        challenge.opponent_decline_count += 1;
        
        if challenge.opponent_decline_count >= MAX_OPPONENT_DECLINES {
            challenge.status = ChallengeStatus::ForcedAccept;
        }
    }
    
    Ok(())
}

#[derive(Accounts)]
#[instruction(opponent_key: Pubkey, timestamp: i64)]
pub struct CreateChallenge<'info> {
    #[account(
        init,
        payer = challenger,
        space = CHALLENGE_SIZE,
        seeds = [
            b"challenge",
            game.game_id.to_le_bytes().as_ref(),
            challenger.key().as_ref(),
            opponent_key.as_ref(),
            timestamp.to_le_bytes().as_ref()
        ],
        bump
    )]
    pub challenge: Account<'info, Challenge>,
    
    pub game: Account<'info, Game>,
    
    pub player_state: Account<'info, PlayerGameState>,
    
    #[account(mut)]
    pub challenger: Signer<'info>,
    
    /// CHECK: Validated in instruction
    pub opponent: UncheckedAccount<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RespondChallenge<'info> {
    #[account(mut)]
    pub challenge: Account<'info, Challenge>,
    
    pub game: Account<'info, Game>,
    
    pub opponent_state: Account<'info, PlayerGameState>,
    
    pub opponent: Signer<'info>,
}
