import { Keypair, VersionedTransaction } from '@solana/web3.js';
import bs58 from 'bs58';
import { loadConfigFromCookies } from '../Utils';

// Constants
const MAX_BUNDLES_PER_SECOND = 10; // Increased from 2 to allow faster trading
const MAX_TRANSACTIONS_PER_BUNDLE = 5;

// Rate limiting state
const rateLimitState = {
  count: 0,
  lastReset: Date.now(),
  maxBundlesPerSecond: MAX_BUNDLES_PER_SECOND
};

// Interfaces
export interface WalletSell {
  address: string;
  privateKey: string;
}

export type BundleMode = 'single' | 'batch' | 'all-in-one';

export interface SellConfig {
  tokenAddress: string;
  protocol: 'pumpfun' | 'moonshot' | 'launchpad' | 'raydium' | 'pumpswap' | 'auto' | 'boopfun' | 'meteora'| 'auto';
  sellPercent: number; // Percentage of tokens to sell (1-100)
  slippageBps?: number; // Slippage tolerance in basis points (e.g., 100 = 1%)
  outputMint?: string; // Output token (usually SOL) - mainly for Auto
  jitoTipLamports?: number; // Custom Jito tip in lamports
  bundleMode?: BundleMode; // Bundle execution mode: 'single', 'batch', or 'all-in-one'
  batchDelay?: number; // Delay between batches in milliseconds (for batch mode)
  singleDelay?: number; // Delay between wallets in milliseconds (for single mode)
}

export interface SellBundle {
  transactions: string[]; // Base58 encoded transaction data
}

export interface SellResult {
  success: boolean;
  result?: any;
  error?: string;
}

// Define interface for bundle result from sending
interface BundleResult {
  jsonrpc: string;
  id: number;
  result?: string;
  error?: {
    code: number;
    message: string;
  };
}

/**
 * Check rate limit and wait if necessary
 */
const checkRateLimit = async (): Promise<void> => {
  const now = Date.now();
  
  if (now - rateLimitState.lastReset >= 1000) {
    rateLimitState.count = 0;
    rateLimitState.lastReset = now;
  }
  
  if (rateLimitState.count >= rateLimitState.maxBundlesPerSecond) {
    const waitTime = 1000 - (now - rateLimitState.lastReset);
    await new Promise(resolve => setTimeout(resolve, waitTime));
    rateLimitState.count = 0;
    rateLimitState.lastReset = Date.now();
  }
  
  rateLimitState.count++;
};

/**
 * Send bundle to Jito block engine through our backend proxy
 */
const sendBundle = async (encodedBundle: string[]): Promise<BundleResult> => {
  try {
    const baseUrl = (window as any).tradingServerUrl?.replace(/\/+$/, '') || '';
    console.log('sell sendBundle - Trading server URL:', (window as any).tradingServerUrl);
    console.log('sell sendBundle - Base URL:', baseUrl);
    
    if (!baseUrl) {
      throw new Error('Trading server URL not configured. Please check your server connection.');
    }
    
    // Send to our backend proxy instead of directly to Jito
    const response = await fetch(`${baseUrl}/api/transactions/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transactions: encodedBundle
      }),
    });

    const data = await response.json();
    
    return data.result;
  } catch (error) {
    console.error('Error sending bundle:', error);
    throw error;
  }
};

/**
 * Get partially prepared sell transactions from backend
 * The backend will create transactions without signing them and group them into bundles
 */
const getPartiallyPreparedSellTransactions = async (
  walletAddresses: string[], 
  sellConfig: SellConfig
): Promise<SellBundle[]> => {
  try {
    const baseUrl = (window as any).tradingServerUrl?.replace(/\/+$/, '') || '';
    console.log('sell getPartiallyPreparedSellTransactions - Trading server URL:', (window as any).tradingServerUrl);
    console.log('sell getPartiallyPreparedSellTransactions - Base URL:', baseUrl);
    
    if (!baseUrl) {
      throw new Error('Trading server URL not configured. Please check your server connection.');
    }
    
    const config = loadConfigFromCookies();
    
    const requestBody: any = {
      walletAddresses,
      tokenAddress: sellConfig.tokenAddress,
      protocol: sellConfig.protocol,
      percentage: sellConfig.sellPercent
    };

    // Use custom Jito tip if provided, otherwise use default from config
    if (sellConfig.jitoTipLamports !== undefined) {
      requestBody.jitoTipLamports = sellConfig.jitoTipLamports;
    } else {
      // Get fee in SOL (string) with default if not found
      const feeInSol = config?.transactionFee || '0.005';
      requestBody.jitoTipLamports = Math.floor(parseFloat(feeInSol) * 1_000_000_000);
    }

    // Add slippage parameter for all protocols
    if (sellConfig.slippageBps !== undefined) {
      requestBody.slippageBps = sellConfig.slippageBps;
    } else {
      // Use default slippage from app config if available
      const appConfig = loadConfigFromCookies();
      if (appConfig?.slippageBps) {
        requestBody.slippageBps = parseInt(appConfig.slippageBps);
      }
    }

    // Add Auto-specific parameters if needed
    if (sellConfig.protocol === 'auto') {
      if (sellConfig.outputMint) {
        requestBody.outputMint = sellConfig.outputMint;
      }
    }

    const response = await fetch(`${baseUrl}/api/tokens/sell`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': '' 
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to get partially prepared transactions');
    }
    
    // Handle different response formats to ensure compatibility
    if (data.bundles && Array.isArray(data.bundles)) {
      // Wrap any bundle that is a plain array
      return data.bundles.map((bundle: any) =>
        Array.isArray(bundle) ? { transactions: bundle } : bundle
      );
    } else if (data.transactions && Array.isArray(data.transactions)) {
      // If we get a flat array of transactions, create a single bundle
      return [{ transactions: data.transactions }];
    } else if (Array.isArray(data)) {
      // Legacy format where data itself is an array
      return [{ transactions: data }];
    } else {
      throw new Error('No transactions returned from backend');
    }
  } catch (error) {
    console.error('Error getting partially prepared sell transactions:', error);
    throw error;
  }
};

/**
 * Complete bundle signing
 */
const completeBundleSigning = (
  bundle: SellBundle, 
  walletKeypairs: Keypair[]
): SellBundle => {
  // Check if the bundle has a valid transactions array
  if (!bundle.transactions || !Array.isArray(bundle.transactions)) {
    console.error("Invalid bundle format, transactions property is missing or not an array:", bundle);
    return { transactions: [] };
  }

  const signedTransactions = bundle.transactions.map(txBase58 => {
    // Handle case where a transaction couldn't be prepared
    if (!txBase58) {
      console.warn(`Transaction is null or undefined`);
      return null;
    }

    try {
      // Deserialize transaction
      const txBuffer = bs58.decode(txBase58);
      const transaction = VersionedTransaction.deserialize(txBuffer);
      
      // Extract required signers from staticAccountKeys
      const signers: Keypair[] = [];
      for (const accountKey of transaction.message.staticAccountKeys) {
        const pubkeyStr = accountKey.toBase58();
        const matchingKeypair = walletKeypairs.find(
          kp => kp.publicKey.toBase58() === pubkeyStr
        );
        if (matchingKeypair && !signers.includes(matchingKeypair)) {
          signers.push(matchingKeypair);
        }
      }
      
      if (signers.length === 0) {
        console.warn(`No matching signers found for transaction`);
        return null;
      }
      
      // Sign the transaction
      transaction.sign(signers);
      
      // Serialize and encode the fully signed transaction
      return bs58.encode(transaction.serialize());
    } catch (error) {
      console.error(`Error signing transaction:`, error);
      return null;
    }
  }).filter(tx => tx !== null); // Filter out any null transactions
  
  return { transactions: signedTransactions };
};

/**
 * Split bundles to ensure each has at most MAX_TRANSACTIONS_PER_BUNDLE transactions
 */
const splitLargeBundles = (bundles: SellBundle[]): SellBundle[] => {
  const result: SellBundle[] = [];
  
  for (const bundle of bundles) {
    if (!bundle.transactions || !Array.isArray(bundle.transactions)) {
      continue; // Skip invalid bundles
    }
    
    if (bundle.transactions.length <= MAX_TRANSACTIONS_PER_BUNDLE) {
      // If the bundle is already small enough, keep it as is
      result.push(bundle);
    } else {
      // Split the bundle into smaller ones
      for (let i = 0; i < bundle.transactions.length; i += MAX_TRANSACTIONS_PER_BUNDLE) {
        const chunkTransactions = bundle.transactions.slice(i, i + MAX_TRANSACTIONS_PER_BUNDLE);
        result.push({ transactions: chunkTransactions });
      }
    }
  }
  
  return result;
};

/**
 * Execute sell in single mode - prepare and send each wallet separately
 */
const executeSellSingleMode = async (
  wallets: WalletSell[],
  sellConfig: SellConfig
): Promise<SellResult> => {
  let results: BundleResult[] = [];
  let successfulWallets = 0;
  let failedWallets = 0;

  for (let i = 0; i < wallets.length; i++) {
    const wallet = wallets[i];
    console.log(`Processing wallet ${i + 1}/${wallets.length}: ${wallet.address.substring(0, 8)}...`);

    try {
      // Get transactions for single wallet
      const partiallyPreparedBundles = await getPartiallyPreparedSellTransactions([wallet.address], sellConfig);
      
      if (partiallyPreparedBundles.length === 0) {
        console.warn(`No transactions for wallet ${wallet.address}`);
        failedWallets++;
        continue;
      }

      // Create keypair for this wallet
      const walletKeypair = Keypair.fromSecretKey(bs58.decode(wallet.privateKey));

      // Sign and send each bundle for this wallet
      for (const bundle of partiallyPreparedBundles) {
        const signedBundle = completeBundleSigning(bundle, [walletKeypair]);
        
        if (signedBundle.transactions.length > 0) {
          await checkRateLimit();
          const result = await sendBundle(signedBundle.transactions);
          results.push(result);
        }
      }

      successfulWallets++;
      
      // Add delay between wallets (except after the last one)
      if (i < wallets.length - 1) {
        await new Promise(resolve => setTimeout(resolve, sellConfig.singleDelay || 200)); // Configurable delay between wallets
      }
    } catch (error) {
      console.error(`Error processing wallet ${wallet.address}:`, error);
      failedWallets++;
    }
  }

  return {
    success: successfulWallets > 0,
    result: results,
    error: failedWallets > 0 ? `${failedWallets} wallets failed, ${successfulWallets} succeeded` : undefined
  };
};

/**
 * Execute sell in batch mode - prepare 5 wallets per bundle and send with custom delay
 */
const executeSellBatchMode = async (
  wallets: WalletSell[],
  sellConfig: SellConfig
): Promise<SellResult> => {
  const batchSize = 5;
  const batchDelay = sellConfig.batchDelay || 1000; // Default 1 second delay
  let results: BundleResult[] = [];
  let successfulBatches = 0;
  let failedBatches = 0;

  // Split wallets into batches
  const batches: WalletSell[][] = [];
  for (let i = 0; i < wallets.length; i += batchSize) {
    batches.push(wallets.slice(i, i + batchSize));
  }

  console.log(`Processing ${batches.length} batches of up to ${batchSize} wallets each`);

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    console.log(`Processing batch ${i + 1}/${batches.length} with ${batch.length} wallets`);

    try {
      // Get wallet addresses for this batch
      const walletAddresses = batch.map(wallet => wallet.address);
      
      // Get transactions for this batch
      const partiallyPreparedBundles = await getPartiallyPreparedSellTransactions(walletAddresses, sellConfig);
      
      if (partiallyPreparedBundles.length === 0) {
        console.warn(`No transactions for batch ${i + 1}`);
        failedBatches++;
        continue;
      }

      // Create keypairs for this batch
      const walletKeypairs = batch.map(wallet => 
        Keypair.fromSecretKey(bs58.decode(wallet.privateKey))
      );

      // Split bundles and sign them
      const splitBundles = splitLargeBundles(partiallyPreparedBundles);
      const signedBundles = splitBundles.map(bundle =>
        completeBundleSigning(bundle, walletKeypairs)
      );

      // Send all bundles for this batch
      for (const bundle of signedBundles) {
        if (bundle.transactions.length > 0) {
          await checkRateLimit();
          const result = await sendBundle(bundle.transactions);
          results.push(result);
        }
      }

      successfulBatches++;
      
      // Add delay between batches (except after the last one)
      if (i < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, batchDelay));
      }
    } catch (error) {
      console.error(`Error processing batch ${i + 1}:`, error);
      failedBatches++;
    }
  }

  return {
    success: successfulBatches > 0,
    result: results,
    error: failedBatches > 0 ? `${failedBatches} batches failed, ${successfulBatches} succeeded` : undefined
  };
};

/**
 * Execute sell in all-in-one mode - prepare all wallets and send all bundles simultaneously
 */
const executeSellAllInOneMode = async (
  wallets: WalletSell[],
  sellConfig: SellConfig
): Promise<SellResult> => {
  console.log(`Preparing all ${wallets.length} wallets for simultaneous execution`);

  // Extract wallet addresses
  const walletAddresses = wallets.map(wallet => wallet.address);
  
  // Get all transactions at once
  const partiallyPreparedBundles = await getPartiallyPreparedSellTransactions(walletAddresses, sellConfig);
  
  if (partiallyPreparedBundles.length === 0) {
    return {
      success: false,
      error: 'No transactions generated. Wallets might not have sufficient token balance.'
    };
  }

  // Create all keypairs
  const walletKeypairs = wallets.map(wallet => 
    Keypair.fromSecretKey(bs58.decode(wallet.privateKey))
  );

  // Split and sign all bundles
  const splitBundles = splitLargeBundles(partiallyPreparedBundles);
  const signedBundles = splitBundles.map(bundle =>
    completeBundleSigning(bundle, walletKeypairs)
  );

  // Filter out empty bundles
  const validSignedBundles = signedBundles.filter(bundle => bundle.transactions.length > 0);
  
  if (validSignedBundles.length === 0) {
    return {
      success: false,
      error: 'Failed to sign any transactions'
    };
  }

  console.log(`Sending all ${validSignedBundles.length} bundles simultaneously with 100ms delays`);

  // Send all bundles simultaneously with 100ms delays to avoid rate limits
  const bundlePromises = validSignedBundles.map(async (bundle, index) => {
    // Add 100ms delay for each bundle to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, index * 100));
    
    try {
      const result = await sendBundle(bundle.transactions);
      console.log(`Bundle ${index + 1} sent successfully`);
      return { success: true, result };
    } catch (error) {
      console.error(`Error sending bundle ${index + 1}:`, error);
      return { success: false, error };
    }
  });

  // Wait for all bundles to complete
  const bundleResults = await Promise.allSettled(bundlePromises);
  
  // Process results
  let results: BundleResult[] = [];
  let successfulBundles = 0;
  let failedBundles = 0;

  bundleResults.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      if (result.value.success) {
        if (result.value.result) results.push(result.value.result);
        successfulBundles++;
      } else {
        failedBundles++;
      }
    } else {
      console.error(`Bundle ${index + 1} promise rejected:`, result.reason);
      failedBundles++;
    }
  });

  return {
    success: successfulBundles > 0,
    result: results,
    error: failedBundles > 0 ? `${failedBundles} bundles failed, ${successfulBundles} succeeded` : undefined
  };
};

/**
 * Execute unified sell operation
 */
export const executeSell = async (
  wallets: WalletSell[],
  sellConfig: SellConfig
): Promise<SellResult> => {
  try {
    const bundleMode = sellConfig.bundleMode || 'batch'; // Default to batch mode
    console.log(`Preparing to sell ${sellConfig.sellPercent}% of ${sellConfig.tokenAddress} using ${wallets.length} wallets on ${sellConfig.protocol} with ${bundleMode} mode`);
    
    // Execute based on bundle mode
    switch (bundleMode) {
      case 'single':
        return await executeSellSingleMode(wallets, sellConfig);
      
      case 'batch':
        return await executeSellBatchMode(wallets, sellConfig);
      
      case 'all-in-one':
        return await executeSellAllInOneMode(wallets, sellConfig);
      
      default:
        throw new Error(`Invalid bundle mode: ${bundleMode}. Must be 'single', 'batch', or 'all-in-one'`);
    }
  } catch (error) {
    console.error('Sell error:', error);
    return {
      success: false,
      error: error.message || 'Unknown error executing sell'
    };
  }
};

/**
 * Validate sell inputs
 */
export const validateSellInputs = (
  wallets: WalletSell[],
  sellConfig: SellConfig,
  tokenBalances: Map<string, number | bigint>
): { valid: boolean; error?: string } => {
  // Check if sell config is valid
  if (!sellConfig.tokenAddress) {
    return { valid: false, error: 'Invalid token address' };
  }
  
  if (!sellConfig.protocol) {
    return { valid: false, error: 'Protocol is required' };
  }
  
  const validProtocols = ['pumpfun', 'moonshot', 'launchpad', 'raydium', 'pumpswap', 'auto', 'boopfun', 'auto'];
  if (!validProtocols.includes(sellConfig.protocol)) {
    return { valid: false, error: `Invalid protocol. Must be one of: ${validProtocols.join(', ')}` };
  }
  
  if (isNaN(sellConfig.sellPercent) || sellConfig.sellPercent <= 0 || sellConfig.sellPercent > 100) {
    return { valid: false, error: 'Invalid sell percentage (must be between 1-100)' };
  }
  
  // Validate Auto-specific parameters
  if ((sellConfig.protocol === 'auto') && sellConfig.slippageBps !== undefined) {
    if (isNaN(sellConfig.slippageBps) || sellConfig.slippageBps < 0) {
      return { valid: false, error: 'Invalid slippage value' };
    }
  }
  
  // Check if wallets are valid
  if (!wallets.length) {
    return { valid: false, error: 'No wallets provided' };
  }
  
  // Check if any wallets have token balance
  let hasTokens = false;
  for (const wallet of wallets) {
    if (!wallet.address || !wallet.privateKey) {
      return { valid: false, error: 'Invalid wallet data' };
    }
    
    const balance = tokenBalances.get(wallet.address) || 0;
    if ((typeof balance === 'bigint' && balance > BigInt(0)) || (typeof balance === 'number' && balance > 0)) {
      hasTokens = true;
      break;
    }
  }
  
  if (!hasTokens) {
    return { valid: false, error: 'None of the wallets have any balance of the specified token' };
  }
  
  return { valid: true };
};

/**
 * Create a sell configuration object
 */
export const createSellConfig = (params: {
  tokenAddress: string;
  protocol?: SellConfig['protocol'];
  sellPercent: number;
  slippageBps?: number;
  outputMint?: string;
  jitoTipLamports?: number;
  bundleMode?: BundleMode;
  batchDelay?: number;
  singleDelay?: number;
}): SellConfig => {
  return {
    tokenAddress: params.tokenAddress,
    protocol: params.protocol || 'auto',
    sellPercent: params.sellPercent,
    slippageBps: params.slippageBps,
    outputMint: params.outputMint,
    jitoTipLamports: params.jitoTipLamports,
    bundleMode: params.bundleMode || 'batch',
    batchDelay: params.batchDelay,
    singleDelay: params.singleDelay
  };
};