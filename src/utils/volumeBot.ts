import { VolumeConfig, VolumeStats } from '../types/volume';
import { executeBuy, createBuyConfig, WalletBuy } from './buy';
import { executeSell, createSellConfig, WalletSell } from './sell';
import { loadConfigFromCookies } from '../Utils';

// Volume bot class
export class VolumeBot {
  private config: VolumeConfig | null = null;
  private stats: VolumeStats = {
    totalTrades: 0,
    totalVolume: 0,
    successfulTrades: 0,
    failedTrades: 0,
    totalBuys: 0,
    totalSells: 0
  };
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private lastUsedWalletIndex: number = -1;
  private lastTradeType: 'buy' | 'sell' | null = null;

  constructor() {
    // No need for connection since we use existing buy/sell functions
  }

  async start(config: VolumeConfig): Promise<void> {
    console.log('🚀 Starting volume bot with config:', config);
    
    if (this.isRunning) {
      throw new Error('Volume bot is already running');
    }

    // Validate trading server URL
    const tradingServerUrl = (window as any).tradingServerUrl;
    if (!tradingServerUrl) {
      throw new Error('Trading server URL not configured. Please check your server connection in settings.');
    }

    this.config = config;
    this.isRunning = true;

    console.log('✅ Volume bot started with', config.wallets.length, 'wallets');
    
    // Start the trading loop
    this.startTradingLoop();
  }

  stop(): void {
    console.log('🛑 Stopping volume bot');
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    this.isRunning = false;
    this.config = null;
  }

  getStats(): VolumeStats {
    return { ...this.stats };
  }

  isActive(): boolean {
    return this.isRunning;
  }

  private startTradingLoop(): void {
    if (!this.config) return;

    const executeSmartTrade = async () => {
      if (!this.isRunning || !this.config) return;

      try {
        // Smart trading logic: alternate between buy/sell and use different wallets
        const shouldBuy = this.lastTradeType !== 'buy' ? true : Math.random() > 0.4;
        
        if (shouldBuy) {
          await this.executeBuyTrade();
          this.lastTradeType = 'buy';
        } else {
          await this.executeSellTrade();
          this.lastTradeType = 'sell';
        }
      } catch (error) {
        console.error('❌ Volume bot trade error:', error);
        this.stats.failedTrades++;
      }
    };

    // Execute first trade immediately
    setTimeout(executeSmartTrade, 500);

    // Use user-configured interval (convert seconds to milliseconds)
    const userInterval = this.getRandomInterval();
    console.log(`⏱️ Using ${userInterval/1000}s interval for trading`);
    
    this.intervalId = setInterval(() => {
      const nextInterval = this.getRandomInterval();
      executeSmartTrade();
      
      // Update interval for next trade
      if (this.intervalId) {
        clearInterval(this.intervalId);
        this.intervalId = setInterval(executeSmartTrade, nextInterval);
      }
    }, userInterval);

    // Stop after duration if specified
    if (this.config.duration > 0) {
      setTimeout(() => {
        this.stop();
      }, this.config.duration * 60 * 1000); // Convert minutes to milliseconds
    }
  }

  private async executeBuyTrade(): Promise<void> {
    if (!this.config) return;

    try {
      console.log('📈 Executing volume bot buy trade');

      // Select only ONE wallet for staggered trading
      const selectedWallet = await this.selectSingleRandomWallet();
      
      if (!selectedWallet) {
        console.warn('⚠️ No wallet available for buy trade');
        return;
      }
      
      // Generate random buy amount within configured range
      const buyAmount = this.generateRandomAmount();
      
      console.log(`💰 Buying ${buyAmount} SOL worth of ${this.config.tokenAddress} with wallet ${selectedWallet.address.substring(0, 6)}...`);
      
      // Create buy config for single wallet
      const buyConfig = createBuyConfig({
        tokenAddress: this.config.tokenAddress,
        protocol: this.config.protocol || 'auto',
        solAmount: buyAmount,
        bundleMode: 'single', // Always use single mode for volume trading
        singleDelay: 100 // Optimized delay for faster trading
      });

      // Execute buy with retry logic
      const result = await this.executeWithRetry(() => executeBuy([selectedWallet], buyConfig), 'buy');
      
      if (result.success) {
        console.log('✅ Volume bot buy successful');
        this.stats.successfulTrades++;
        this.stats.totalVolume += buyAmount;
        this.stats.totalBuys++;
      } else {
        console.error('❌ Volume bot buy failed:', result.error || 'Unknown error');
        this.stats.failedTrades++;
      }
      
      this.stats.totalTrades++;
    } catch (error) {
      console.error('❌ Volume bot buy trade error:', error);
      this.stats.failedTrades++;
      this.stats.totalTrades++;
    }
  }

  private async executeSellTrade(): Promise<void> {
    if (!this.config) return;

    try {
      console.log('📉 Executing volume bot sell trade');

      // Select only ONE wallet for staggered trading
      const selectedWallet = await this.selectSingleRandomWallet();
      
      if (!selectedWallet) {
        console.warn('⚠️ No wallet available for sell trade');
        return;
      }
      
      // Use configured sell percentage or random between 10-50%
      const sellPercent = this.config.sellPercent || (Math.floor(Math.random() * 40) + 10);
      
      console.log(`💸 Selling ${sellPercent}% of ${this.config.tokenAddress} from wallet ${selectedWallet.address.substring(0, 6)}...`);
      
      // Create sell config for single wallet
      const sellConfig = createSellConfig({
        tokenAddress: this.config.tokenAddress,
        protocol: this.config.protocol || 'auto',
        sellPercent: sellPercent,
        bundleMode: 'single', // Always use single mode for volume trading
        singleDelay: 100 // Optimized delay for faster trading
      });

      // Execute sell with retry logic
      const result = await this.executeWithRetry(() => executeSell([selectedWallet], sellConfig), 'sell');
      
      if (result.success) {
        console.log('✅ Volume bot sell successful');
        this.stats.successfulTrades++;
        this.stats.totalSells++;
      } else {
        console.error('❌ Volume bot sell failed:', result.error || 'Unknown error');
        this.stats.failedTrades++;
      }
      
      this.stats.totalTrades++;
    } catch (error) {
      console.error('❌ Volume bot sell trade error:', error);
      this.stats.failedTrades++;
      this.stats.totalTrades++;
    }
  }

  private async selectSingleRandomWallet(): Promise<{ address: string; privateKey: string } | null> {
    if (!this.config || this.config.wallets.length === 0) return null;

    // Smart wallet selection: use different wallet than last time for realistic volume
    let walletIndex;
    if (this.config.wallets.length === 1) {
      walletIndex = 0;
    } else {
      // Ensure we don't use the same wallet consecutively
      do {
        walletIndex = Math.floor(Math.random() * this.config.wallets.length);
      } while (walletIndex === this.lastUsedWalletIndex && this.config.wallets.length > 1);
    }
    
    this.lastUsedWalletIndex = walletIndex;
    const privateKey = this.config.wallets[walletIndex];
    
    try {
      const address = await this.getAddressFromPrivateKey(privateKey);
      return {
        address,
        privateKey
      };
    } catch (error) {
      console.error('Error getting address from private key:', error);
      return null;
    }
  }

  private getRandomInterval(): number {
    if (!this.config) return 5000;
    
    // Use intervalMin and intervalMax if available, otherwise use interval
    if (this.config.intervalMin && this.config.intervalMax) {
      const min = this.config.intervalMin * 1000;
      const max = this.config.intervalMax * 1000;
      return Math.floor(Math.random() * (max - min + 1)) + min;
    }
    
    // Use the main interval field (convert seconds to milliseconds)
    return this.config.interval * 1000;
  }

  private generateRandomAmount(): number {
    if (!this.config) return 0.01;

    const min = this.config.minAmount || 0.01;
    const max = this.config.maxAmount || 0.1;
    
    // Generate random amount between min and max, respecting volume settings
    const amount = Math.random() * (max - min) + min;
    
    // Round to 4 decimal places for cleaner amounts
    return Math.round(amount * 10000) / 10000;
  }

  private async executeWithRetry<T>(operation: () => Promise<T>, operationType: string = 'operation', maxRetries: number = 3): Promise<T> {
    let lastError: any;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 Attempting ${operationType} trade (attempt ${attempt}/${maxRetries})`);
        const result = await operation();
        return result;
      } catch (error: any) {
        lastError = error;
        console.warn(`⚠️ ${operationType} attempt ${attempt} failed:`, error.message);
        
        // Check if it's a network error that might be recoverable
        const isNetworkError = error.message?.includes('fetch') || 
                              error.message?.includes('network') ||
                              error.message?.includes('ECONNREFUSED') ||
                              error.message?.includes('timeout');
        
        if (attempt === maxRetries || !isNetworkError) {
          break;
        }
        
        // Wait before retry with exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        console.log(`⏳ Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError;
  }

  private async getAddressFromPrivateKey(privateKey: string): Promise<string> {
    try {
      const { Keypair } = await import('@solana/web3.js');
      const bs58 = await import('bs58');
      
      const keypair = Keypair.fromSecretKey(bs58.default.decode(privateKey));
      return keypair.publicKey.toString();
    } catch (error) {
      console.error('Error getting address from private key:', error);
      return '';
    }
  }
}

// Export singleton instance
export const volumeBot = new VolumeBot();

// Export utility functions for backward compatibility
export const startVolumeBot = async (config: VolumeConfig): Promise<void> => {
  return volumeBot.start(config);
};

export const stopVolumeBot = async (): Promise<void> => {
  volumeBot.stop();
};

export const getVolumeBotStats = (): VolumeStats => {
  return volumeBot.getStats();
};

export const validateVolumeBotWallets = async (wallets: string[]): Promise<{ valid: string[], invalid: string[] }> => {
  // Simple validation - check if wallets are valid base58 strings
  const valid: string[] = [];
  const invalid: string[] = [];
  
  for (const wallet of wallets) {
    try {
      const { Keypair } = await import('@solana/web3.js');
      const bs58 = await import('bs58');
      Keypair.fromSecretKey(bs58.default.decode(wallet));
      valid.push(wallet);
    } catch (error) {
      invalid.push(wallet);
    }
  }
  
  return { valid, invalid };
};

export const getVolumeBotWalletBalances = async (wallets: string[]): Promise<Array<{ wallet: string, solBalance: number, publicKey: string }>> => {
  const balances = [];
  
  for (const wallet of wallets) {
    try {
      const { Keypair } = await import('@solana/web3.js');
      const bs58 = await import('bs58');
      const keypair = Keypair.fromSecretKey(bs58.default.decode(wallet));
      
      balances.push({
        wallet: wallet.substring(0, 8) + '...',
        solBalance: 0, // Would need RPC connection to get actual balance
        publicKey: keypair.publicKey.toString()
      });
    } catch (error) {
      balances.push({
        wallet: wallet.substring(0, 8) + '...',
        solBalance: 0,
        publicKey: 'Invalid'
      });
    }
  }
  
  return balances;
};

// Export for direct usage
export default volumeBot;