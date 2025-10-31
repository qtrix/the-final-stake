// Game start logic - transitioning from waiting to active

use anchor_lang::prelude::*;
use crate::state::{Game, GameStatus};
use crate::events::GameStarted;
use crate::errors::GameError;
use crate::constants::{MIN_PLAYERS_TO_START, GAME_START_GRACE_PERIOD, PHASE_ADVANCE_BUFFER};

pub fn start_game(ctx: Context<StartGame>) -> Result<()> {
    let game = &mut ctx.accounts.game;
    let clock = Clock::get()?;
    
    // Only creator can start
    require!(
        game.creator == ctx.accounts.creator.key(),
        GameError::NotCreator
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
    
    // Check 30-minute start window
    let start_deadline = game.start_time + GAME_START_GRACE_PERIOD;
    require!(
        clock.unix_timestamp <= start_deadline,
        GameError::StartWindowExpired
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

#[derive(Accounts)]
pub struct StartGame<'info> {
    #[account(mut)]
    pub game: Account<'info, Game>,
    
    pub creator: Signer<'info>,
}
