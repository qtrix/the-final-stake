// Phase 1 resource allocation - players distribute tokens across activities

use anchor_lang::prelude::*;
use crate::state::{Game, PlayerGameState, GamePoolState, ResourceAllocations};
use crate::errors::GameError;

/// Submit or update resource allocations for Phase 1
/// Players must allocate exactly their total balance across activities
pub fn submit_allocations(
    ctx: Context<SubmitAllocations>,
    mining: u64,
    farming: u64,
    trading: u64,
    research: u64,
    social: u64,
) -> Result<()> {
    let player_state = &mut ctx.accounts.player_state;
    let pool_state = &mut ctx.accounts.pool_state;
    let game = &ctx.accounts.game;
    
    // Only allowed in Phase 1
    require!(game.current_phase == 1, GameError::InvalidPhase);
    
    // Total must match player's balance
    let total = mining + farming + trading + research + social;
    require!(
        total == player_state.virtual_balance,
        GameError::InvalidAllocation
    );
    
    // Remove old allocations from pools if updating
    if player_state.has_active_allocation {
        pool_state.mining_pool_total -= player_state.allocations.mining;
        pool_state.farming_pool_total -= player_state.allocations.farming;
        pool_state.trading_pool_total -= player_state.allocations.trading;
        pool_state.research_pool_total -= player_state.allocations.research;
        pool_state.social_pool_total -= player_state.allocations.social;
        
        if player_state.allocations.social > 0 {
            pool_state.social_pool_participants = 
                pool_state.social_pool_participants.saturating_sub(1);
        }
    }
    
    // Apply new allocations
    player_state.allocations = ResourceAllocations {
        mining,
        farming,
        trading,
        research,
        social,
    };
    player_state.has_active_allocation = true;
    
    // Update pools
    pool_state.mining_pool_total += mining;
    pool_state.farming_pool_total += farming;
    pool_state.trading_pool_total += trading;
    pool_state.research_pool_total += research;
    pool_state.social_pool_total += social;
    
    if social > 0 {
        pool_state.social_pool_participants += 1;
    }
    
    Ok(())
}

#[derive(Accounts)]
pub struct SubmitAllocations<'info> {
    #[account(mut)]
    pub player_state: Account<'info, PlayerGameState>,
    
    #[account(mut)]
    pub pool_state: Account<'info, GamePoolState>,
    
    pub game: Account<'info, Game>,
    
    pub player: Signer<'info>,
}
