import { VolumeConfig, VolumeStats } from './volumeBot';

// Get the base URL for API calls
const getBaseUrl = () => (window as any).tradingServerUrl?.replace(/\/+$/, '') || '';

export interface VolumeStartRequest {
  tokenAddress: string;
  wallets: string[];
  minAmount: number;
  maxAmount: number;
  intervalMin: number;
  intervalMax: number;
  duration: number;
  slippage: number;
}

export interface VolumeStartResponse {
  success: boolean;
  sessionId?: string;
  message?: string;
  error?: string;
}

export interface VolumeStopRequest {
  sessionId: string;
}

export interface VolumeStopResponse {
  success: boolean;
  stats?: VolumeStats;
  message?: string;
  error?: string;
}

export interface VolumeStatusRequest {
  sessionId: string;
}

export interface VolumeStatusResponse {
  success: boolean;
  stats?: VolumeStats;
  isRunning?: boolean;
  error?: string;
}

export interface VolumeTradeRequest {
  sessionId: string;
  walletPrivateKey: string;
  tokenAddress: string;
  amount: number;
  isBuy: boolean;
  slippage: number;
}

export interface VolumeTradeResponse {
  success: boolean;
  transactionId?: string;
  volume?: number;
  error?: string;
}

/**
 * Start a volume bot session on the backend
 */
export const startVolumeBotSession = async (config: VolumeConfig): Promise<VolumeStartResponse> => {
  try {
    const baseUrl = getBaseUrl();
    
    const requestBody: VolumeStartRequest = {
      tokenAddress: config.tokenAddress,
      wallets: config.wallets,
      minAmount: config.minAmount,
      maxAmount: config.maxAmount,
      intervalMin: config.intervalMin,
      intervalMax: config.intervalMax,
      duration: config.duration,
      slippage: config.slippage
    };

    const response = await fetch(`${baseUrl}/api/volume/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data: VolumeStartResponse = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to start volume bot session');
    }

    return data;
  } catch (error) {
    console.error('Error starting volume bot session:', error);
    throw error;
  }
};

/**
 * Stop a volume bot session on the backend
 */
export const stopVolumeBotSession = async (sessionId: string): Promise<VolumeStopResponse> => {
  try {
    const baseUrl = getBaseUrl();
    
    const requestBody: VolumeStopRequest = {
      sessionId
    };

    const response = await fetch(`${baseUrl}/api/volume/stop`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data: VolumeStopResponse = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to stop volume bot session');
    }

    return data;
  } catch (error) {
    console.error('Error stopping volume bot session:', error);
    throw error;
  }
};

/**
 * Get the status and stats of a volume bot session
 */
export const getVolumeBotSessionStatus = async (sessionId: string): Promise<VolumeStatusResponse> => {
  try {
    const baseUrl = getBaseUrl();
    
    const response = await fetch(`${baseUrl}/api/volume/status/${sessionId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data: VolumeStatusResponse = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to get volume bot session status');
    }

    return data;
  } catch (error) {
    console.error('Error getting volume bot session status:', error);
    throw error;
  }
};

/**
 * Execute a single volume trade through the backend
 */
export const executeVolumeTrade = async (
  sessionId: string,
  walletPrivateKey: string,
  tokenAddress: string,
  amount: number,
  isBuy: boolean,
  slippage: number = 5
): Promise<VolumeTradeResponse> => {
  try {
    const baseUrl = getBaseUrl();
    
    const requestBody: VolumeTradeRequest = {
      sessionId,
      walletPrivateKey,
      tokenAddress,
      amount,
      isBuy,
      slippage
    };

    const response = await fetch(`${baseUrl}/api/volume/trade`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data: VolumeTradeResponse = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to execute volume trade');
    }

    return data;
  } catch (error) {
    console.error('Error executing volume trade:', error);
    throw error;
  }
};

/**
 * Validate wallets for volume bot usage
 */
export const validateVolumeBotWallets = async (wallets: string[]): Promise<{
  success: boolean;
  validWallets: string[];
  invalidWallets: string[];
  error?: string;
}> => {
  try {
    const baseUrl = getBaseUrl();
    
    const response = await fetch(`${baseUrl}/api/volume/validate-wallets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ wallets })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to validate wallets');
    }

    return {
      success: true,
      validWallets: data.validWallets || [],
      invalidWallets: data.invalidWallets || []
    };
  } catch (error) {
    console.error('Error validating volume bot wallets:', error);
    return {
      success: false,
      validWallets: [],
      invalidWallets: wallets,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

/**
 * Get wallet balances for volume bot usage
 */
export const getVolumeBotWalletBalances = async (wallets: string[]): Promise<{
  success: boolean;
  balances: Array<{ wallet: string; solBalance: number; publicKey: string }>;
  error?: string;
}> => {
  try {
    const baseUrl = getBaseUrl();
    
    const response = await fetch(`${baseUrl}/api/volume/wallet-balances`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ wallets })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to get wallet balances');
    }

    return {
      success: true,
      balances: data.balances || []
    };
  } catch (error) {
    console.error('Error getting volume bot wallet balances:', error);
    return {
      success: false,
      balances: [],
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};