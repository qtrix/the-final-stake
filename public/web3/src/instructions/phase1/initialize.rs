// Phase 1 initialization - setting up player and pool states

use anchor_lang::prelude::*;
use crate::state::{Game, PlayerGameState, GamePoolState, ResourceAllocations};
use crate::errors::GameError;
use crate::constants::{PLAYER_STATE_SIZE, POOL_STATE_SIZE, INITIAL_BALANCE_MULTIPLIER};

/// Initialize player state when they first join Phase 1
pub fn initialize_player_state(ctx: Context<InitializePlayerState>) -> Result<()> {
    let player_state = &mut ctx.accounts.player_state;
    let game = &ctx.accounts.game;
    
    require!(game.game_started, GameError::GameNotStarted);
    require!(
        game.players.contains(&ctx.accounts.player.key()),
        GameError::NotInGame
    );
    
    player_state.player = ctx.accounts.player.key();
    player_state.game_id = game.game_id;
    player_state.virtual_balance = game.entry_fee * INITIAL_BALANCE_MULTIPLIER;
    player_state.total_earned = 0;
    player_state.last_claim_time = Clock::get()?.unix_timestamp;
    player_state.has_active_allocation = false;
    player_state.allocations = ResourceAllocations::default();
    player_state.phase2_games_played = 0;
    player_state.phase2_games_won = 0;
    player_state.phase2_opponents_played = Vec::new();
    player_state.phase2_requirement_met = false;
    player_state.phase2_penalty_applied = false;
    player_state.phase3_prize_claimed = false;
    
    Ok(())
}

/// Initialize global pool state (usually called once per game)
pub fn initialize_pool_state(ctx: Context<InitializePoolState>) -> Result<()> {
    let pool_state = &mut ctx.accounts.pool_state;
    let game = &ctx.accounts.game;
    let clock = Clock::get()?;
    
    require!(game.game_started, GameError::GameNotStarted);
    
    pool_state.game_id = game.game_id;
    pool_state.mining_pool_total = 0;
    pool_state.farming_pool_total = 0;
    pool_state.trading_pool_total = 0;
    pool_state.research_pool_total = 0;
    pool_state.social_pool_total = 0;
    pool_state.social_pool_participants = 0;
    pool_state.farming_season = 0;
    pool_state.trading_market_state = 1; // Start with normal market
    pool_state.last_event_time = clock.unix_timestamp;
    
    Ok(())
}

#[derive(Accounts)]
pub struct InitializePlayerState<'info> {
    #[account(
        init,
        payer = player,
        space = PLAYER_STATE_SIZE,
        seeds = [
            b"player_state",
            game.game_id.to_le_bytes().as_ref(),
            player.key().as_ref()
        ],
        bump
    )]
    pub player_state: Account<'info, PlayerGameState>,
    
    pub game: Account<'info, Game>,
    
    #[account(mut)]
    pub player: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitializePoolState<'info> {
    #[account(
        init,
        payer = authority,
        space = POOL_STATE_SIZE,
        seeds = [b"pool_state", game.game_id.to_le_bytes().as_ref()],
        bump
    )]
    pub pool_state: Account<'info, GamePoolState>,
    
    pub game: Account<'info, Game>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}
