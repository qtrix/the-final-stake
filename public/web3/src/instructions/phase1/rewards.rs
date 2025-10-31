// Phase 1 reward claiming - calculate and distribute earnings from resource allocations

use anchor_lang::prelude::*;
use crate::state::{Game, PlayerGameState, GamePoolState};
use crate::events::Phase2PenaltyApplied;
use crate::errors::GameError;
use crate::utils::{get_effective_claim_time, seconds_to_hours};
use crate::constants::{
    MINING_BASE_RATE,
    FARMING_BASE_RATE,
    SOCIAL_BASE_RATE,
};

/// Claim accumulated rewards from Phase 1 activities
pub fn claim_rewards(ctx: Context<ClaimRewards>) -> Result<()> {
    let player_state = &mut ctx.accounts.player_state;
    let pool_state = &ctx.accounts.pool_state;
    let game = &ctx.accounts.game;
    let clock = Clock::get()?;
    
    // Only works in Phase 1
    require!(game.current_phase == 1, GameError::InvalidPhase);
    
    // Skip if no allocation
    if !player_state.has_active_allocation {
        return Ok(());
    }
    
    // Calculate time elapsed since last claim
    let current_time = clock.unix_timestamp;
    let phase_end = game.phase_end_time;
    let effective_time = get_effective_claim_time(current_time, phase_end);
    let time_elapsed = effective_time - player_state.last_claim_time;
    
    if time_elapsed <= 0 {
        return Ok(());
    }
    
    let hours_elapsed = seconds_to_hours(time_elapsed);
    let mut total_rewards: u64 = 0;
    
    // Mining rewards - slows with competition
    if player_state.allocations.mining > 0 {
        let difficulty_factor = pool_state.get_mining_difficulty_factor();
        let mining_rate = MINING_BASE_RATE * difficulty_factor;
        total_rewards += (player_state.allocations.mining as f64 
            * mining_rate 
            * hours_elapsed) as u64;
    }
    
    // Farming rewards - seasonal multiplier
    if player_state.allocations.farming > 0 {
        let season_multiplier = pool_state.get_farming_multiplier();
        let farming_rate = FARMING_BASE_RATE * season_multiplier;
        total_rewards += (player_state.allocations.farming as f64 
            * farming_rate 
            * hours_elapsed) as u64;
    }
    
    // Trading rewards - can be negative!
    if player_state.allocations.trading > 0 {
        let market_multiplier = pool_state.get_trading_multiplier();
        let result = player_state.allocations.trading as f64 
            * market_multiplier 
            * hours_elapsed;
        
        if result > 0.0 {
            total_rewards += result as u64;
        }
        // Note: negative results mean losing tokens, but we don't deduct here
        // to keep the logic simple. Could be added in future versions.
    }
    
    // Social rewards - collaboration bonus
    if player_state.allocations.social > 0 {
        let collaboration_multiplier = pool_state.get_social_multiplier();
        let social_rate = SOCIAL_BASE_RATE * collaboration_multiplier;
        total_rewards += (player_state.allocations.social as f64 
            * social_rate 
            * hours_elapsed) as u64;
    }
    
    // Update player state
    player_state.virtual_balance += total_rewards;
    player_state.total_earned += total_rewards;
    player_state.last_claim_time = effective_time;
    
    Ok(())
}

/// Claim end-of-phase rewards and apply penalties
pub fn claim_phase_end_rewards(ctx: Context<ClaimPhaseEndRewards>) -> Result<()> {
    let player_state = &mut ctx.accounts.player_state;
    let game = &ctx.accounts.game;
    
    // Must be past Phase 1
    require!(game.current_phase > 1, GameError::PhaseNotEnded);
    
    let phase_just_ended = game.current_phase - 1;
    
    // Apply Phase 2 penalty if requirements not met
    if phase_just_ended == 2 && !player_state.phase2_penalty_applied {
        let required_games = game.phase2_required_games;
        let requirement_met = player_state.check_phase2_requirement(required_games);
        
        if !requirement_met {
            // Lose 50% of balance as penalty!
            let penalty = player_state.virtual_balance / 2;
            player_state.virtual_balance -= penalty;
            player_state.phase2_penalty_applied = true;
            
            emit!(Phase2PenaltyApplied {
                player: player_state.player,
                games_played: player_state.phase2_games_played,
                required_games,
                penalty_amount: penalty,
            });
        } else {
            player_state.phase2_requirement_met = true;
        }
    }
    
    Ok(())
}

#[derive(Accounts)]
pub struct ClaimRewards<'info> {
    #[account(mut)]
    pub player_state: Account<'info, PlayerGameState>,
    
    pub pool_state: Account<'info, GamePoolState>,
    
    pub game: Account<'info, Game>,
    
    pub player: Signer<'info>,
}

#[derive(Accounts)]
pub struct ClaimPhaseEndRewards<'info> {
    #[account(mut)]
    pub player_state: Account<'info, PlayerGameState>,
    
    pub pool_state: Account<'info, GamePoolState>,
    
    pub game: Account<'info, Game>,
    
    pub player: Signer<'info>,
}
