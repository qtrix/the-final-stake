// Instructions module - contains all program instructions organized by functionality

pub mod initialize;
pub mod game_lifecycle;
pub mod phase1;
pub mod phase2;
pub mod phase3;
pub mod admin;

// Re-export all instruction contexts for easy access
pub use initialize::*;
pub use game_lifecycle::*;
pub use phase1::*;
pub use phase2::*;
pub use phase3::*;
pub use admin::*;
