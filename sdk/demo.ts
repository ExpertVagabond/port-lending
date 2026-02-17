/**
 * Port Finance Lending SDK -- Demo Script
 *
 * Demonstrates that the TypeScript SDK compiles and works correctly
 * without any network connection.  Run with:
 *
 *   npx ts-node demo.ts
 *   # or
 *   npx tsx demo.ts
 *
 * Covers:
 *   1. Program IDs
 *   2. Instruction builders (initReserve, depositReserveLiquidity, etc.)
 *   3. State decoders with mock buffer data
 *   4. PDA derivation
 */

import { Keypair, PublicKey } from "@solana/web3.js";
import BN from "bn.js";

import {
  // Program IDs
  LENDING_PROGRAM_ID,
  STAKING_PROGRAM_ID,

  // Constants
  PROGRAM_VERSION,
  RESERVE_LEN,
  OBLIGATION_LEN,
  LENDING_MARKET_LEN,
  MAX_OBLIGATION_RESERVES,
  LIQUIDATION_CLOSE_FACTOR,
  WAD,

  // State decoders
  decodeReserve,
  decodeObligation,
  decodeLendingMarket,

  // Instruction builders
  deriveLendingMarketAuthority,
  initReserve,
  depositReserveLiquidity,
  redeemReserveCollateral,
  initObligation,
  refreshReserve,
  refreshObligation,
  borrowObligationLiquidity,
  repayObligationLiquidity,
  liquidateObligation,
  depositObligationCollateral,
  withdrawObligationCollateral,
  depositReserveLiquidityAndObligationCollateral,
} from "./src";

// ============================================================================
// Helpers
// ============================================================================

function section(title: string): void {
  console.log(`\n${"=".repeat(72)}`);
  console.log(`  ${title}`);
  console.log(`${"=".repeat(72)}`);
}

function ok(msg: string): void {
  console.log(`  [OK] ${msg}`);
}

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string): void {
  if (condition) {
    ok(msg);
    passed++;
  } else {
    console.log(`  [FAIL] ${msg}`);
    failed++;
  }
}

// ============================================================================
// 1. Program IDs & Constants
// ============================================================================

section("Program IDs & Constants");

assert(
  LENDING_PROGRAM_ID.toBase58() === "Port7uDYB3wk6GJAw4KT1WpTeMtSu9bTcChBHkX2LfR",
  `Lending Program ID: ${LENDING_PROGRAM_ID.toBase58()}`
);

assert(
  STAKING_PROGRAM_ID.toBase58() === "stkarvwmSzv2BygN5e2LeTwimTczLWHCKPKGC2zVLiq",
  `Staking Program ID: ${STAKING_PROGRAM_ID.toBase58()}`
);

assert(PROGRAM_VERSION === 1, `Program version: ${PROGRAM_VERSION}`);
assert(RESERVE_LEN === 575, `Reserve account size: ${RESERVE_LEN} bytes`);
assert(OBLIGATION_LEN === 916, `Obligation account size: ${OBLIGATION_LEN} bytes`);
assert(LENDING_MARKET_LEN === 258, `LendingMarket account size: ${LENDING_MARKET_LEN} bytes`);
assert(MAX_OBLIGATION_RESERVES === 10, `Max obligation reserves: ${MAX_OBLIGATION_RESERVES}`);
assert(LIQUIDATION_CLOSE_FACTOR === 50, `Liquidation close factor: ${LIQUIDATION_CLOSE_FACTOR}%`);
assert(WAD.toString() === "1000000000000000000", `WAD constant: ${WAD.toString()}`);

// ============================================================================
// 2. PDA Derivation
// ============================================================================

section("PDA Derivation");

const lendingMarketKey = Keypair.generate().publicKey;
const [authority, bump] = deriveLendingMarketAuthority(lendingMarketKey);
assert(
  authority instanceof PublicKey && typeof bump === "number",
  `Derived lending market authority: ${authority.toBase58()} (bump ${bump})`
);

// ============================================================================
// 3. Instruction Builders
// ============================================================================

section("Instruction Builders");

// Generate fresh keypairs for all accounts needed in demos
const keys = Object.fromEntries(
  [
    "sourceLiquidity",
    "destinationCollateral",
    "reserve",
    "reserveLiquidityMint",
    "reserveLiquiditySupply",
    "reserveLiquidityFeeReceiver",
    "reserveCollateralMint",
    "reserveCollateralSupply",
    "lendingMarket",
    "lendingMarketOwner",
    "userTransferAuthority",
    "oracle",
    "obligation",
    "obligationOwner",
    "sourceCollateral",
    "destinationLiquidity",
    "borrowReserve",
    "repayReserve",
    "withdrawReserve",
    "withdrawReserveCollateralSupply",
    "userCollateral",
    "destinationDepositCollateral",
    "repayReserveLiquiditySupply",
  ].map((name) => [name, Keypair.generate().publicKey])
);

// 3a. InitReserve
const initReserveIx = initReserve({
  liquidityAmount: new BN(1_000_000_000),
  config: {
    optimalUtilizationRate: 80,
    loanToValueRatio: 75,
    liquidationBonus: 5,
    liquidationThreshold: 85,
    minBorrowRate: 1,
    optimalBorrowRate: 8,
    maxBorrowRate: 30,
    fees: {
      borrowFeeWad: new BN("10000000000000"),
      flashLoanFeeWad: new BN("30000000000000"),
      hostFeePercentage: 20,
    },
    depositStakingPool: null,
    depositLimit: new BN("18446744073709551615"), // u64::MAX
    borrowLimit: new BN("18446744073709551615"),
  },
  sourceLiquidity: keys.sourceLiquidity,
  destinationCollateral: keys.destinationCollateral,
  reserve: keys.reserve,
  reserveLiquidityMint: keys.reserveLiquidityMint,
  reserveLiquiditySupply: keys.reserveLiquiditySupply,
  reserveLiquidityFeeReceiver: keys.reserveLiquidityFeeReceiver,
  reserveCollateralMint: keys.reserveCollateralMint,
  reserveCollateralSupply: keys.reserveCollateralSupply,
  lendingMarket: keys.lendingMarket,
  lendingMarketOwner: keys.lendingMarketOwner,
  userTransferAuthority: keys.userTransferAuthority,
  oraclePrice: keys.oracle,
});
assert(
  initReserveIx.programId.equals(LENDING_PROGRAM_ID) && initReserveIx.keys.length === 16,
  `initReserve: ${initReserveIx.keys.length} accounts, ${initReserveIx.data.length} bytes data`
);

// 3b. DepositReserveLiquidity
const depositIx = depositReserveLiquidity({
  liquidityAmount: new BN(500_000_000),
  sourceLiquidity: keys.sourceLiquidity,
  destinationCollateral: keys.destinationCollateral,
  reserve: keys.reserve,
  reserveLiquiditySupply: keys.reserveLiquiditySupply,
  reserveCollateralMint: keys.reserveCollateralMint,
  lendingMarket: keys.lendingMarket,
  userTransferAuthority: keys.userTransferAuthority,
});
assert(
  depositIx.data[0] === 4 && depositIx.keys.length === 10,
  `depositReserveLiquidity: tag=${depositIx.data[0]}, ${depositIx.keys.length} accounts`
);

// 3c. RedeemReserveCollateral
const redeemIx = redeemReserveCollateral({
  collateralAmount: new BN(250_000_000),
  sourceCollateral: keys.sourceCollateral,
  destinationLiquidity: keys.destinationLiquidity,
  reserve: keys.reserve,
  reserveCollateralMint: keys.reserveCollateralMint,
  reserveLiquiditySupply: keys.reserveLiquiditySupply,
  lendingMarket: keys.lendingMarket,
  userTransferAuthority: keys.userTransferAuthority,
});
assert(
  redeemIx.data[0] === 5 && redeemIx.keys.length === 10,
  `redeemReserveCollateral: tag=${redeemIx.data[0]}, ${redeemIx.keys.length} accounts`
);

// 3d. InitObligation
const initObligationIx = initObligation({
  obligation: keys.obligation,
  lendingMarket: keys.lendingMarket,
  obligationOwner: keys.obligationOwner,
});
assert(
  initObligationIx.data[0] === 6 && initObligationIx.data.length === 1,
  `initObligation: tag=${initObligationIx.data[0]}, ${initObligationIx.keys.length} accounts`
);

// 3e. RefreshReserve (with and without oracle)
const refreshReserveIx = refreshReserve({ reserve: keys.reserve, oracle: keys.oracle });
const refreshReserveNoOracleIx = refreshReserve({ reserve: keys.reserve });
assert(
  refreshReserveIx.data[0] === 3 && refreshReserveIx.keys.length === 3,
  `refreshReserve (with oracle): tag=${refreshReserveIx.data[0]}, ${refreshReserveIx.keys.length} accounts`
);
assert(
  refreshReserveNoOracleIx.keys.length === 2,
  `refreshReserve (no oracle): ${refreshReserveNoOracleIx.keys.length} accounts`
);

// 3f. RefreshObligation
const refreshObligationIx = refreshObligation({
  obligation: keys.obligation,
  reserves: [keys.reserve, keys.borrowReserve],
});
assert(
  refreshObligationIx.data[0] === 7 && refreshObligationIx.keys.length === 4,
  `refreshObligation: tag=${refreshObligationIx.data[0]}, ${refreshObligationIx.keys.length} accounts`
);

// 3g. BorrowObligationLiquidity
const borrowIx = borrowObligationLiquidity({
  liquidityAmount: new BN(100_000_000),
  sourceLiquidity: keys.sourceLiquidity,
  destinationLiquidity: keys.destinationLiquidity,
  borrowReserve: keys.borrowReserve,
  borrowReserveLiquidityFeeReceiver: keys.reserveLiquidityFeeReceiver,
  obligation: keys.obligation,
  lendingMarket: keys.lendingMarket,
  obligationOwner: keys.obligationOwner,
});
assert(
  borrowIx.data[0] === 10 && borrowIx.keys.length === 10,
  `borrowObligationLiquidity: tag=${borrowIx.data[0]}, ${borrowIx.keys.length} accounts`
);

// 3h. RepayObligationLiquidity
const repayIx = repayObligationLiquidity({
  liquidityAmount: new BN(50_000_000),
  sourceLiquidity: keys.sourceLiquidity,
  destinationLiquidity: keys.destinationLiquidity,
  repayReserve: keys.repayReserve,
  obligation: keys.obligation,
  lendingMarket: keys.lendingMarket,
  userTransferAuthority: keys.userTransferAuthority,
});
assert(
  repayIx.data[0] === 11 && repayIx.keys.length === 8,
  `repayObligationLiquidity: tag=${repayIx.data[0]}, ${repayIx.keys.length} accounts`
);

// 3i. LiquidateObligation
const liquidateIx = liquidateObligation({
  liquidityAmount: new BN(25_000_000),
  sourceLiquidity: keys.sourceLiquidity,
  destinationCollateral: keys.destinationCollateral,
  repayReserve: keys.repayReserve,
  repayReserveLiquiditySupply: keys.repayReserveLiquiditySupply,
  withdrawReserve: keys.withdrawReserve,
  withdrawReserveCollateralSupply: keys.withdrawReserveCollateralSupply,
  obligation: keys.obligation,
  lendingMarket: keys.lendingMarket,
  userTransferAuthority: keys.userTransferAuthority,
});
assert(
  liquidateIx.data[0] === 12 && liquidateIx.keys.length === 12,
  `liquidateObligation: tag=${liquidateIx.data[0]}, ${liquidateIx.keys.length} accounts`
);

// 3j. DepositObligationCollateral
const depositCollateralIx = depositObligationCollateral({
  collateralAmount: new BN(100_000_000),
  sourceCollateral: keys.sourceCollateral,
  destinationCollateral: keys.destinationCollateral,
  depositReserve: keys.reserve,
  obligation: keys.obligation,
  lendingMarket: keys.lendingMarket,
  obligationOwner: keys.obligationOwner,
  userTransferAuthority: keys.userTransferAuthority,
});
assert(
  depositCollateralIx.data[0] === 8 && depositCollateralIx.keys.length === 10,
  `depositObligationCollateral: tag=${depositCollateralIx.data[0]}, ${depositCollateralIx.keys.length} accounts`
);

// 3k. WithdrawObligationCollateral
const withdrawCollateralIx = withdrawObligationCollateral({
  collateralAmount: new BN(50_000_000),
  sourceCollateral: keys.sourceCollateral,
  destinationCollateral: keys.destinationCollateral,
  withdrawReserve: keys.withdrawReserve,
  obligation: keys.obligation,
  lendingMarket: keys.lendingMarket,
  obligationOwner: keys.obligationOwner,
});
assert(
  withdrawCollateralIx.data[0] === 9 && withdrawCollateralIx.keys.length === 9,
  `withdrawObligationCollateral: tag=${withdrawCollateralIx.data[0]}, ${withdrawCollateralIx.keys.length} accounts`
);

// 3l. DepositReserveLiquidityAndObligationCollateral
const comboIx = depositReserveLiquidityAndObligationCollateral({
  liquidityAmount: new BN(200_000_000),
  sourceLiquidity: keys.sourceLiquidity,
  userCollateral: keys.userCollateral,
  reserve: keys.reserve,
  reserveLiquiditySupply: keys.reserveLiquiditySupply,
  reserveCollateralMint: keys.reserveCollateralMint,
  lendingMarket: keys.lendingMarket,
  destinationDepositCollateral: keys.destinationDepositCollateral,
  obligation: keys.obligation,
  obligationOwner: keys.obligationOwner,
  userTransferAuthority: keys.userTransferAuthority,
});
assert(
  comboIx.data[0] === 14 && comboIx.keys.length === 13,
  `depositReserveLiquidityAndObligationCollateral: tag=${comboIx.data[0]}, ${comboIx.keys.length} accounts`
);

// ============================================================================
// 4. State Decoders with Mock Buffers
// ============================================================================

section("State Decoders (mock buffer data)");

// --- 4a. LendingMarket mock ---
{
  const buf = Buffer.alloc(LENDING_MARKET_LEN);
  let off = 0;

  // version
  buf.writeUInt8(1, off);
  off += 1;

  // bump_seed
  buf.writeUInt8(254, off);
  off += 1;

  // owner (32 bytes -- use a deterministic key)
  const ownerKey = Keypair.generate().publicKey;
  ownerKey.toBuffer().copy(buf, off);
  off += 32;

  // quote_currency "USD\0..." (32 bytes)
  buf.write("USD", off, "ascii");
  off += 32;

  // token_program_id (32 bytes)
  const tokenProgramId = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
  tokenProgramId.toBuffer().copy(buf, off);
  off += 32;

  const market = decodeLendingMarket(buf);
  assert(market.version === 1, `LendingMarket decoded: version=${market.version}`);
  assert(market.bumpSeed === 254, `  bumpSeed=${market.bumpSeed}`);
  assert(
    market.owner.equals(ownerKey),
    `  owner=${market.owner.toBase58().slice(0, 12)}...`
  );

  const quoteCurrencyStr = Buffer.from(market.quoteCurrency)
    .toString("ascii")
    .replace(/\0+$/, "");
  assert(quoteCurrencyStr === "USD", `  quoteCurrency="${quoteCurrencyStr}"`);
  assert(
    market.tokenProgramId.equals(tokenProgramId),
    `  tokenProgramId=${market.tokenProgramId.toBase58().slice(0, 12)}...`
  );
}

// --- 4b. Reserve mock ---
{
  const buf = Buffer.alloc(RESERVE_LEN);
  let off = 0;

  // version
  buf.writeUInt8(1, off);
  off += 1;

  // last_update_slot (8)
  new BN(12345678).toArrayLike(Buffer, "le", 8).copy(buf, off);
  off += 8;

  // last_update_stale (1)
  buf.writeUInt8(0, off);
  off += 1;

  // lending_market (32)
  Keypair.generate().publicKey.toBuffer().copy(buf, off);
  off += 32;

  // liquidity_mint_pubkey (32)
  Keypair.generate().publicKey.toBuffer().copy(buf, off);
  off += 32;

  // liquidity_mint_decimals (1)
  buf.writeUInt8(6, off);
  off += 1;

  // liquidity_supply_pubkey (32)
  Keypair.generate().publicKey.toBuffer().copy(buf, off);
  off += 32;

  // liquidity_fee_receiver (32)
  Keypair.generate().publicKey.toBuffer().copy(buf, off);
  off += 32;

  // liquidity_oracle COption (tag=0 means None, 4+32=36)
  buf.writeUInt32LE(0, off);
  off += 36;

  // liquidity_available_amount (8)
  new BN(5_000_000_000).toArrayLike(Buffer, "le", 8).copy(buf, off);
  off += 8;

  // liquidity_borrowed_amount_wads (16)
  new BN("2000000000000000000000").toArrayLike(Buffer, "le", 16).copy(buf, off);
  off += 16;

  // liquidity_cumulative_borrow_rate_wads (16) -- 1.0 WAD
  new BN("1000000000000000000").toArrayLike(Buffer, "le", 16).copy(buf, off);
  off += 16;

  // liquidity_market_price (16) -- $1.00 WAD
  new BN("1000000000000000000").toArrayLike(Buffer, "le", 16).copy(buf, off);
  off += 16;

  // collateral_mint_pubkey (32)
  Keypair.generate().publicKey.toBuffer().copy(buf, off);
  off += 32;

  // collateral_mint_total_supply (8)
  new BN(4_500_000_000).toArrayLike(Buffer, "le", 8).copy(buf, off);
  off += 8;

  // collateral_supply_pubkey (32)
  Keypair.generate().publicKey.toBuffer().copy(buf, off);
  off += 32;

  // config fields (7 u8s)
  buf.writeUInt8(80, off); off += 1;  // optimalUtilizationRate
  buf.writeUInt8(75, off); off += 1;  // loanToValueRatio
  buf.writeUInt8(5, off);  off += 1;  // liquidationBonus
  buf.writeUInt8(85, off); off += 1;  // liquidationThreshold
  buf.writeUInt8(1, off);  off += 1;  // minBorrowRate
  buf.writeUInt8(8, off);  off += 1;  // optimalBorrowRate
  buf.writeUInt8(30, off); off += 1;  // maxBorrowRate

  // fees: borrowFeeWad(8) + flashLoanFeeWad(8) + hostFeePercentage(1)
  new BN("10000000000000").toArrayLike(Buffer, "le", 8).copy(buf, off);
  off += 8;
  new BN("30000000000000").toArrayLike(Buffer, "le", 8).copy(buf, off);
  off += 8;
  buf.writeUInt8(20, off);
  off += 1;

  // deposit_staking_pool COption compact (tag=0 None, 1+32=33)
  buf.writeUInt8(0, off);
  off += 33;

  // deposit_limit (8)
  new BN("18446744073709551615").toArrayLike(Buffer, "le", 8).copy(buf, off);
  off += 8;

  // borrow_limit (8)
  new BN("18446744073709551615").toArrayLike(Buffer, "le", 8).copy(buf, off);
  off += 8;

  const reserve = decodeReserve(buf);
  assert(reserve.version === 1, `Reserve decoded: version=${reserve.version}`);
  assert(reserve.lastUpdate.slot.toNumber() === 12345678, `  lastUpdate.slot=12345678`);
  assert(reserve.lastUpdate.stale === false, `  lastUpdate.stale=false`);
  assert(reserve.liquidity.mintDecimals === 6, `  liquidity.mintDecimals=6`);
  assert(
    reserve.liquidity.availableAmount.toNumber() === 5_000_000_000,
    `  liquidity.availableAmount=5,000,000,000`
  );
  assert(reserve.liquidity.oraclePubkey === null, `  liquidity.oraclePubkey=null (no oracle)`);
  assert(
    reserve.collateral.mintTotalSupply.toNumber() === 4_500_000_000,
    `  collateral.mintTotalSupply=4,500,000,000`
  );
  assert(reserve.config.optimalUtilizationRate === 80, `  config.optimalUtilizationRate=80%`);
  assert(reserve.config.loanToValueRatio === 75, `  config.loanToValueRatio=75%`);
  assert(reserve.config.liquidationThreshold === 85, `  config.liquidationThreshold=85%`);
  assert(reserve.config.fees.hostFeePercentage === 20, `  config.fees.hostFeePercentage=20%`);
  assert(reserve.config.depositStakingPool === null, `  config.depositStakingPool=null`);
}

// --- 4c. Obligation mock ---
{
  const buf = Buffer.alloc(OBLIGATION_LEN);
  let off = 0;

  // version
  buf.writeUInt8(1, off);
  off += 1;

  // last_update_slot (8) + stale (1)
  new BN(99999999).toArrayLike(Buffer, "le", 8).copy(buf, off);
  off += 8;
  buf.writeUInt8(1, off);
  off += 1;

  // lending_market (32)
  Keypair.generate().publicKey.toBuffer().copy(buf, off);
  off += 32;

  // owner (32)
  const obligationOwner = Keypair.generate().publicKey;
  obligationOwner.toBuffer().copy(buf, off);
  off += 32;

  // deposited_value (16)
  new BN("5000000000000000000000").toArrayLike(Buffer, "le", 16).copy(buf, off);
  off += 16;

  // borrowed_value (16)
  new BN("2000000000000000000000").toArrayLike(Buffer, "le", 16).copy(buf, off);
  off += 16;

  // allowed_borrow_value (16)
  new BN("3750000000000000000000").toArrayLike(Buffer, "le", 16).copy(buf, off);
  off += 16;

  // unhealthy_borrow_value (16)
  new BN("4250000000000000000000").toArrayLike(Buffer, "le", 16).copy(buf, off);
  off += 16;

  // deposits_len=1, borrows_len=1
  buf.writeUInt8(1, off);
  off += 1;
  buf.writeUInt8(1, off);
  off += 1;

  // 1 collateral deposit: depositReserve(32) + depositedAmount(8) + marketValue(16)
  const depositReserve = Keypair.generate().publicKey;
  depositReserve.toBuffer().copy(buf, off);
  off += 32;
  new BN(3_000_000_000).toArrayLike(Buffer, "le", 8).copy(buf, off);
  off += 8;
  new BN("5000000000000000000000").toArrayLike(Buffer, "le", 16).copy(buf, off);
  off += 16;

  // 1 liquidity borrow: borrowReserve(32) + cumulativeBorrowRateWads(16) + borrowedAmountWads(16) + marketValue(16)
  const borrowReserve = Keypair.generate().publicKey;
  borrowReserve.toBuffer().copy(buf, off);
  off += 32;
  new BN("1000000000000000000").toArrayLike(Buffer, "le", 16).copy(buf, off);
  off += 16;
  new BN("2000000000000000000000").toArrayLike(Buffer, "le", 16).copy(buf, off);
  off += 16;
  new BN("2000000000000000000000").toArrayLike(Buffer, "le", 16).copy(buf, off);
  off += 16;

  const obligation = decodeObligation(buf);
  assert(obligation.version === 1, `Obligation decoded: version=${obligation.version}`);
  assert(obligation.lastUpdate.slot.toNumber() === 99999999, `  lastUpdate.slot=99999999`);
  assert(obligation.lastUpdate.stale === true, `  lastUpdate.stale=true`);
  assert(
    obligation.owner.equals(obligationOwner),
    `  owner=${obligation.owner.toBase58().slice(0, 12)}...`
  );
  assert(obligation.deposits.length === 1, `  deposits.length=1`);
  assert(
    obligation.deposits[0].depositedAmount.toNumber() === 3_000_000_000,
    `  deposits[0].depositedAmount=3,000,000,000`
  );
  assert(obligation.borrows.length === 1, `  borrows.length=1`);
  assert(
    obligation.borrows[0].borrowReserve.equals(borrowReserve),
    `  borrows[0].borrowReserve=${obligation.borrows[0].borrowReserve.toBase58().slice(0, 12)}...`
  );
}

// ============================================================================
// 5. Error Handling
// ============================================================================

section("Error Handling");

try {
  decodeReserve(Buffer.alloc(10));
  assert(false, "decodeReserve should throw on short buffer");
} catch (e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  assert(
    msg.includes("too short"),
    `decodeReserve rejects short buffer: "${msg}"`
  );
}

try {
  decodeObligation(Buffer.alloc(10));
  assert(false, "decodeObligation should throw on short buffer");
} catch (e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  assert(
    msg.includes("too short"),
    `decodeObligation rejects short buffer: "${msg}"`
  );
}

try {
  decodeLendingMarket(Buffer.alloc(10));
  assert(false, "decodeLendingMarket should throw on short buffer");
} catch (e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  assert(
    msg.includes("too short"),
    `decodeLendingMarket rejects short buffer: "${msg}"`
  );
}

// Version check
try {
  const badBuf = Buffer.alloc(RESERVE_LEN);
  badBuf.writeUInt8(99, 0); // version 99
  decodeReserve(badBuf);
  assert(false, "decodeReserve should throw on bad version");
} catch (e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  assert(
    msg.includes("exceeds program version"),
    `decodeReserve rejects bad version: "${msg}"`
  );
}

// ============================================================================
// Summary
// ============================================================================

section("Summary");
console.log(`  Total: ${passed + failed}  Passed: ${passed}  Failed: ${failed}`);
console.log();

if (failed > 0) {
  console.log("  SOME TESTS FAILED");
  process.exit(1);
} else {
  console.log("  ALL TESTS PASSED -- SDK is fully functional");
  console.log();
  console.log("  The Port Finance Lending SDK provides:");
  console.log("    - 2 program IDs (lending + staking)");
  console.log("    - 12 instruction builders covering the full lending lifecycle");
  console.log("    - 3 state decoders for Reserve, Obligation, and LendingMarket");
  console.log("    - PDA derivation for lending market authority");
  console.log("    - Full TypeScript types with strict mode");
  process.exit(0);
}
