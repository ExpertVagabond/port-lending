import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import {
  Reserve,
  ReserveLiquidity,
  ReserveCollateral,
  ReserveConfig,
  ReserveFees,
  Obligation,
  ObligationCollateral,
  ObligationLiquidity,
  LendingMarket,
  LastUpdate,
  RESERVE_LEN,
  OBLIGATION_LEN,
  LENDING_MARKET_LEN,
  OBLIGATION_COLLATERAL_LEN,
  OBLIGATION_LIQUIDITY_LEN,
  PROGRAM_VERSION,
} from "./types";

// ============================================================================
// Buffer Helpers
// ============================================================================

/** Read a u8 from a buffer at the given offset */
function readU8(buf: Buffer, offset: number): number {
  return buf.readUInt8(offset);
}

/** Read a little-endian u64 from a buffer at the given offset */
function readU64(buf: Buffer, offset: number): BN {
  return new BN(buf.slice(offset, offset + 8), "le");
}

/** Read a little-endian u128 from a buffer at the given offset (used for WAD decimals) */
function readU128(buf: Buffer, offset: number): BN {
  return new BN(buf.slice(offset, offset + 16), "le");
}

/** Read a PublicKey (32 bytes) from a buffer at the given offset */
function readPubkey(buf: Buffer, offset: number): PublicKey {
  return new PublicKey(buf.slice(offset, offset + 32));
}

/** Read a boolean (1 byte) from a buffer at the given offset */
function readBool(buf: Buffer, offset: number): boolean {
  return buf.readUInt8(offset) !== 0;
}

/**
 * Read a COption<Pubkey> in standard layout (4-byte tag + 32-byte pubkey).
 * Returns PublicKey or null.
 */
function readCOptionPubkey(buf: Buffer, offset: number): PublicKey | null {
  const tag = buf.readUInt32LE(offset);
  if (tag === 0) {
    return null;
  }
  return readPubkey(buf, offset + 4);
}

/**
 * Read a COption<Pubkey> in compact layout (1-byte tag + 32-byte pubkey).
 * Returns PublicKey or null.
 */
function readCOptionPubkeyCompact(
  buf: Buffer,
  offset: number
): PublicKey | null {
  const tag = buf.readUInt8(offset);
  if (tag === 0) {
    return null;
  }
  return readPubkey(buf, offset + 1);
}

// ============================================================================
// Account Decoders
// ============================================================================

/**
 * Decode a Reserve account from raw account data.
 *
 * The binary layout matches the Rust `Pack` implementation in
 * `token-lending/program/src/state/reserve.rs` (575 bytes total).
 *
 * @param data - Raw account data buffer (must be at least RESERVE_LEN bytes)
 * @returns Decoded Reserve object
 * @throws Error if data is too short or version is invalid
 */
export function decodeReserve(data: Buffer): Reserve {
  if (data.length < RESERVE_LEN) {
    throw new Error(
      `Reserve data too short: expected ${RESERVE_LEN}, got ${data.length}`
    );
  }

  let offset = 0;

  // version (1)
  const version = readU8(data, offset);
  offset += 1;
  if (version > PROGRAM_VERSION) {
    throw new Error(
      `Reserve version ${version} exceeds program version ${PROGRAM_VERSION}`
    );
  }

  // last_update_slot (8) + last_update_stale (1)
  const lastUpdateSlot = readU64(data, offset);
  offset += 8;
  const lastUpdateStale = readBool(data, offset);
  offset += 1;
  const lastUpdate: LastUpdate = { slot: lastUpdateSlot, stale: lastUpdateStale };

  // lending_market (32)
  const lendingMarket = readPubkey(data, offset);
  offset += 32;

  // liquidity_mint_pubkey (32)
  const liquidityMintPubkey = readPubkey(data, offset);
  offset += 32;

  // liquidity_mint_decimals (1)
  const liquidityMintDecimals = readU8(data, offset);
  offset += 1;

  // liquidity_supply_pubkey (32)
  const liquiditySupplyPubkey = readPubkey(data, offset);
  offset += 32;

  // liquidity_fee_receiver (32)
  const liquidityFeeReceiver = readPubkey(data, offset);
  offset += 32;

  // liquidity_oracle_pubkey (4 + 32 = 36, COption standard layout)
  const liquidityOraclePubkey = readCOptionPubkey(data, offset);
  offset += 36;

  // liquidity_available_amount (8)
  const liquidityAvailableAmount = readU64(data, offset);
  offset += 8;

  // liquidity_borrowed_amount_wads (16)
  const liquidityBorrowedAmountWads = readU128(data, offset);
  offset += 16;

  // liquidity_cumulative_borrow_rate_wads (16)
  const liquidityCumulativeBorrowRateWads = readU128(data, offset);
  offset += 16;

  // liquidity_market_price (16)
  const liquidityMarketPrice = readU128(data, offset);
  offset += 16;

  const liquidity: ReserveLiquidity = {
    mintPubkey: liquidityMintPubkey,
    mintDecimals: liquidityMintDecimals,
    supplyPubkey: liquiditySupplyPubkey,
    feeReceiver: liquidityFeeReceiver,
    oraclePubkey: liquidityOraclePubkey,
    availableAmount: liquidityAvailableAmount,
    borrowedAmountWads: liquidityBorrowedAmountWads,
    cumulativeBorrowRateWads: liquidityCumulativeBorrowRateWads,
    marketPrice: liquidityMarketPrice,
  };

  // collateral_mint_pubkey (32)
  const collateralMintPubkey = readPubkey(data, offset);
  offset += 32;

  // collateral_mint_total_supply (8)
  const collateralMintTotalSupply = readU64(data, offset);
  offset += 8;

  // collateral_supply_pubkey (32)
  const collateralSupplyPubkey = readPubkey(data, offset);
  offset += 32;

  const collateral: ReserveCollateral = {
    mintPubkey: collateralMintPubkey,
    mintTotalSupply: collateralMintTotalSupply,
    supplyPubkey: collateralSupplyPubkey,
  };

  // config fields
  const optimalUtilizationRate = readU8(data, offset);
  offset += 1;
  const loanToValueRatio = readU8(data, offset);
  offset += 1;
  const liquidationBonus = readU8(data, offset);
  offset += 1;
  const liquidationThreshold = readU8(data, offset);
  offset += 1;
  const minBorrowRate = readU8(data, offset);
  offset += 1;
  const optimalBorrowRate = readU8(data, offset);
  offset += 1;
  const maxBorrowRate = readU8(data, offset);
  offset += 1;

  // fees
  const borrowFeeWad = readU64(data, offset);
  offset += 8;
  const flashLoanFeeWad = readU64(data, offset);
  offset += 8;
  const hostFeePercentage = readU8(data, offset);
  offset += 1;

  const fees: ReserveFees = {
    borrowFeeWad,
    flashLoanFeeWad,
    hostFeePercentage,
  };

  // deposit_staking_pool (1 + 32 = 33, COption compact layout)
  const depositStakingPool = readCOptionPubkeyCompact(data, offset);
  offset += 33;

  // deposit_limit (8)
  const depositLimit = readU64(data, offset);
  offset += 8;

  // borrow_limit (8)
  const borrowLimit = readU64(data, offset);
  offset += 8;

  const config: ReserveConfig = {
    optimalUtilizationRate,
    loanToValueRatio,
    liquidationBonus,
    liquidationThreshold,
    minBorrowRate,
    optimalBorrowRate,
    maxBorrowRate,
    fees,
    depositStakingPool,
    depositLimit,
    borrowLimit,
  };

  // remaining 199 bytes are padding

  return {
    version,
    lastUpdate,
    lendingMarket,
    liquidity,
    collateral,
    config,
  };
}

/**
 * Decode an Obligation account from raw account data.
 *
 * The binary layout matches the Rust `Pack` implementation in
 * `token-lending/program/src/state/obligation.rs` (916 bytes total).
 *
 * @param data - Raw account data buffer (must be at least OBLIGATION_LEN bytes)
 * @returns Decoded Obligation object
 * @throws Error if data is too short or version is invalid
 */
export function decodeObligation(data: Buffer): Obligation {
  if (data.length < OBLIGATION_LEN) {
    throw new Error(
      `Obligation data too short: expected ${OBLIGATION_LEN}, got ${data.length}`
    );
  }

  let offset = 0;

  // version (1)
  const version = readU8(data, offset);
  offset += 1;
  if (version > PROGRAM_VERSION) {
    throw new Error(
      `Obligation version ${version} exceeds program version ${PROGRAM_VERSION}`
    );
  }

  // last_update_slot (8) + last_update_stale (1)
  const lastUpdateSlot = readU64(data, offset);
  offset += 8;
  const lastUpdateStale = readBool(data, offset);
  offset += 1;
  const lastUpdate: LastUpdate = { slot: lastUpdateSlot, stale: lastUpdateStale };

  // lending_market (32)
  const lendingMarket = readPubkey(data, offset);
  offset += 32;

  // owner (32)
  const owner = readPubkey(data, offset);
  offset += 32;

  // deposited_value (16)
  const depositedValue = readU128(data, offset);
  offset += 16;

  // borrowed_value (16)
  const borrowedValue = readU128(data, offset);
  offset += 16;

  // allowed_borrow_value (16)
  const allowedBorrowValue = readU128(data, offset);
  offset += 16;

  // unhealthy_borrow_value (16)
  const unhealthyBorrowValue = readU128(data, offset);
  offset += 16;

  // deposits_len (1)
  const depositsLen = readU8(data, offset);
  offset += 1;

  // borrows_len (1)
  const borrowsLen = readU8(data, offset);
  offset += 1;

  // data_flat: collateral entries followed by liquidity entries
  const deposits: ObligationCollateral[] = [];
  for (let i = 0; i < depositsLen; i++) {
    const depositReserve = readPubkey(data, offset);
    offset += 32;
    const depositedAmount = readU64(data, offset);
    offset += 8;
    const marketValue = readU128(data, offset);
    offset += 16;
    deposits.push({ depositReserve, depositedAmount, marketValue });
  }

  const borrows: ObligationLiquidity[] = [];
  for (let i = 0; i < borrowsLen; i++) {
    const borrowReserve = readPubkey(data, offset);
    offset += 32;
    const cumulativeBorrowRateWads = readU128(data, offset);
    offset += 16;
    const borrowedAmountWads = readU128(data, offset);
    offset += 16;
    const marketValue = readU128(data, offset);
    offset += 16;
    borrows.push({
      borrowReserve,
      cumulativeBorrowRateWads,
      borrowedAmountWads,
      marketValue,
    });
  }

  return {
    version,
    lastUpdate,
    lendingMarket,
    owner,
    deposits,
    borrows,
    depositedValue,
    borrowedValue,
    allowedBorrowValue,
    unhealthyBorrowValue,
  };
}

/**
 * Decode a LendingMarket account from raw account data.
 *
 * The binary layout matches the Rust `Pack` implementation in
 * `token-lending/program/src/state/lending_market.rs` (258 bytes total).
 *
 * @param data - Raw account data buffer (must be at least LENDING_MARKET_LEN bytes)
 * @returns Decoded LendingMarket object
 * @throws Error if data is too short or version is invalid
 */
export function decodeLendingMarket(data: Buffer): LendingMarket {
  if (data.length < LENDING_MARKET_LEN) {
    throw new Error(
      `LendingMarket data too short: expected ${LENDING_MARKET_LEN}, got ${data.length}`
    );
  }

  let offset = 0;

  // version (1)
  const version = readU8(data, offset);
  offset += 1;
  if (version > PROGRAM_VERSION) {
    throw new Error(
      `LendingMarket version ${version} exceeds program version ${PROGRAM_VERSION}`
    );
  }

  // bump_seed (1)
  const bumpSeed = readU8(data, offset);
  offset += 1;

  // owner (32)
  const owner = readPubkey(data, offset);
  offset += 32;

  // quote_currency (32)
  const quoteCurrency = new Uint8Array(data.slice(offset, offset + 32));
  offset += 32;

  // token_program_id (32)
  const tokenProgramId = readPubkey(data, offset);
  offset += 32;

  // remaining 160 bytes are padding

  return {
    version,
    bumpSeed,
    owner,
    quoteCurrency,
    tokenProgramId,
  };
}
