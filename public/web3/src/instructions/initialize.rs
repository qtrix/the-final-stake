// Registry initialization - sets up the admin and game counter

use anchor_lang::prelude::*;
use crate::state::GameRegistry;
use crate::constants::REGISTRY_SIZE;

/// Initialize the game registry with an admin address
/// This should only be called once during program deployment
pub fn initialize(ctx: Context<Initialize>, admin: Pubkey) -> Result<()> {
    let game_registry = &mut ctx.accounts.game_registry;
    
    game_registry.game_count = 0;
    game_registry.total_games_created = 0;
    game_registry.admin = admin;
    
    msg!("Game Registry initialized with admin: {}", admin);
    
    Ok(())
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = REGISTRY_SIZE,
        seeds = [b"game_registry"],
        bump
    )]
    pub game_registry: Account<'info, GameRegistry>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}
