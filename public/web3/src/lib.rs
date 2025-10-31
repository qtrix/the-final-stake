// Solana Survivor - A multi-phase survival game on Solana
// Players compete through resource management, PvP challenges, and a final purge
//
// Phase 1: Resource Management - Allocate tokens to different activities
// Phase 2: PvP Challenges - Battle other players in mini-games
// Phase 3: The Purge - Winner-takes-all final game
//
// Created with ❤️ for the Solana ecosystem

use anchor_lang::prelude::*;

// Program ID (update this with your actual program ID after deployment)
declare_id!("2VZKC2kK7AJk1iTc748x1e9zTMp4Uje4dYMhwGBL1mZY");

// Module declarations
pub mod constants;
pub mod errors;
pub mod events;
pub mod state;
pub mod instructions;
pub mod utils;

// Import everything we need
use crate::instructions::*;
use crate::errors::GameError;

#[program]
pub mod solana_survivor {
    use super::*;

    // ==================== INITIALIZATION ====================
    
    /// Initialize the game registry with an admin address
    pub fn initialize(ctx: Context<Initialize>, admin: Pubkey) -> Result<()> {
        instructions::initialize::initialize(ctx, admin)
    }

    // ==================== GAME LIFECYCLE ====================
    
    /// Create a new game
    pub fn create_game(
        ctx: Context<CreateGame>,
        name: String,
        entry_fee: u64,
        max_players: u8,
        start_time: i64,
        game_duration_hours: u8,
    ) -> Result<()> {
        instructions::game_lifecycle::create::create_game(
            ctx,
            name,
            entry_fee,
            max_players,
            start_time,
            game_duration_hours,
        )
    }

    /// Join an existing game
    pub fn enter_game(ctx: Context<EnterGame>) -> Result<()> {
        instructions::game_lifecycle::enter::enter_game(ctx)
    }

    /// Start the game (creator only)
    pub fn start_game(ctx: Context<StartGame>) -> Result<()> {
        instructions::game_lifecycle::start::start_game(ctx)
    }

    /// Creator cancels the game
    pub fn creator_cancel_game(ctx: Context<CreatorCancelGame>) -> Result<()> {
        instructions::game_lifecycle::refund::creator_cancel_game(ctx)
    }

    /// Claim refund from cancelled/expired game
    pub fn claim_refund(ctx: Context<ClaimRefund>) -> Result<()> {
        instructions::game_lifecycle::refund::claim_refund(ctx)
    }

    /// Force refund if creator didn't fulfill obligations
    pub fn force_refund_expired_game(ctx: Context<ForceRefund>) -> Result<()> {
        instructions::game_lifecycle::refund::force_refund_expired_game(ctx)
    }

    // ==================== PHASE 1: RESOURCE MANAGEMENT ====================
    
    /// Initialize player state for Phase 1
    pub fn initialize_player_state(ctx: Context<InitializePlayerState>) -> Result<()> {
        instructions::phase1::initialize::initialize_player_state(ctx)
    }

    /// Initialize global pool state
    pub fn initialize_pool_state(ctx: Context<InitializePoolState>) -> Result<()> {
        instructions::phase1::initialize::initialize_pool_state(ctx)
    }

    /// Submit resource allocations
    pub fn submit_allocations(
        ctx: Context<SubmitAllocations>,
        mining: u64,
        farming: u64,
        trading: u64,
        research: u64,
        social: u64,
    ) -> Result<()> {
        instructions::phase1::allocate::submit_allocations(
            ctx,
            mining,
            farming,
            trading,
            research,
            social,
        )
    }

    /// Claim accumulated rewards
    pub fn claim_rewards(ctx: Context<ClaimRewards>) -> Result<()> {
        instructions::phase1::rewards::claim_rewards(ctx)
    }

    /// Claim phase end rewards and apply penalties
    pub fn claim_phase_end_rewards(ctx: Context<ClaimPhaseEndRewards>) -> Result<()> {
        instructions::phase1::rewards::claim_phase_end_rewards(ctx)
    }

    /// Advance to next phase
    pub fn advance_phase(ctx: Context<AdvancePhase>) -> Result<()> {
        instructions::phase2::advance::advance_phase(ctx)
    }

    // ==================== PHASE 2: PVP CHALLENGES ====================
    
    /// Create a challenge to another player
    pub fn create_challenge(
        ctx: Context<CreateChallenge>,
        opponent: Pubkey,
        timestamp: i64,
        bet_amount: u64,
        game_type: state::MiniGameType,
    ) -> Result<()> {
        instructions::phase2::challenge::create_challenge(
            ctx,
            opponent,
            timestamp,
            bet_amount,
            game_type,
        )
    }

    /// Respond to a challenge
    pub fn respond_challenge(ctx: Context<RespondChallenge>, accept: bool) -> Result<()> {
        instructions::phase2::challenge::respond_challenge(ctx, accept)
    }

    /// Mark ready for mini-game
    pub fn ready_for_game(ctx: Context<ReadyForGame>) -> Result<()> {
        instructions::phase2::minigame::ready_for_game(ctx)
    }

    /// Start the mini-game
    pub fn start_mini_game(ctx: Context<StartMiniGame>) -> Result<()> {
        instructions::phase2::minigame::start_mini_game(ctx)
    }

    /// Claim mini-game victory
    pub fn claim_mini_game_win(ctx: Context<ClaimMiniGameWin>, winner: Pubkey) -> Result<()> {
        instructions::phase2::minigame::claim_mini_game_win(ctx, winner)
    }

    // ==================== PHASE 3: THE PURGE ====================
    
    /// Advance to Phase 3
    pub fn advance_to_phase3(ctx: Context<AdvanceToPhase3>) -> Result<()> {
        instructions::phase3::start::advance_to_phase3(ctx)
    }

    /// Mark yourself ready for the purge
    pub fn mark_ready_phase3(ctx: Context<MarkReadyPhase3>) -> Result<()> {
        instructions::phase3::ready::mark_ready_phase3(ctx)
    }

    /// Start the purge
    pub fn start_phase3_game<'info>(
        ctx: Context<'_, '_, 'info, 'info, StartPhase3Game<'info>>
    ) -> Result<()> {
        instructions::phase3::start::start_phase3_game(ctx)
    }

    /// Submit the purge winner
    pub fn submit_phase3_winner(ctx: Context<SubmitPhase3Winner>, winner: Pubkey) -> Result<()> {
        instructions::phase3::start::submit_phase3_winner(ctx, winner)
    }

    /// Winner claims the prize
    pub fn claim_phase3_prize(ctx: Context<ClaimPhase3Prize>) -> Result<()> {
        instructions::phase3::claim::claim_phase3_prize(ctx)
    }

    /// Admin/creator collects platform fee
    pub fn claim_platform_fee(ctx: Context<ClaimPlatformFee>) -> Result<()> {
        instructions::phase3::claim::claim_platform_fee(ctx)
    }

    // ==================== ADMIN FUNCTIONS ====================
    
    /// Admin emergency game start
    pub fn admin_start_game(ctx: Context<AdminStartGame>) -> Result<()> {
        instructions::admin::game_control::admin_start_game(ctx)
    }

    /// Admin force phase advancement
    pub fn admin_advance_phase(ctx: Context<AdminAdvancePhase>) -> Result<()> {
        instructions::admin::game_control::admin_advance_phase(ctx)
    }

    /// Admin closes purge with no ready players
    pub fn admin_close_purge_no_ready<'info>(
        ctx: Context<'_, '_, 'info, 'info, AdminClosePurgeNoReady<'info>>
    ) -> Result<()> {
        instructions::admin::game_control::admin_close_purge_no_ready(ctx)
    }
}
