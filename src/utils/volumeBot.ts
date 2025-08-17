import { Connection, PublicKey, Keypair, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, createTransferInstruction } from '@solana/spl-token';
import { toast } from 'react-hot-toast';
import { 
  startVolumeBotSession, 
  stopVolumeBotSession, 
  getVolumeBotSessionStatus,
  validateVolumeBotWallets as validateWalletsApi,
  getVolumeBotWalletBalances as getWalletBalancesApi
} from './volumeBotApi';

export interface VolumeConfig {
  tokenAddress: string;
  wallets: string[];
  minAmount: number;
  maxAmount: number;
  intervalMin: number;
  intervalMax: number;
  duration: number;
  slippage: number;
}

export interface VolumeStats {
  totalVolume: number;
  totalTrades: number;
  successfulTrades: number;
  failedTrades: number;
  startTime: number;
  isRunning: boolean;
}

class VolumeBot {
  private connection: Connection;
  private config: VolumeConfig | null = null;
  private stats: VolumeStats = {
    totalVolume: 0,
    totalTrades: 0,
    successfulTrades: 0,
    failedTrades: 0,
    startTime: 0,
    isRunning: false
  };
  private sessionId: string | null = null;
  private statusCheckInterval: NodeJS.Timeout | null = null;

  constructor(rpcUrl: string = 'https://api.mainnet-beta.solana.com') {
    this.connection = new Connection(rpcUrl, 'confirmed');
  }

  public async start(config: VolumeConfig): Promise<void> {
    if (this.stats.isRunning) {
      throw new Error('Volume bot is already running');
    }

    try {
      // Start session on backend
      const response = await startVolumeBotSession(config);
      
      if (!response.success || !response.sessionId) {
        throw new Error(response.error || 'Failed to start volume bot session');
      }

      this.sessionId = response.sessionId;
      this.config = config;
      this.stats = {
        totalVolume: 0,
        totalTrades: 0,
        successfulTrades: 0,
        failedTrades: 0,
        startTime: Date.now(),
        isRunning: true
      };

      console.log('Volume bot session started:', response.sessionId);
      toast.success('Volume bot started successfully');

      // Start periodic status checking
      this.startStatusChecking();
      
    } catch (error) {
      console.error('Failed to start volume bot:', error);
      throw error;
    }
  }

  public async stop(): Promise<void> {
    if (!this.stats.isRunning || !this.sessionId) {
      return;
    }

    try {
      // Stop session on backend
      const response = await stopVolumeBotSession(this.sessionId);
      
      if (response.success && response.stats) {
        this.stats = { ...response.stats, isRunning: false };
      } else {
        this.stats.isRunning = false;
      }

      // Clear status checking
      if (this.statusCheckInterval) {
        clearInterval(this.statusCheckInterval);
        this.statusCheckInterval = null;
      }

      console.log('Volume bot stopped. Final stats:', this.stats);
      toast.success('Volume bot stopped');
      
      this.sessionId = null;
      
    } catch (error) {
      console.error('Error stopping volume bot:', error);
      this.stats.isRunning = false;
      this.sessionId = null;
      
      if (this.statusCheckInterval) {
        clearInterval(this.statusCheckInterval);
        this.statusCheckInterval = null;
      }
      
      toast.error('Error stopping volume bot');
    }
  }

  public getStats(): VolumeStats {
    return { ...this.stats };
  }

  private startStatusChecking(): void {
    if (!this.sessionId) return;

    // Check status every 10 seconds
    this.statusCheckInterval = setInterval(async () => {
      if (!this.sessionId) {
        if (this.statusCheckInterval) {
          clearInterval(this.statusCheckInterval);
          this.statusCheckInterval = null;
        }
        return;
      }

      try {
        const response = await getVolumeBotSessionStatus(this.sessionId);
        
        if (response.success && response.stats) {
          this.stats = response.stats;
          
          // If bot stopped on backend, update local state
          if (!response.isRunning) {
            this.stats.isRunning = false;
            this.sessionId = null;
            
            if (this.statusCheckInterval) {
              clearInterval(this.statusCheckInterval);
              this.statusCheckInterval = null;
            }
            
            console.log('Volume bot session completed on backend');
          }
        }
      } catch (error) {
        console.error('Error checking volume bot status:', error);
      }
    }, 10000);
  }

  public async validateWallets(wallets: string[]): Promise<{ valid: string[], invalid: string[] }> {
    try {
      const response = await validateWalletsApi(wallets);
      
      if (response.success) {
        return {
          valid: response.validWallets,
          invalid: response.invalidWallets
        };
      } else {
        // Fallback to local validation if API fails
        return this.validateWalletsLocally(wallets);
      }
    } catch (error) {
      console.error('API wallet validation failed, using local validation:', error);
      return this.validateWalletsLocally(wallets);
    }
  }

  private async validateWalletsLocally(wallets: string[]): Promise<{ valid: string[], invalid: string[] }> {
    const valid: string[] = [];
    const invalid: string[] = [];

    for (const wallet of wallets) {
      try {
        const keypair = Keypair.fromSecretKey(new Uint8Array(JSON.parse(wallet)));
        const balance = await this.connection.getBalance(keypair.publicKey);
        
        if (balance > 0) {
          valid.push(wallet);
        } else {
          invalid.push(wallet);
        }
      } catch (error) {
        invalid.push(wallet);
      }
    }

    return { valid, invalid };
  }

  public async getWalletBalances(wallets: string[]): Promise<Array<{ wallet: string, solBalance: number, publicKey: string }>> {
    try {
      const response = await getWalletBalancesApi(wallets);
      
      if (response.success) {
        return response.balances;
      } else {
        // Fallback to local balance checking if API fails
        return this.getWalletBalancesLocally(wallets);
      }
    } catch (error) {
      console.error('API wallet balance check failed, using local check:', error);
      return this.getWalletBalancesLocally(wallets);
    }
  }

  private async getWalletBalancesLocally(wallets: string[]): Promise<Array<{ wallet: string, solBalance: number, publicKey: string }>> {
    const balances = [];

    for (const wallet of wallets) {
      try {
        const keypair = Keypair.fromSecretKey(new Uint8Array(JSON.parse(wallet)));
        const balance = await this.connection.getBalance(keypair.publicKey);
        const solBalance = balance / LAMPORTS_PER_SOL;
        
        balances.push({
          wallet: wallet.substring(0, 8) + '...',
          solBalance,
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
  }
}

// Export singleton instance
export const volumeBot = new VolumeBot();

// Export utility functions
export const startVolumeBot = async (config: VolumeConfig): Promise<void> => {
  return volumeBot.start(config);
};

export const stopVolumeBot = async (): Promise<void> => {
  await volumeBot.stop();
};

export const getVolumeBotStats = (): VolumeStats => {
  return volumeBot.getStats();
};

export const validateVolumeBotWallets = async (wallets: string[]): Promise<{ valid: string[], invalid: string[] }> => {
  return volumeBot.validateWallets(wallets);
};

export const getVolumeBotWalletBalances = async (wallets: string[]): Promise<Array<{ wallet: string, solBalance: number, publicKey: string }>> => {
  return volumeBot.getWalletBalances(wallets);
};