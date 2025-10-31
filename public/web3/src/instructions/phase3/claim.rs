// Phase 3 prize claiming - winner collects the prize pool

use anchor_lang::prelude::*;
use crate::state::{Game, GameStatus};
use crate::events::Phase3PrizeClaimed;
use crate::errors::GameError;

/// Winner claims the prize pool
pub fn claim_phase3_prize(ctx: Context<ClaimPhase3Prize>) -> Result<()> {
    let game = &mut ctx.accounts.game;
    let winner = &ctx.accounts.winner;
    
    // Validate game state
    require!(game.current_phase == 3, GameError::InvalidPhase);
    require!(
        game.status == GameStatus::Completed,
        GameError::GameNotCompleted
    );
    require!(game.phase3_winner.is_some(), GameError::NoWinnerDeclared);
    require!(!game.phase3_prize_claimed, GameError::AlreadyClaimed);
    
    // Verify this is the winner
    let winner_pubkey = game.phase3_winner.unwrap();
    require!(winner_pubkey == winner.key(), GameError::NotWinner);
    
    // Calculate prize after platform fee
    require!(
        game.prize_pool > game.platform_fee_collected,
        GameError::NoPrizeToCollect
    );
    
    let prize_amount = game.prize_pool
        .checked_sub(game.platform_fee_collected)
        .ok_or(GameError::NoPrizeToCollect)?;
    
    require!(prize_amount > 0, GameError::NoPrizeToCollect);
    
    // Transfer prize to winner
    **game.to_account_info().try_borrow_mut_lamports()? -= prize_amount;
    **winner.to_account_info().try_borrow_mut_lamports()? += prize_amount;
    
    game.phase3_prize_claimed = true;
    game.prize_pool = 0;
    
    emit!(Phase3PrizeClaimed {
        game_id: game.game_id,
        winner: winner.key(),
        amount: prize_amount,
    });
    
    Ok(())
}

/// Admin/creator collects the platform fee
pub fn claim_platform_fee(ctx: Context<ClaimPlatformFee>) -> Result<()> {
    let game = &mut ctx.accounts.game;
    
    // Only creator can collect (in production, use game_registry.admin)
    require!(
        ctx.accounts.admin.key() == game.creator,
        GameError::Unauthorized
    );
    
    let fee_amount = game.platform_fee_collected;
    require!(fee_amount > 0, GameError::NoFeeToCollect);
    
    // Transfer fee to admin
    **game.to_account_info().try_borrow_mut_lamports()? -= fee_amount;
    **ctx.accounts.admin.to_account_info().try_borrow_mut_lamports()? += fee_amount;
    
    game.platform_fee_collected = 0;
    
    Ok(())
}

#[derive(Accounts)]
pub struct ClaimPhase3Prize<'info> {
    #[account(mut)]
    pub game: Account<'info, Game>,
    
    #[account(mut)]
    pub winner: Signer<'info>,
}

#[derive(Accounts)]
pub struct ClaimPlatformFee<'info> {
    #[account(mut)]
    pub game: Account<'info, Game>,
    
    #[account(mut)]
    pub admin: Signer<'info>,
}
