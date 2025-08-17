export interface VolumeConfig {
  tokenAddress: string;
  wallets: string[];
  minAmount: number;
  maxAmount: number;
  intervalMin?: number;
  intervalMax?: number;
  interval: number; // Main interval in seconds
  duration: number;
  slippage?: number;
  sellPercent?: number;
  protocol?: 'pumpfun' | 'moonshot' | 'launchpad' | 'raydium' | 'pumpswap' | 'auto' | 'boopfun' | 'meteora';
}

export interface VolumeStats {
  totalVolume: number;
  totalTrades: number;
  successfulTrades: number;
  failedTrades: number;
  totalBuys?: number;
  totalSells?: number;
  startTime?: number;
  isRunning?: boolean;
}

export interface VolumeWalletValidation {
  valid: string[];
  invalid: string[];
}

export interface VolumeWalletBalance {
  wallet: string;
  solBalance: number;
  publicKey: string;
}