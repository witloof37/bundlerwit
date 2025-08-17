import { Connection, VersionedTransaction } from '@solana/web3.js';
import bs58 from 'bs58';
import { loadConfigFromCookies } from './config';

// Type definition for config to avoid circular dependency
interface AppConfig {
  rpcEndpoint?: string;
  transactionFee?: string;
  slippageBps?: string;
}

// Load config from cookies
const loadConfigFromCookies = (): AppConfig => {
  try {
    const configStr = document.cookie
      .split('; ')
      .find(row => row.startsWith('appConfig='))
      ?.split('=')[1];
    
    if (configStr) {
      return JSON.parse(decodeURIComponent(configStr));
    }
  } catch (error) {
    console.error('Error loading config from cookies:', error);
  }
  return {};
};

/**
 * Sends a transaction directly to the Solana RPC as a fallback when server fails
 * @param serializedTransaction - bs58-encoded serialized transaction
 * @returns Transaction signature
 */
export const sendTransactionDirectRPC = async (serializedTransaction: string): Promise<string> => {
  try {
    console.log('🔄 Attempting direct RPC transaction send as fallback...');
    
    // Get RPC endpoint from config
    const config = loadConfigFromCookies();
    const endpoint = config.rpcEndpoint || 'https://api.mainnet-beta.solana.com';
    const connection = new Connection(endpoint);
    
    // Decode the transaction
    const transactionBuffer = bs58.decode(serializedTransaction);
    const transaction = VersionedTransaction.deserialize(transactionBuffer);
    
    // Send the transaction directly to RPC
    const signature = await connection.sendTransaction(transaction, {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
      maxRetries: 3
    });
    
    console.log('✅ Direct RPC transaction sent successfully:', signature);
    return signature;
  } catch (error) {
    console.error('❌ Direct RPC transaction failed:', error);
    throw error;
  }
};

/**
 * Sends a signed transaction to the server's /api/transactions/send endpoint
 * which then forwards it to the Jito bundle service
 * @param serializedTransaction - bs58-encoded serialized transaction
 * @returns Result from the bundle service
 */
export const sendToJitoBundleService = async (serializedTransaction: string) => {
    try {
      // Get the server base URL
      const baseUrl = (window as any).tradingServerUrl?.replace(/\/+$/, '') || "";
      const sendBundleEndpoint = `${baseUrl}/api/transactions/send`;
      
      // Create the request payload - this matches what the server endpoint expects
      const payload = {
        transactions: [serializedTransaction] // Server expects an array of transactions
      };
      
      // Send request to our server endpoint (not directly to Jito)
      const response = await fetch(sendBundleEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      const result = await response.json();
      
      if (!result.success) {
        // Handle error from our server endpoint
        const errorMessage = result.error || 'Unknown error sending bundle';
        const errorDetails = result.details ? `: ${result.details}` : '';
        throw new Error(`${errorMessage}${errorDetails}`);
      }
      
      return result.result;
    } catch (error) {
      console.error('Error sending transaction bundle:', error);
      throw error;
    }
  };

/**
 * Sends fee transactions directly using the main app RPC endpoint
 * This bypasses both the trading server and the problematic direct RPC approach
 * @param serializedTransaction - bs58-encoded serialized transaction
 * @returns Transaction result
 */
export const sendFeeTransactionDirectly = async (serializedTransaction: string) => {
  try {
    console.log('💰 Sending fee transaction directly via main RPC...');
    
    // Get RPC endpoint from app config (same as used throughout the app)
    const config = loadConfigFromCookies();
    const endpoint = config.rpcEndpoint || 'https://smart-special-thunder.solana-mainnet.quiknode.pro/1366b058465380d24920f9d348f85325455d398d/';
    
    console.log('🔗 Using RPC endpoint:', endpoint);
    
    const connection = new Connection(endpoint, {
      commitment: 'confirmed',
      confirmTransactionInitialTimeout: 60000
    });
    
    // Decode the transaction
    const transactionBuffer = bs58.decode(serializedTransaction);
    const transaction = VersionedTransaction.deserialize(transactionBuffer);
    
    console.log('📤 Submitting fee transaction to RPC...');
    
    // Send the transaction with optimized settings for fee transactions
    const signature = await connection.sendTransaction(transaction, {
      skipPreflight: true, // Skip preflight for faster processing
      preflightCommitment: 'confirmed',
      maxRetries: 5 // More retries for fee transactions
    });
    
    console.log('✅ Fee transaction submitted successfully:', signature);
    
    // Wait for confirmation
    console.log('⏳ Waiting for fee transaction confirmation...');
    const confirmation = await connection.confirmTransaction({
      signature,
      blockhash: transaction.message.recentBlockhash,
      lastValidBlockHeight: (await connection.getLatestBlockhash()).lastValidBlockHeight
    }, 'confirmed');
    
    if (confirmation.value.err) {
      throw new Error(`Fee transaction failed: ${confirmation.value.err}`);
    }
    
    console.log('🎉 Fee transaction confirmed successfully!');
    return { signature, confirmed: true };
    
  } catch (error) {
    console.error('❌ Fee transaction failed:', error);
    throw error;
  }
};

/**
 * Legacy fallback function - now redirects to the direct fee transaction method
 * @param serializedTransaction - bs58-encoded serialized transaction
 * @returns Transaction result
 */
export const sendFeeTransactionWithFallback = async (serializedTransaction: string) => {
  // Use the new direct method instead of the problematic server/RPC fallback
  return await sendFeeTransactionDirectly(serializedTransaction);
};