// Custom error codes for the Solana Survivor program
// These provide clear feedback when transactions fail

use anchor_lang::prelude::*;

#[error_code]
pub enum GameError {
    // Game setup errors
    #[msg("Maximum players must be between 2 and 100")]
    InvalidMaxPlayers,
    
    #[msg("Entry fee must be greater than zero")]
    InvalidEntryFee,
    
    #[msg("Start time must be in the future")]
    InvalidStartTime,
    
    #[msg("Game duration must be between 1 and 24 hours")]
    InvalidGameDuration,
    
    // Game state errors
    #[msg("This game is not accepting new players")]
    GameNotOpen,
    
    #[msg("Game has already started, cannot modify")]
    GameAlreadyStarted,
    
    #[msg("Game is full, no more players can join")]
    GameFull,
    
    #[msg("You've already joined this game")]
    AlreadyJoined,
    
    #[msg("The registration window has closed")]
    GameExpired,
    
    #[msg("Game hasn't started yet")]
    GameNotStarted,
    
    #[msg("Game is not in a cancelled or expired state")]
    GameNotCancelled,
    
    #[msg("Game must be completed before claiming prizes")]
    GameNotCompleted,
    
    // Permission errors
    #[msg("Only the game creator can perform this action")]
    NotCreator,
    
    #[msg("Only the admin can perform this action")]
    NotAdmin,
    
    #[msg("You don't have permission to advance the phase yet")]
    NotAuthorizedToAdvance,
    
    #[msg("You are not authorized to perform this action")]
    Unauthorized,
    
    // Player errors
    #[msg("At least 3 players are required to start the game")]
    NotEnoughPlayers,
    
    #[msg("You are not a participant in this game")]
    NotInGame,
    
    #[msg("You have already claimed your refund")]
    AlreadyRefunded,
    
    #[msg("You don't have enough virtual tokens for this action")]
    InsufficientBalance,
    
    // Phase 1: Resource allocation errors
    #[msg("Your resource allocation doesn't match your total balance")]
    InvalidAllocation,
    
    // Phase 2: Challenge errors
    #[msg("Your opponent must be in the game")]
    OpponentNotInGame,
    
    #[msg("You cannot challenge yourself")]
    CannotChallengeSelf,
    
    #[msg("This challenge is not in the correct state for that action")]
    InvalidChallengeStatus,
    
    #[msg("Only the challenged player can respond")]
    NotChallengeOpponent,
    
    #[msg("You are not part of this challenge")]
    NotChallengeParticipant,
    
    #[msg("The specified winner is not valid for this challenge")]
    InvalidWinner,
    
    #[msg("You've played the maximum number of games against this opponent")]
    MaxGamesPerOpponentReached,
    
    #[msg("You didn't meet the minimum game requirement for Phase 2")]
    Phase2RequirementNotMet,
    
    // Phase 3: Purge errors
    #[msg("The purge has already started")]
    Phase3AlreadyStarted,
    
    #[msg("The purge hasn't started yet")]
    Phase3NotStarted,
    
    #[msg("The deadline to mark yourself ready has passed")]
    ReadyDeadlineExpired,
    
    #[msg("The ready period hasn't ended yet")]
    ReadyPeriodNotExpired,
    
    #[msg("Could not find a ready player")]
    ReadyPlayerNotFound,
    
    #[msg("A winner has already been declared")]
    WinnerAlreadyDeclared,
    
    #[msg("No winner has been declared yet")]
    NoWinnerDeclared,
    
    #[msg("You are not the winner of this game")]
    NotWinner,
    
    #[msg("There is no prize to collect")]
    NoPrizeToCollect,
    
    #[msg("The prize has already been claimed")]
    AlreadyClaimed,
    
    // Phase errors
    #[msg("This action is not allowed in the current phase")]
    InvalidPhase,
    
    #[msg("The current phase hasn't ended yet")]
    PhaseNotEnded,
    
    #[msg("Only the creator can advance before the buffer period")]
    OnlyCreatorCanAdvanceEarly,
    
    // Timing window errors
    #[msg("The 30-minute start window has expired")]
    StartWindowExpired,
    
    #[msg("The cancellation window has closed")]
    CancelWindowExpired,
    
    #[msg("Refunds are not available yet, wait 30 minutes after start time")]
    RefundNotYetAvailable,
    
    #[msg("Conditions for refund are not met")]
    InvalidRefundCondition,
    
    #[msg("The creator forfeited their funds by not fulfilling obligations")]
    CreatorForfeitedFunds,
    
    // Admin errors
    #[msg("Cannot redistribute - some players marked themselves ready")]
    SomePlayersReady,
    
    #[msg("No eligible players found for redistribution")]
    NoPurgePlayersFound,
    
    // Platform fee errors
    #[msg("No platform fees available to collect")]
    NoFeeToCollect,
    
    // Math errors
    #[msg("Calculation error occurred")]
    InvalidCalculation,
    
    #[msg("Math operation would overflow")]
    MathOverflow,
}
