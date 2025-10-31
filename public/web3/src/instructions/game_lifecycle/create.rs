// Game creation logic

use anchor_lang::prelude::*;
use crate::state::{Game, GameRegistry, GameStatus, PhaseDurations};
use crate::events::GameCreated;
use crate::errors::GameError;
use crate::constants::{MIN_PLAYERS_TO_START, MAX_PLAYERS_ALLOWED, GAME_ACCOUNT_SIZE, GAME_START_GRACE_PERIOD};

pub fn create_game(
    ctx: Context<CreateGame>,
    name: String,
    entry_fee: u64,
    max_players: u8,
    start_time: i64,
    game_duration_hours: u8,
) -> Result<()> {
    let game = &mut ctx.accounts.game;
    let game_registry = &mut ctx.accounts.game_registry;
    let clock = Clock::get()?;
    
    // Validate inputs
    require!(
        max_players >= MIN_PLAYERS_TO_START && max_players <= MAX_PLAYERS_ALLOWED,
        GameError::InvalidMaxPlayers
    );
    require!(entry_fee > 0, GameError::InvalidEntryFee);
    require!(start_time > clock.unix_timestamp, GameError::InvalidStartTime);
    
    // Initialize game state
    game.game_id = game_registry.next_game_id();
    game.name = name;
    game.creator = ctx.accounts.creator.key();
    game.entry_fee = entry_fee;
    game.max_players = max_players;
    game.current_players = 0;
    game.start_time = start_time;
    game.expire_time = start_time + GAME_START_GRACE_PERIOD;
    game.status = GameStatus::WaitingForPlayers;
    game.prize_pool = 0;
    game.players = Vec::new();
    game.game_started = false;
    game.refunded_players = Vec::new();
    
    // Phase configuration
    game.current_phase = 0;
    game.phase_start_time = 0;
    game.phase_end_time = 0;
    game.phase_advance_deadline = 0;
    
    let total_duration = (game_duration_hours as u64) * 3600;
    game.phases = PhaseDurations {
        phase1_duration: total_duration / 3,
        phase2_duration: total_duration / 3,
        phase3_duration: total_duration / 3,
    };
    
    // Calculate Phase 2 requirements
    let (required_games, max_per_opponent) = game.calculate_phase2_requirements();
    game.phase2_required_games = required_games;
    game.phase2_max_games_per_opponent = max_per_opponent;
    
    // Phase 3 initialization
    game.phase3_ready_deadline = 0;
    game.phase3_extended_deadline = 0;
    game.phase3_players_ready = 0;
    game.phase3_started = false;
    game.phase3_winner = None;
    game.phase3_prize_claimed = false;
    
    game.platform_fee_collected = 0;
    
    emit!(GameCreated {
        game_id: game.game_id,
        creator: game.creator,
        entry_fee: game.entry_fee,
        max_players: game.max_players,
        start_time: game.start_time,
        phase2_required_games: required_games,
        phase2_max_games_per_opponent: max_per_opponent,
    });
    
    Ok(())
}

#[derive(Accounts)]
pub struct CreateGame<'info> {
    #[account(
        init,
        payer = creator,
        space = GAME_ACCOUNT_SIZE,
        seeds = [b"game", game_registry.game_count.to_le_bytes().as_ref()],
        bump
    )]
    pub game: Account<'info, Game>,
    
    #[account(mut, seeds = [b"game_registry"], bump)]
    pub game_registry: Account<'info, GameRegistry>,
    
    #[account(mut)]
    pub creator: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}
