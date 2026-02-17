import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";

// ============================================================================
// Constants
// ============================================================================

/** Current program version */
export const PROGRAM_VERSION = 1;

/** Reserve account data size in bytes */
export const RESERVE_LEN = 575;

/** Obligation account data size in bytes */
export const OBLIGATION_LEN = 916;

/** Lending market account data size in bytes */
export const LENDING_MARKET_LEN = 258;

/** Maximum number of collateral + liquidity reserves for an obligation */
export const MAX_OBLIGATION_RESERVES = 10;

/** Percentage of an obligation that can be repaid during each liquidation call */
export const LIQUIDATION_CLOSE_FACTOR = 50;

/** Obligation borrow amount that is small enough to close out */
export const LIQUIDATION_CLOSE_AMOUNT = 2;

/** Obligation collateral entry size: 32 + 8 + 16 = 56 bytes */
export const OBLIGATION_COLLATERAL_LEN = 56;

/** Obligation liquidity entry size: 32 + 16 + 16 + 16 = 80 bytes */
export const OBLIGATION_LIQUIDITY_LEN = 80;

/** WAD - 10^18, used for decimal precision */
export const WAD = new BN("1000000000000000000");

// ============================================================================
// Account State Types
// ============================================================================

/** Last update tracking */
export interface LastUpdate {
  /** Last slot when updated */
  slot: BN;
  /** True when marked stale, false when slot updated */
  stale: boolean;
}

/** Reserve fees configuration */
export interface ReserveFees {
  /** Fee assessed on BorrowObligationLiquidity, expressed as a Wad (10^18 = 100%) */
  borrowFeeWad: BN;
  /** Fee for flash loan, expressed as a Wad */
  flashLoanFeeWad: BN;
  /** Percentage of fee going to host account (0-100) */
  hostFeePercentage: number;
}

/** Reserve configuration values */
export interface ReserveConfig {
  /** Optimal utilization rate as a percentage (0-100) */
  optimalUtilizationRate: number;
  /** Target ratio of borrows to deposits as a percentage; 0 disables collateral */
  loanToValueRatio: number;
  /** Bonus a liquidator gets when repaying unhealthy obligation, as a percentage */
  liquidationBonus: number;
  /** Loan to value ratio at which an obligation can be liquidated, as a percentage */
  liquidationThreshold: number;
  /** Min borrow APY as a percentage */
  minBorrowRate: number;
  /** Optimal (utilization) borrow APY as a percentage */
  optimalBorrowRate: number;
  /** Max borrow APY as a percentage */
  maxBorrowRate: number;
  /** Program owner fees */
  fees: ReserveFees;
  /** Corresponding staking pool pubkey for deposits, or null */
  depositStakingPool: PublicKey | null;
  /** Maximum deposit limit of liquidity in native units (u64 max for unlimited) */
  depositLimit: BN;
  /** Maximum borrow limit of liquidity in native units (u64 max for unlimited) */
  borrowLimit: BN;
}

/** Reserve liquidity state */
export interface ReserveLiquidity {
  /** Reserve liquidity mint address */
  mintPubkey: PublicKey;
  /** Reserve liquidity mint decimals */
  mintDecimals: number;
  /** Reserve liquidity supply address */
  supplyPubkey: PublicKey;
  /** Reserve liquidity fee receiver address */
  feeReceiver: PublicKey;
  /** Reserve liquidity oracle account, or null */
  oraclePubkey: PublicKey | null;
  /** Reserve liquidity available amount */
  availableAmount: BN;
  /** Reserve liquidity borrowed amount (WAD-scaled) */
  borrowedAmountWads: BN;
  /** Reserve liquidity cumulative borrow rate (WAD-scaled) */
  cumulativeBorrowRateWads: BN;
  /** Reserve liquidity market price in quote currency (WAD-scaled) */
  marketPrice: BN;
}

/** Reserve collateral state */
export interface ReserveCollateral {
  /** Reserve collateral mint address */
  mintPubkey: PublicKey;
  /** Reserve collateral mint total supply */
  mintTotalSupply: BN;
  /** Reserve collateral supply address */
  supplyPubkey: PublicKey;
}

/** Lending market reserve state */
export interface Reserve {
  /** Version of the struct */
  version: number;
  /** Last slot when supply and rates updated */
  lastUpdate: LastUpdate;
  /** Lending market address */
  lendingMarket: PublicKey;
  /** Reserve liquidity info */
  liquidity: ReserveLiquidity;
  /** Reserve collateral info */
  collateral: ReserveCollateral;
  /** Reserve configuration values */
  config: ReserveConfig;
}

/** Obligation collateral deposit */
export interface ObligationCollateral {
  /** Reserve collateral is deposited to */
  depositReserve: PublicKey;
  /** Amount of collateral deposited */
  depositedAmount: BN;
  /** Collateral market value in quote currency (WAD-scaled) */
  marketValue: BN;
}

/** Obligation liquidity borrow */
export interface ObligationLiquidity {
  /** Reserve liquidity is borrowed from */
  borrowReserve: PublicKey;
  /** Cumulative borrow rate at time of last update (WAD-scaled) */
  cumulativeBorrowRateWads: BN;
  /** Amount of liquidity borrowed plus interest (WAD-scaled) */
  borrowedAmountWads: BN;
  /** Liquidity market value in quote currency (WAD-scaled) */
  marketValue: BN;
}

/** Lending market obligation state */
export interface Obligation {
  /** Version of the struct */
  version: number;
  /** Last update to collateral, liquidity, or their market values */
  lastUpdate: LastUpdate;
  /** Lending market address */
  lendingMarket: PublicKey;
  /** Owner authority which can borrow liquidity */
  owner: PublicKey;
  /** Deposited collateral for the obligation */
  deposits: ObligationCollateral[];
  /** Borrowed liquidity for the obligation */
  borrows: ObligationLiquidity[];
  /** Market value of deposits (WAD-scaled) */
  depositedValue: BN;
  /** Market value of borrows (WAD-scaled) */
  borrowedValue: BN;
  /** Maximum borrow value at weighted average LTV (WAD-scaled) */
  allowedBorrowValue: BN;
  /** Dangerous borrow value at weighted average liquidation threshold (WAD-scaled) */
  unhealthyBorrowValue: BN;
}

/** Lending market state */
export interface LendingMarket {
  /** Version of lending market */
  version: number;
  /** Bump seed for derived authority address */
  bumpSeed: number;
  /** Owner authority which can add new reserves */
  owner: PublicKey;
  /** Currency market prices are quoted in (e.g. "USD" null-padded to 32 bytes) */
  quoteCurrency: Uint8Array;
  /** Token program id */
  tokenProgramId: PublicKey;
}
