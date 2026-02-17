# Port Finance Lending — Revival

> Originally built by [Port Finance](https://github.com/port-finance). Revived for the [Solana Graveyard Hackathon](https://solana.com/graveyard-hack) — Migrations Track.

A variable-rate lending protocol for Solana. Deposit assets, earn yield, borrow against collateral — the core DeFi primitive.

## What Changed (Revival)

Port Finance was a Solana lending protocol that shut down, leaving behind a fully-featured but unmaintained codebase. The program was deployed on mainnet at `Port7uDYB3wk6GJAw4KT1WpTeMtSu9bTcChBHkX2LfR` but the protocol is no longer active.

**Our revival work:**
- Updated all transitive Rust dependencies for modern toolchain compatibility (Rust 1.79+)
- Created `getrandom-stub` crate for BPF target compatibility (no OS randomness available)
- Pinned critical deps to avoid MSRV conflicts: blake3, rayon-core, indexmap, time-core
- Regenerated `Cargo.lock` for toolchain compatibility
- Native `cargo check` and `cargo build` pass cleanly on stable Rust
- BPF build in progress — requires Solana SDK 1.8 era platform-tools (Docker approach planned)

**What's in the codebase:**
- **Token Lending Program** (~7,100 lines of Rust): Full lending protocol with reserves, obligations, liquidations, flash loans, rate calculations
- **Staking Program**: PORT token staking with configurable parameters
- **CLI Tools**: Management CLIs for both lending and staking
- Comprehensive test suites, CI configs, and deployment scripts

## Architecture

```
token-lending/
  program/       — On-chain Solana program (SPL-style, not Anchor)
    src/
      processor.rs     — Core instruction handlers
      state/           — Account state (reserves, obligations, lending market)
      instruction.rs   — Instruction definitions
      math/            — Fixed-point math (Rate, Decimal, WAD)
      error.rs         — Custom error types
      pyth.rs          — Pyth oracle integration
  cli/           — Management CLI

staking/
  program/       — PORT token staking program
  cli/           — Staking management CLI
```

## Building

Native build (works on modern Rust):
```bash
cargo build
cargo test
```

BPF build (requires Solana SDK 1.8.x):
```bash
cargo build-bpf
```

## Program ID

```
Port7uDYB3wk6GJAw4KT1WpTeMtSu9bTcChBHkX2LfR
```

## Graveyard Hackathon Context

**Track:** Migrations ($7K prizes)

**Original Protocol:** [Port Finance](https://github.com/port-finance) — a Solana lending protocol that offered variable-rate deposits and borrows. The protocol shut down, leaving a complete but unmaintained implementation.

**Revival Focus:** Modernizing the dependency chain to make this production-quality lending codebase buildable and deployable on current Solana infrastructure. The code is architecturally sound — the challenge is purely toolchain evolution.

## License

Apache-2.0 (preserved from original)
