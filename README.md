# Port Finance Lending — Revived

> **Solana Graveyard Hackathon Revival** | Track: Migrations ($7K)
>
> This fork brings the abandoned Port Finance lending protocol back to life on modern Solana tooling.
> See [MIGRATION.md](./MIGRATION.md) for the full technical migration guide.

### What's New

- Upgraded from **Solana SDK 1.9** to **1.18+** with Rust 2021 edition
- Replaced dead **Switchboard v1** oracle with deprecation stub
- **2 programs compile and BPF-build** on modern toolchain
- **66/66 tests passing** (token-lending program)
- TypeScript client SDK being built

### Quick Start

```bash
# Prerequisites: Rust, Solana CLI 1.18+
perl -pi -e 's/^version = 4$/version = 3/' Cargo.lock                # BPF compat
cargo build-sbf -- -p port-finance-variable-rate-lending              # Build lending
cargo build-sbf -- -p port-finance-staking                            # Build staking
cargo test -p port-finance-variable-rate-lending                      # Run tests (66 pass)
```

---

*Original README below:*

## Port Variable Rate Lending

![Logo black@4x (1)](https://user-images.githubusercontent.com/9982417/149652968-819cbc9e-06b7-41fe-b0d3-aa016843b570.png)

### Build

```bash
cargo build                                              # Host build
cargo build-sbf -- -p port-finance-variable-rate-lending # BPF build
```

### Test

```bash
cargo test -p port-finance-variable-rate-lending  # 66 tests
cargo test -p port-finance-staking                # Staking tests
```




