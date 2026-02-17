import { PublicKey } from "@solana/web3.js";

// ============================================================================
// Program IDs
// ============================================================================

/** Port Finance Token Lending program ID (mainnet) */
export const LENDING_PROGRAM_ID = new PublicKey(
  "Port7uDYB3wk6GJAw4KT1WpTeMtSu9bTcChBHkX2LfR"
);

/** Port Finance Staking program ID (mainnet) */
export const STAKING_PROGRAM_ID = new PublicKey(
  "stkarvwmSzv2BygN5e2LeTwimTczLWHCKPKGC2zVLiq"
);

// ============================================================================
// Re-exports
// ============================================================================

// Types
export type {
  LastUpdate,
  ReserveFees,
  ReserveConfig,
  ReserveLiquidity,
  ReserveCollateral,
  Reserve,
  ObligationCollateral,
  ObligationLiquidity,
  Obligation,
  LendingMarket,
} from "./types";

export {
  PROGRAM_VERSION,
  RESERVE_LEN,
  OBLIGATION_LEN,
  LENDING_MARKET_LEN,
  MAX_OBLIGATION_RESERVES,
  LIQUIDATION_CLOSE_FACTOR,
  LIQUIDATION_CLOSE_AMOUNT,
  OBLIGATION_COLLATERAL_LEN,
  OBLIGATION_LIQUIDITY_LEN,
  WAD,
} from "./types";

// State decoders
export {
  decodeReserve,
  decodeObligation,
  decodeLendingMarket,
} from "./state";

// Instruction builders
export {
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
} from "./instructions";
