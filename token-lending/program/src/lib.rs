#![deny(missing_docs)]
#![deny(clippy::arithmetic_side_effects)]
#![deny(clippy::integer_division)]
#![forbid(unsafe_code)]

//! A lending program for the Solana blockchain.
//!
//! Security: arithmetic overflow checks enforced via clippy lints.
//! All account validation is performed in the processor module before
//! any state mutation. See `processor.rs` for account constraint checks.

pub mod entrypoint;
pub mod error;
pub mod instruction;
pub mod math;
pub mod processor;
pub mod pyth;
pub mod state;

// Export current sdk types for downstream users building with a different sdk version
pub use solana_program;

solana_program::declare_id!("Port7uDYB3wk6GJAw4KT1WpTeMtSu9bTcChBHkX2LfR");
