// Player entry logic - joining a game

use anchor_lang::prelude::*;
use anchor_lang::solana_program::system_instruction;
use crate::state::{Game, GameStatus};
use crate::events::PlayerJoined;
use crate::errors::GameError;

pub fn enter_game(ctx: Context<EnterGame>) -> Result<()> {
    let game = &mut ctx.accounts.game;
    let player = &ctx.accounts.player;
    let clock = Clock::get()?;
    
    // Validate game state
    require!(
        game.status == GameStatus::WaitingForPlayers,
        GameError::GameNotOpen
    );
    require!(!game.game_started, GameError::GameAlreadyStarted);
    require!(
        game.current_players < game.max_players,
        GameError::GameFull
    );
    require!(
        !game.players.contains(&player.key()),
        GameError::AlreadyJoined
    );
    require!(
        clock.unix_timestamp < game.start_time,
        GameError::GameExpired
    );
    
    // Transfer entry fee to game account
    let transfer_ix = system_instruction::transfer(
        &player.key(),
        &game.key(),
        game.entry_fee,
    );
    
    anchor_lang::solana_program::program::invoke(
        &transfer_ix,
        &[
            player.to_account_info(),
            game.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
        ],
    )?;
    
    // Add player to game
    game.players.push(player.key());
    game.current_players += 1;
    game.prize_pool += game.entry_fee;
    
    // Update status if game is full
    if game.current_players == game.max_players {
        game.status = GameStatus::ReadyToStart;
    }
    
    emit!(PlayerJoined {
        game_id: game.game_id,
        player: player.key(),
        current_players: game.current_players,
    });
    
    Ok(())
}

#[derive(Accounts)]
pub struct EnterGame<'info> {
    #[account(mut)]
    pub game: Account<'info, Game>,
    
    #[account(mut)]
    pub player: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}
