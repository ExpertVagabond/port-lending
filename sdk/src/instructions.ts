import {
  PublicKey,
  TransactionInstruction,
  SYSVAR_CLOCK_PUBKEY,
  SYSVAR_RENT_PUBKEY,
  SystemProgram,
} from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import BN from "bn.js";
import { LENDING_PROGRAM_ID, STAKING_PROGRAM_ID } from "./index";

// ============================================================================
// Instruction Tag Constants (match Rust enum discriminants)
// ============================================================================

const INSTRUCTION_INIT_LENDING_MARKET = 0;
const INSTRUCTION_SET_LENDING_MARKET_OWNER = 1;
const INSTRUCTION_INIT_RESERVE = 2;
const INSTRUCTION_REFRESH_RESERVE = 3;
const INSTRUCTION_DEPOSIT_RESERVE_LIQUIDITY = 4;
const INSTRUCTION_REDEEM_RESERVE_COLLATERAL = 5;
const INSTRUCTION_INIT_OBLIGATION = 6;
const INSTRUCTION_REFRESH_OBLIGATION = 7;
const INSTRUCTION_DEPOSIT_OBLIGATION_COLLATERAL = 8;
const INSTRUCTION_WITHDRAW_OBLIGATION_COLLATERAL = 9;
const INSTRUCTION_BORROW_OBLIGATION_LIQUIDITY = 10;
const INSTRUCTION_REPAY_OBLIGATION_LIQUIDITY = 11;
const INSTRUCTION_LIQUIDATE_OBLIGATION = 12;
const INSTRUCTION_FLASH_LOAN = 13;
const INSTRUCTION_DEPOSIT_RESERVE_LIQUIDITY_AND_OBLIGATION_COLLATERAL = 14;

// ============================================================================
// Helpers
// ============================================================================

/** Encode a u64 as 8-byte little-endian buffer */
function encodeU64(value: BN | number): Buffer {
  const bn = new BN(value);
  return bn.toArrayLike(Buffer, "le", 8);
}

/**
 * Derive the lending market authority PDA.
 * Seeds: [lending_market_pubkey]
 */
export function deriveLendingMarketAuthority(
  lendingMarket: PublicKey,
  programId: PublicKey = LENDING_PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [lendingMarket.toBuffer()],
    programId
  );
}

// ============================================================================
// Instruction Builders
// ============================================================================

/**
 * Create an InitReserve instruction.
 *
 * Initializes a new lending market reserve with the given configuration.
 * Instruction tag: 2
 */
export function initReserve(args: {
  liquidityAmount: BN | number;
  config: {
    optimalUtilizationRate: number;
    loanToValueRatio: number;
    liquidationBonus: number;
    liquidationThreshold: number;
    minBorrowRate: number;
    optimalBorrowRate: number;
    maxBorrowRate: number;
    fees: {
      borrowFeeWad: BN | number;
      flashLoanFeeWad: BN | number;
      hostFeePercentage: number;
    };
    depositStakingPool: PublicKey | null;
    depositLimit: BN | number;
    borrowLimit: BN | number;
  };
  sourceLiquidity: PublicKey;
  destinationCollateral: PublicKey;
  reserve: PublicKey;
  reserveLiquidityMint: PublicKey;
  reserveLiquiditySupply: PublicKey;
  reserveLiquidityFeeReceiver: PublicKey;
  reserveCollateralMint: PublicKey;
  reserveCollateralSupply: PublicKey;
  lendingMarket: PublicKey;
  lendingMarketOwner: PublicKey;
  userTransferAuthority: PublicKey;
  oraclePrice?: PublicKey;
}): TransactionInstruction {
  const [lendingMarketAuthority] = deriveLendingMarketAuthority(
    args.lendingMarket
  );

  const keys = [
    { pubkey: args.sourceLiquidity, isSigner: false, isWritable: true },
    { pubkey: args.destinationCollateral, isSigner: false, isWritable: true },
    { pubkey: args.reserve, isSigner: false, isWritable: true },
    { pubkey: args.reserveLiquidityMint, isSigner: false, isWritable: false },
    { pubkey: args.reserveLiquiditySupply, isSigner: false, isWritable: true },
    {
      pubkey: args.reserveLiquidityFeeReceiver,
      isSigner: false,
      isWritable: true,
    },
    { pubkey: args.reserveCollateralMint, isSigner: false, isWritable: true },
    { pubkey: args.reserveCollateralSupply, isSigner: false, isWritable: true },
    { pubkey: args.lendingMarket, isSigner: false, isWritable: false },
    { pubkey: lendingMarketAuthority, isSigner: false, isWritable: false },
    { pubkey: args.lendingMarketOwner, isSigner: true, isWritable: false },
    { pubkey: args.userTransferAuthority, isSigner: true, isWritable: false },
    { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
    { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
  ];

  if (args.oraclePrice) {
    keys.push({
      pubkey: args.oraclePrice,
      isSigner: false,
      isWritable: false,
    });
  }

  // Data layout: tag(1) + liquidity_amount(8) + fixed_price COption<Decimal>(1 + 16) + config
  // fixed_price is always None in this SDK (tag=0, 16 zero bytes)
  const configBuf = encodeReserveConfig(args.config);
  const dataLen = 1 + 8 + 1 + 16 + configBuf.length;
  const data = Buffer.alloc(dataLen);
  let offset = 0;

  data.writeUInt8(INSTRUCTION_INIT_RESERVE, offset);
  offset += 1;

  encodeU64(args.liquidityAmount).copy(data, offset);
  offset += 8;

  // fixed_price = COption::None (compact: tag 0 + 16 zero bytes)
  data.writeUInt8(0, offset);
  offset += 1;
  // 16 zero bytes for the decimal value (already zeroed by alloc)
  offset += 16;

  configBuf.copy(data, offset);

  return new TransactionInstruction({
    keys,
    programId: LENDING_PROGRAM_ID,
    data,
  });
}

/**
 * Create a DepositReserveLiquidity instruction.
 *
 * Deposit liquidity into a reserve in exchange for collateral tokens.
 * Instruction tag: 4
 */
export function depositReserveLiquidity(args: {
  liquidityAmount: BN | number;
  sourceLiquidity: PublicKey;
  destinationCollateral: PublicKey;
  reserve: PublicKey;
  reserveLiquiditySupply: PublicKey;
  reserveCollateralMint: PublicKey;
  lendingMarket: PublicKey;
  userTransferAuthority: PublicKey;
}): TransactionInstruction {
  const [lendingMarketAuthority] = deriveLendingMarketAuthority(
    args.lendingMarket
  );

  const keys = [
    { pubkey: args.sourceLiquidity, isSigner: false, isWritable: true },
    { pubkey: args.destinationCollateral, isSigner: false, isWritable: true },
    { pubkey: args.reserve, isSigner: false, isWritable: true },
    { pubkey: args.reserveLiquiditySupply, isSigner: false, isWritable: true },
    { pubkey: args.reserveCollateralMint, isSigner: false, isWritable: true },
    { pubkey: args.lendingMarket, isSigner: false, isWritable: false },
    { pubkey: lendingMarketAuthority, isSigner: false, isWritable: false },
    { pubkey: args.userTransferAuthority, isSigner: true, isWritable: false },
    { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
  ];

  const data = Buffer.alloc(9);
  data.writeUInt8(INSTRUCTION_DEPOSIT_RESERVE_LIQUIDITY, 0);
  encodeU64(args.liquidityAmount).copy(data, 1);

  return new TransactionInstruction({
    keys,
    programId: LENDING_PROGRAM_ID,
    data,
  });
}

/**
 * Create a RedeemReserveCollateral instruction.
 *
 * Redeem collateral from a reserve in exchange for liquidity.
 * Instruction tag: 5
 */
export function redeemReserveCollateral(args: {
  collateralAmount: BN | number;
  sourceCollateral: PublicKey;
  destinationLiquidity: PublicKey;
  reserve: PublicKey;
  reserveCollateralMint: PublicKey;
  reserveLiquiditySupply: PublicKey;
  lendingMarket: PublicKey;
  userTransferAuthority: PublicKey;
}): TransactionInstruction {
  const [lendingMarketAuthority] = deriveLendingMarketAuthority(
    args.lendingMarket
  );

  const keys = [
    { pubkey: args.sourceCollateral, isSigner: false, isWritable: true },
    { pubkey: args.destinationLiquidity, isSigner: false, isWritable: true },
    { pubkey: args.reserve, isSigner: false, isWritable: true },
    { pubkey: args.reserveCollateralMint, isSigner: false, isWritable: true },
    { pubkey: args.reserveLiquiditySupply, isSigner: false, isWritable: true },
    { pubkey: args.lendingMarket, isSigner: false, isWritable: false },
    { pubkey: lendingMarketAuthority, isSigner: false, isWritable: false },
    { pubkey: args.userTransferAuthority, isSigner: true, isWritable: false },
    { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
  ];

  const data = Buffer.alloc(9);
  data.writeUInt8(INSTRUCTION_REDEEM_RESERVE_COLLATERAL, 0);
  encodeU64(args.collateralAmount).copy(data, 1);

  return new TransactionInstruction({
    keys,
    programId: LENDING_PROGRAM_ID,
    data,
  });
}

/**
 * Create an InitObligation instruction.
 *
 * Initialize a new lending market obligation.
 * Instruction tag: 6
 */
export function initObligation(args: {
  obligation: PublicKey;
  lendingMarket: PublicKey;
  obligationOwner: PublicKey;
}): TransactionInstruction {
  const keys = [
    { pubkey: args.obligation, isSigner: false, isWritable: true },
    { pubkey: args.lendingMarket, isSigner: false, isWritable: false },
    { pubkey: args.obligationOwner, isSigner: true, isWritable: false },
    { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
    { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
  ];

  const data = Buffer.alloc(1);
  data.writeUInt8(INSTRUCTION_INIT_OBLIGATION, 0);

  return new TransactionInstruction({
    keys,
    programId: LENDING_PROGRAM_ID,
    data,
  });
}

/**
 * Create a RefreshReserve instruction.
 *
 * Accrue interest and update market price of liquidity on a reserve.
 * Instruction tag: 3
 */
export function refreshReserve(args: {
  reserve: PublicKey;
  oracle?: PublicKey;
}): TransactionInstruction {
  const keys = [
    { pubkey: args.reserve, isSigner: false, isWritable: true },
    { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
  ];

  if (args.oracle) {
    keys.push({ pubkey: args.oracle, isSigner: false, isWritable: false });
  }

  const data = Buffer.alloc(1);
  data.writeUInt8(INSTRUCTION_REFRESH_RESERVE, 0);

  return new TransactionInstruction({
    keys,
    programId: LENDING_PROGRAM_ID,
    data,
  });
}

/**
 * Create a RefreshObligation instruction.
 *
 * Refresh an obligation's accrued interest and collateral/liquidity prices.
 * Instruction tag: 7
 */
export function refreshObligation(args: {
  obligation: PublicKey;
  reserves: PublicKey[];
}): TransactionInstruction {
  const keys = [
    { pubkey: args.obligation, isSigner: false, isWritable: true },
    { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
    ...args.reserves.map((pubkey) => ({
      pubkey,
      isSigner: false,
      isWritable: false,
    })),
  ];

  const data = Buffer.alloc(1);
  data.writeUInt8(INSTRUCTION_REFRESH_OBLIGATION, 0);

  return new TransactionInstruction({
    keys,
    programId: LENDING_PROGRAM_ID,
    data,
  });
}

/**
 * Create a BorrowObligationLiquidity instruction.
 *
 * Borrow liquidity from a reserve by depositing collateral tokens.
 * Instruction tag: 10
 */
export function borrowObligationLiquidity(args: {
  liquidityAmount: BN | number;
  sourceLiquidity: PublicKey;
  destinationLiquidity: PublicKey;
  borrowReserve: PublicKey;
  borrowReserveLiquidityFeeReceiver: PublicKey;
  obligation: PublicKey;
  lendingMarket: PublicKey;
  obligationOwner: PublicKey;
}): TransactionInstruction {
  const [lendingMarketAuthority] = deriveLendingMarketAuthority(
    args.lendingMarket
  );

  const keys = [
    { pubkey: args.sourceLiquidity, isSigner: false, isWritable: true },
    { pubkey: args.destinationLiquidity, isSigner: false, isWritable: true },
    { pubkey: args.borrowReserve, isSigner: false, isWritable: true },
    {
      pubkey: args.borrowReserveLiquidityFeeReceiver,
      isSigner: false,
      isWritable: true,
    },
    { pubkey: args.obligation, isSigner: false, isWritable: true },
    { pubkey: args.lendingMarket, isSigner: false, isWritable: false },
    { pubkey: lendingMarketAuthority, isSigner: false, isWritable: false },
    { pubkey: args.obligationOwner, isSigner: true, isWritable: false },
    { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
  ];

  const data = Buffer.alloc(9);
  data.writeUInt8(INSTRUCTION_BORROW_OBLIGATION_LIQUIDITY, 0);
  encodeU64(args.liquidityAmount).copy(data, 1);

  return new TransactionInstruction({
    keys,
    programId: LENDING_PROGRAM_ID,
    data,
  });
}

/**
 * Create a RepayObligationLiquidity instruction.
 *
 * Repay borrowed liquidity to a reserve.
 * Instruction tag: 11
 */
export function repayObligationLiquidity(args: {
  liquidityAmount: BN | number;
  sourceLiquidity: PublicKey;
  destinationLiquidity: PublicKey;
  repayReserve: PublicKey;
  obligation: PublicKey;
  lendingMarket: PublicKey;
  userTransferAuthority: PublicKey;
}): TransactionInstruction {
  const keys = [
    { pubkey: args.sourceLiquidity, isSigner: false, isWritable: true },
    { pubkey: args.destinationLiquidity, isSigner: false, isWritable: true },
    { pubkey: args.repayReserve, isSigner: false, isWritable: true },
    { pubkey: args.obligation, isSigner: false, isWritable: true },
    { pubkey: args.lendingMarket, isSigner: false, isWritable: false },
    { pubkey: args.userTransferAuthority, isSigner: true, isWritable: false },
    { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
  ];

  const data = Buffer.alloc(9);
  data.writeUInt8(INSTRUCTION_REPAY_OBLIGATION_LIQUIDITY, 0);
  encodeU64(args.liquidityAmount).copy(data, 1);

  return new TransactionInstruction({
    keys,
    programId: LENDING_PROGRAM_ID,
    data,
  });
}

/**
 * Create a LiquidateObligation instruction.
 *
 * Repay borrowed liquidity to receive collateral at a discount from an unhealthy obligation.
 * Instruction tag: 12
 */
export function liquidateObligation(args: {
  liquidityAmount: BN | number;
  sourceLiquidity: PublicKey;
  destinationCollateral: PublicKey;
  repayReserve: PublicKey;
  repayReserveLiquiditySupply: PublicKey;
  withdrawReserve: PublicKey;
  withdrawReserveCollateralSupply: PublicKey;
  obligation: PublicKey;
  lendingMarket: PublicKey;
  userTransferAuthority: PublicKey;
  stakeAccount?: PublicKey;
  stakingPool?: PublicKey;
}): TransactionInstruction {
  const [lendingMarketAuthority] = deriveLendingMarketAuthority(
    args.lendingMarket
  );

  const keys = [
    { pubkey: args.sourceLiquidity, isSigner: false, isWritable: true },
    { pubkey: args.destinationCollateral, isSigner: false, isWritable: true },
    { pubkey: args.repayReserve, isSigner: false, isWritable: true },
    {
      pubkey: args.repayReserveLiquiditySupply,
      isSigner: false,
      isWritable: true,
    },
    { pubkey: args.withdrawReserve, isSigner: false, isWritable: false },
    {
      pubkey: args.withdrawReserveCollateralSupply,
      isSigner: false,
      isWritable: true,
    },
    { pubkey: args.obligation, isSigner: false, isWritable: true },
    { pubkey: args.lendingMarket, isSigner: false, isWritable: false },
    { pubkey: lendingMarketAuthority, isSigner: false, isWritable: false },
    { pubkey: args.userTransferAuthority, isSigner: true, isWritable: false },
    { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
  ];

  if (args.stakeAccount && args.stakingPool) {
    keys.push({ pubkey: args.stakeAccount, isSigner: false, isWritable: true });
    keys.push({ pubkey: args.stakingPool, isSigner: false, isWritable: true });
    keys.push({
      pubkey: STAKING_PROGRAM_ID,
      isSigner: false,
      isWritable: false,
    });
  }

  const data = Buffer.alloc(9);
  data.writeUInt8(INSTRUCTION_LIQUIDATE_OBLIGATION, 0);
  encodeU64(args.liquidityAmount).copy(data, 1);

  return new TransactionInstruction({
    keys,
    programId: LENDING_PROGRAM_ID,
    data,
  });
}

/**
 * Create a DepositObligationCollateral instruction.
 *
 * Deposit collateral to an obligation.
 * Instruction tag: 8
 */
export function depositObligationCollateral(args: {
  collateralAmount: BN | number;
  sourceCollateral: PublicKey;
  destinationCollateral: PublicKey;
  depositReserve: PublicKey;
  obligation: PublicKey;
  lendingMarket: PublicKey;
  obligationOwner: PublicKey;
  userTransferAuthority: PublicKey;
  stakeAccount?: PublicKey;
  stakingPool?: PublicKey;
}): TransactionInstruction {
  const [lendingMarketAuthority] = deriveLendingMarketAuthority(
    args.lendingMarket
  );

  const keys = [
    { pubkey: args.sourceCollateral, isSigner: false, isWritable: true },
    { pubkey: args.destinationCollateral, isSigner: false, isWritable: true },
    { pubkey: args.depositReserve, isSigner: false, isWritable: false },
    { pubkey: args.obligation, isSigner: false, isWritable: true },
    { pubkey: args.lendingMarket, isSigner: false, isWritable: false },
    { pubkey: lendingMarketAuthority, isSigner: false, isWritable: false },
    { pubkey: args.obligationOwner, isSigner: true, isWritable: false },
    { pubkey: args.userTransferAuthority, isSigner: true, isWritable: false },
    { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
  ];

  if (args.stakeAccount && args.stakingPool) {
    keys.push({ pubkey: args.stakeAccount, isSigner: false, isWritable: true });
    keys.push({ pubkey: args.stakingPool, isSigner: false, isWritable: true });
    keys.push({
      pubkey: STAKING_PROGRAM_ID,
      isSigner: false,
      isWritable: false,
    });
  }

  const data = Buffer.alloc(9);
  data.writeUInt8(INSTRUCTION_DEPOSIT_OBLIGATION_COLLATERAL, 0);
  encodeU64(args.collateralAmount).copy(data, 1);

  return new TransactionInstruction({
    keys,
    programId: LENDING_PROGRAM_ID,
    data,
  });
}

/**
 * Create a WithdrawObligationCollateral instruction.
 *
 * Withdraw collateral from an obligation.
 * Instruction tag: 9
 */
export function withdrawObligationCollateral(args: {
  collateralAmount: BN | number;
  sourceCollateral: PublicKey;
  destinationCollateral: PublicKey;
  withdrawReserve: PublicKey;
  obligation: PublicKey;
  lendingMarket: PublicKey;
  obligationOwner: PublicKey;
  stakeAccount?: PublicKey;
  stakingPool?: PublicKey;
}): TransactionInstruction {
  const [lendingMarketAuthority] = deriveLendingMarketAuthority(
    args.lendingMarket
  );

  const keys = [
    { pubkey: args.sourceCollateral, isSigner: false, isWritable: true },
    { pubkey: args.destinationCollateral, isSigner: false, isWritable: true },
    { pubkey: args.withdrawReserve, isSigner: false, isWritable: false },
    { pubkey: args.obligation, isSigner: false, isWritable: true },
    { pubkey: args.lendingMarket, isSigner: false, isWritable: false },
    { pubkey: lendingMarketAuthority, isSigner: false, isWritable: false },
    { pubkey: args.obligationOwner, isSigner: true, isWritable: false },
    { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
  ];

  if (args.stakeAccount && args.stakingPool) {
    keys.push({ pubkey: args.stakeAccount, isSigner: false, isWritable: true });
    keys.push({ pubkey: args.stakingPool, isSigner: false, isWritable: true });
    keys.push({
      pubkey: STAKING_PROGRAM_ID,
      isSigner: false,
      isWritable: false,
    });
  }

  const data = Buffer.alloc(9);
  data.writeUInt8(INSTRUCTION_WITHDRAW_OBLIGATION_COLLATERAL, 0);
  encodeU64(args.collateralAmount).copy(data, 1);

  return new TransactionInstruction({
    keys,
    programId: LENDING_PROGRAM_ID,
    data,
  });
}

/**
 * Create a DepositReserveLiquidityAndObligationCollateral instruction.
 *
 * Combined deposit: deposits liquidity into a reserve AND deposits the resulting
 * collateral tokens into an obligation in a single instruction.
 * Instruction tag: 14
 */
export function depositReserveLiquidityAndObligationCollateral(args: {
  liquidityAmount: BN | number;
  sourceLiquidity: PublicKey;
  userCollateral: PublicKey;
  reserve: PublicKey;
  reserveLiquiditySupply: PublicKey;
  reserveCollateralMint: PublicKey;
  lendingMarket: PublicKey;
  destinationDepositCollateral: PublicKey;
  obligation: PublicKey;
  obligationOwner: PublicKey;
  userTransferAuthority: PublicKey;
  stakeAccount?: PublicKey;
  stakingPool?: PublicKey;
}): TransactionInstruction {
  const [lendingMarketAuthority] = deriveLendingMarketAuthority(
    args.lendingMarket
  );

  const keys = [
    { pubkey: args.sourceLiquidity, isSigner: false, isWritable: true },
    { pubkey: args.userCollateral, isSigner: false, isWritable: true },
    { pubkey: args.reserve, isSigner: false, isWritable: true },
    { pubkey: args.reserveLiquiditySupply, isSigner: false, isWritable: true },
    { pubkey: args.reserveCollateralMint, isSigner: false, isWritable: true },
    { pubkey: args.lendingMarket, isSigner: false, isWritable: false },
    { pubkey: lendingMarketAuthority, isSigner: false, isWritable: false },
    {
      pubkey: args.destinationDepositCollateral,
      isSigner: false,
      isWritable: true,
    },
    { pubkey: args.obligation, isSigner: false, isWritable: true },
    { pubkey: args.obligationOwner, isSigner: true, isWritable: true },
    { pubkey: args.userTransferAuthority, isSigner: true, isWritable: false },
    { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
  ];

  if (args.stakeAccount && args.stakingPool) {
    keys.push({ pubkey: args.stakeAccount, isSigner: false, isWritable: true });
    keys.push({ pubkey: args.stakingPool, isSigner: false, isWritable: true });
    keys.push({
      pubkey: STAKING_PROGRAM_ID,
      isSigner: false,
      isWritable: false,
    });
  }

  const data = Buffer.alloc(9);
  data.writeUInt8(
    INSTRUCTION_DEPOSIT_RESERVE_LIQUIDITY_AND_OBLIGATION_COLLATERAL,
    0
  );
  encodeU64(args.liquidityAmount).copy(data, 1);

  return new TransactionInstruction({
    keys,
    programId: LENDING_PROGRAM_ID,
    data,
  });
}

// ============================================================================
// Config Encoding Helper
// ============================================================================

/**
 * Encode a ReserveConfig into bytes matching the Rust pack layout.
 *
 * Layout:
 *   optimal_utilization_rate(1) + loan_to_value_ratio(1) + liquidation_bonus(1) +
 *   liquidation_threshold(1) + min_borrow_rate(1) + optimal_borrow_rate(1) +
 *   max_borrow_rate(1) + borrow_fee_wad(8) + flash_loan_fee_wad(8) +
 *   host_fee_percentage(1) + deposit_staking_pool COption compact(1+32) +
 *   deposit_limit(8) + borrow_limit(8) = 74 bytes
 */
function encodeReserveConfig(config: {
  optimalUtilizationRate: number;
  loanToValueRatio: number;
  liquidationBonus: number;
  liquidationThreshold: number;
  minBorrowRate: number;
  optimalBorrowRate: number;
  maxBorrowRate: number;
  fees: {
    borrowFeeWad: BN | number;
    flashLoanFeeWad: BN | number;
    hostFeePercentage: number;
  };
  depositStakingPool: PublicKey | null;
  depositLimit: BN | number;
  borrowLimit: BN | number;
}): Buffer {
  const buf = Buffer.alloc(74);
  let offset = 0;

  buf.writeUInt8(config.optimalUtilizationRate, offset);
  offset += 1;
  buf.writeUInt8(config.loanToValueRatio, offset);
  offset += 1;
  buf.writeUInt8(config.liquidationBonus, offset);
  offset += 1;
  buf.writeUInt8(config.liquidationThreshold, offset);
  offset += 1;
  buf.writeUInt8(config.minBorrowRate, offset);
  offset += 1;
  buf.writeUInt8(config.optimalBorrowRate, offset);
  offset += 1;
  buf.writeUInt8(config.maxBorrowRate, offset);
  offset += 1;

  encodeU64(config.fees.borrowFeeWad).copy(buf, offset);
  offset += 8;
  encodeU64(config.fees.flashLoanFeeWad).copy(buf, offset);
  offset += 8;
  buf.writeUInt8(config.fees.hostFeePercentage, offset);
  offset += 1;

  // deposit_staking_pool: COption compact (1 + 32)
  if (config.depositStakingPool) {
    buf.writeUInt8(1, offset);
    offset += 1;
    config.depositStakingPool.toBuffer().copy(buf, offset);
    offset += 32;
  } else {
    buf.writeUInt8(0, offset);
    offset += 1;
    // 32 zero bytes already from alloc
    offset += 32;
  }

  encodeU64(config.depositLimit).copy(buf, offset);
  offset += 8;
  encodeU64(config.borrowLimit).copy(buf, offset);
  offset += 8;

  return buf;
}
