import React, { useEffect, useState } from 'react';
import {
   Download, 
   Settings2,
   ChevronDown, 
   Share2,
   Waypoints,
   Blocks,
   Trash2,
   ChartSpline,
   Send,
   Workflow,
   Sparkles,
   Activity,
   TrendingUp,
   Users,
   BarChart,
   Coins
 } from 'lucide-react';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import { WalletType, loadConfigFromCookies } from "./Utils";
import { useToast } from "./Notifications";
import { countActiveWallets, getScriptName } from './utils/wallets';
import TradingCard from './TradingForm';

import { executeTrade } from './utils/trading';

// Enhanced cyberpunk-styled Switch component (simplified)
const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitive.Root
    className={`
      peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full
      border-2 border-app-primary-40 transition-colors duration-300
      focus-visible:outline-none focus-visible:ring-2
      focus-visible:ring-app-primary-color focus-visible:ring-offset-2
      focus-visible:ring-offset-app-primary disabled:cursor-not-allowed
      disabled:opacity-50 data-[state=checked]:bg-app-primary-color data-[state=unchecked]:bg-app-secondary
      relative overflow-hidden ${className}`}
    {...props}
    ref={ref}
  >
    <SwitchPrimitive.Thumb
      className={`
        pointer-events-none block h-5 w-5 rounded-full
        bg-white shadow-lg ring-0 transition-transform
        data-[state=checked]:translate-x-5 data-[state=checked]:bg-app-primary
        data-[state=unchecked]:translate-x-0 data-[state=unchecked]:bg-app-secondary-color`}
    />
  </SwitchPrimitive.Root>
));
Switch.displayName = 'Switch';

interface ActionsPageProps {
  tokenAddress: string;
  transactionFee: string;
  handleRefresh: () => void;
  wallets: WalletType[];
  solBalances: Map<string, number>;
  tokenBalances: Map<string, number>;
  currentMarketCap: number | null;
  setVolumeModalOpen: (open: boolean) => void;
  setCalculatePNLModalOpen: (open: boolean) => void;
  setDeployModalOpen: (open: boolean) => void;
  setCleanerTokensModalOpen: (open: boolean) => void;
  setCustomBuyModalOpen: (open: boolean) => void;
  onOpenFloating: () => void;
  isFloatingCardOpen: boolean;
  iframeData?: {
    tradingStats: any;
    solPrice: number | null;
    currentWallets: any[];
    recentTrades: {
      type: 'buy' | 'sell';
      address: string;
      tokensAmount: number;
      avgPrice: number;
      solAmount: number;
      timestamp: number;
      signature: string;
    }[];
    tokenPrice: {
      tokenPrice: number;
      tokenMint: string;
      timestamp: number;
      tradeType: 'buy' | 'sell';
      volume: number;
    } | null;
  } | null;
}

// Simplified Tooltip component without animations
export const Tooltip = ({ 
  children, 
  content,
  position = 'top'
}: { 
  children: React.ReactNode;
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}) => {
  const [isVisible, setIsVisible] = useState(false);

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2'
  };

  return (
    <div className="relative inline-block">
      <div
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
      >
        {children}
      </div>
      {isVisible && (
        <div className={`absolute z-50 ${positionClasses[position]}`}>
          <div className="bg-app-quaternary border border-app-primary-40 color-primary text-xs px-2 py-1 rounded 
                         shadow-lg shadow-app-primary-20 whitespace-nowrap font-mono tracking-wide">
            {content}
          </div>
        </div>
      )}
    </div>
  );
};
// Cyberpunk-themed DataBox with minimal clean column layout
const DataBox: React.FC<{
  iframeData?: {
    tradingStats: any;
    solPrice: number | null;
    currentWallets: any[];
    recentTrades: {
      type: 'buy' | 'sell';
      address: string;
      tokensAmount: number;
      avgPrice: number;
      solAmount: number;
      timestamp: number;
      signature: string;
    }[];
    tokenPrice: {
      tokenPrice: number;
      tokenMint: string;
      timestamp: number;
      tradeType: 'buy' | 'sell';
      volume: number;
    } | null;
  } | null;
  tokenAddress: string;
  tokenBalances: Map<string, number>;
}> = ({ iframeData, tokenAddress, tokenBalances }) => {
  if (!tokenAddress || !iframeData) return null;

  const { tradingStats, solPrice, currentWallets, recentTrades, tokenPrice } = iframeData;

  // Calculate holdings value
  const totalTokens = Array.from(tokenBalances.values()).reduce((sum, balance) => sum + balance, 0);
  const currentTokenPrice = tokenPrice?.tokenPrice || 0;
  const holdingsValue = totalTokens * currentTokenPrice;

  return (
    <div className="mb-4">
      <div className="bg-gradient-to-br from-app-secondary-80 to-app-primary-dark-50 backdrop-blur-sm rounded-xl p-6 shadow-xl border border-app-primary-20 relative overflow-hidden">
        
        {/* Cyberpunk accent lines */}
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-app-primary-40 to-transparent"></div>
        <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-app-primary-40 to-transparent"></div>
        
        {/* Main stats grid - clean 4-column layout */}
        <div className="grid grid-cols-4 gap-8 relative z-10">
          
          {/* Bought */}
          <div className="flex flex-col items-center text-center group">
            <div className="text-xs font-mono tracking-wider text-app-secondary-80 uppercase mb-2 font-medium">
              Bought
            </div>
            <div className="flex items-center gap-2">
              <div className="text-lg font-bold color-primary font-mono tracking-tight">
                {tradingStats ? tradingStats.bought.toFixed(2) : '0.00'}
              </div>
              <div className="flex flex-col gap-0.5">
                <div className="w-2 h-0.5 bg-app-primary-color rounded opacity-80 group-hover:opacity-100 transition-opacity"></div>
                <div className="w-2 h-0.5 bg-app-primary-color rounded opacity-60 group-hover:opacity-100 transition-opacity"></div>
                <div className="w-2 h-0.5 bg-app-primary-color rounded opacity-40 group-hover:opacity-100 transition-opacity"></div>
              </div>
            </div>
          </div>

          {/* Sold */}
          <div className="flex flex-col items-center text-center group">
            <div className="text-xs font-mono tracking-wider text-app-secondary-80 uppercase mb-2 font-medium">
              Sold
            </div>
            <div className="flex items-center gap-2">
              <div className="text-lg font-bold text-warning font-mono tracking-tight">
                {tradingStats ? tradingStats.sold.toFixed(2) : '0.00'}
              </div>
              <div className="flex flex-col gap-0.5">
                <div className="w-2 h-0.5 bg-warning rounded opacity-80 group-hover:opacity-100 transition-opacity"></div>
                <div className="w-2 h-0.5 bg-warning rounded opacity-60 group-hover:opacity-100 transition-opacity"></div>
                <div className="w-2 h-0.5 bg-warning rounded opacity-40 group-hover:opacity-100 transition-opacity"></div>
              </div>
            </div>
          </div>

          {/* Holding */}
          <div className="flex flex-col items-center text-center group">
            <div className="text-xs font-mono tracking-wider text-app-secondary-80 uppercase mb-2 font-medium">
              Holding
            </div>
            <div className="flex items-center gap-2">
              <div className="text-lg font-bold text-app-secondary font-mono tracking-tight">
                {holdingsValue.toFixed(2)}
              </div>
              <div className="flex flex-col gap-0.5">
                <div className="w-2 h-0.5 bg-app-secondary-color rounded opacity-80 group-hover:opacity-100 transition-opacity"></div>
                <div className="w-2 h-0.5 bg-app-secondary-color rounded opacity-60 group-hover:opacity-100 transition-opacity"></div>
                <div className="w-2 h-0.5 bg-app-secondary-color rounded opacity-40 group-hover:opacity-100 transition-opacity"></div>
              </div>
            </div>
          </div>

          {/* PnL */}
          <div className="flex flex-col items-center text-center group">
            <div className="text-xs font-mono tracking-wider text-app-secondary-80 uppercase mb-2 font-medium">
              PnL
            </div>
            <div className="flex items-center gap-2">
              <div className={`text-lg font-bold font-mono tracking-tight ${
                tradingStats && (tradingStats.net + holdingsValue) >= 0 ? 'color-primary' : 'text-warning'
              }`}>
                {tradingStats ? (
                  <div>
                    {(tradingStats.net + holdingsValue) >= 0 ? '+' : ''}{(tradingStats.net + holdingsValue).toFixed(2)}
                  </div>
                ) : (
                  <div>+{holdingsValue.toFixed(2)}</div>
                )}
              </div>
              <div className="flex flex-col gap-0.5">
                <div className={`w-2 h-0.5 rounded opacity-80 group-hover:opacity-100 transition-opacity ${
                  tradingStats && (tradingStats.net + holdingsValue) >= 0 ? 'bg-app-primary-color' : 'bg-warning'
                }`}></div>
                <div className={`w-2 h-0.5 rounded opacity-60 group-hover:opacity-100 transition-opacity ${
                  tradingStats && (tradingStats.net + holdingsValue) >= 0 ? 'bg-app-primary-color' : 'bg-warning'
                }`}></div>
                <div className={`w-2 h-0.5 rounded opacity-40 group-hover:opacity-100 transition-opacity ${
                  tradingStats && (tradingStats.net + holdingsValue) >= 0 ? 'bg-app-primary-color' : 'bg-warning'
                }`}></div>
              </div>
            </div>
          </div>

        </div>

        {/* Minimal footer info */}
        {currentWallets && currentWallets.length > 0 && (
          <div className="mt-8 pt-4 border-t border-app-primary-20">
            <div className="flex items-center justify-center gap-8 text-sm">
              <div className="flex items-center gap-2 opacity-60 hover:opacity-100 transition-opacity">
                <div className="w-2 h-2 rounded-full bg-app-primary-color animate-pulse"></div>
                <span className="text-app-secondary font-mono text-xs tracking-wider">
                  {currentWallets.length} ACTIVE
                </span>
              </div>
              {tradingStats && (
                <div className="flex items-center gap-2 opacity-60 hover:opacity-100 transition-opacity">
                  <div className="w-2 h-2 rounded-full bg-app-primary-color"></div>
                  <span className="text-app-secondary font-mono text-xs tracking-wider">
                    {tradingStats.trades} TRADES
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Subtle glow effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-app-primary-05 to-transparent pointer-events-none"></div>
        
      </div>
    </div>
  );
};
export const ActionsPage: React.FC<ActionsPageProps> = ({ 
  tokenAddress, 
  transactionFee, 
  handleRefresh, 
  wallets, 
  solBalances, 
  tokenBalances, 
  currentMarketCap,
  setVolumeModalOpen,
  setCalculatePNLModalOpen,
  setDeployModalOpen,
  setCleanerTokensModalOpen,
  setCustomBuyModalOpen,
  onOpenFloating,
  isFloatingCardOpen,
  iframeData
}) => {
  // State management (no changes)
  const [buyAmount, setBuyAmount] = useState('');
  const [sellAmount, setSellAmount] = useState('');
  const [selectedDex, setSelectedDex] = useState('auto'); // Default to auto
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [tokenPrice, setTokenPrice] = useState<string | null>(null);
  const [priceLoading, setPriceLoading] = useState(false);
  const { showToast } = useToast();


  const dexOptions = [
    { value: 'auto', label: '⭐ Auto', icon: '⭐' },
    { value: 'pumpfun', label: 'PumpFun' },
    { value: 'bonk', label: 'Bonk' },
  ];
  
  const handleTradeSubmit = async (wallets: WalletType[], isBuyMode: boolean, dex?: string, buyAmount?: string, sellAmount?: string) => {
    setIsLoading(true);
    
    if (!tokenAddress) {
      showToast("Please select a token first", "error");
      setIsLoading(false);
      return;
    }
    
    try {
      // Use the provided dex parameter if available, otherwise use selectedDex
      const dexToUse = dex || selectedDex;
      
      // Create trading config
       const config = {
         tokenAddress: tokenAddress,
         ...(isBuyMode 
           ? { solAmount: parseFloat(buyAmount || '0') }
           : { sellPercent: parseFloat(sellAmount || '0') }
         )
       };
      
      console.log(`Executing ${isBuyMode ? 'Buy' : 'Sell'} on ${dexToUse} for ${tokenAddress}`);
      
      // Execute trade using centralized logic
      const result = await executeTrade(dexToUse, wallets, config, isBuyMode, solBalances);
      
      if (result.success) {
        showToast(`${dexToUse} ${isBuyMode ? 'Buy' : 'Sell'} transactions submitted successfully`, "success");
      } else {
        showToast(`${dexToUse} ${isBuyMode ? 'Buy' : 'Sell'} failed: ${result.error}`, "error");
      }
    } catch (error) {
      console.error(`Trading error:`, error);
      showToast(`Error: ${error.message}`, "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-app-primary p-4 md:p-6 relative">
      {/* Background effects - keeping original */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        {/* Grid background */}
        <div className="absolute inset-0 bg-app-primary opacity-90">
          <div className="absolute inset-0 bg-gradient-to-b from-app-primary-05 to-transparent"></div>
          <div 
            className="absolute inset-0"
            style={{
              backgroundImage: `
                linear-gradient(rgba(2, 179, 109, 0.05) 1px, transparent 1px),
                linear-gradient(90deg, rgba(2, 179, 109, 0.05) 1px, transparent 1px)
              `,
              backgroundSize: '20px 20px',
              backgroundPosition: 'center center',
            }}
          ></div>
        </div>
        
        {/* Glowing corner accents */}
        <div className="absolute top-0 left-0 w-32 h-32 opacity-20">
          <div className="absolute top-0 left-0 w-px h-16 bg-gradient-to-b from-app-primary-color to-transparent"></div>
          <div className="absolute top-0 left-0 w-16 h-px bg-gradient-to-r from-app-primary-color to-transparent"></div>
        </div>
        <div className="absolute top-0 right-0 w-32 h-32 opacity-20">
          <div className="absolute top-0 right-0 w-px h-16 bg-gradient-to-b from-app-primary-color to-transparent"></div>
          <div className="absolute top-0 right-0 w-16 h-px bg-gradient-to-l from-app-primary-color to-transparent"></div>
        </div>
        <div className="absolute bottom-0 left-0 w-32 h-32 opacity-20">
          <div className="absolute bottom-0 left-0 w-px h-16 bg-gradient-to-t from-app-primary-color to-transparent"></div>
          <div className="absolute bottom-0 left-0 w-16 h-px bg-gradient-to-r from-app-primary-color to-transparent"></div>
        </div>
        <div className="absolute bottom-0 right-0 w-32 h-32 opacity-20">
          <div className="absolute bottom-0 right-0 w-px h-16 bg-gradient-to-t from-app-primary-color to-transparent"></div>
          <div className="absolute bottom-0 right-0 w-16 h-px bg-gradient-to-l from-app-primary-color to-transparent"></div>
        </div>
      </div>
      
      <div className="max-w-4xl mx-auto space-y-8 relative z-10">
        {/* Trading Card (unchanged) */}
        <TradingCard
          tokenAddress={tokenAddress}
          wallets={wallets}
          selectedDex={selectedDex}
          setSelectedDex={setSelectedDex}
          isDropdownOpen={isDropdownOpen}
          setIsDropdownOpen={setIsDropdownOpen}
          buyAmount={buyAmount}
          setBuyAmount={setBuyAmount}
          sellAmount={sellAmount}
          setSellAmount={setSellAmount}
          handleTradeSubmit={handleTradeSubmit}
          isLoading={isLoading}
          dexOptions={dexOptions}
          getScriptName={getScriptName}
          countActiveWallets={countActiveWallets}
          currentMarketCap={currentMarketCap}
          tokenBalances={tokenBalances}
          onOpenFloating={onOpenFloating}
          isFloatingCardOpen={isFloatingCardOpen}
          solPrice={iframeData?.solPrice}
        />
        
        {/* Token Operations */}
        <div className="space-y-4">          
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 relative z-10">
              {/* Cleaner Button */}
              <button
                onClick={() => {
                  if (!tokenAddress) {
                    showToast("Please select a token first", "error");
                    return;
                  }
                  setCleanerTokensModalOpen(true);
                }}
                className="flex flex-col items-center gap-2 p-3 rounded-lg
                          bg-gradient-to-br from-app-secondary-80 to-app-primary-dark-50 border border-app-primary-30 hover-border-primary-60
                          transition-all duration-300"
              >
                <div className="p-3 bg-gradient-to-br from-app-primary-20 to-app-primary-05 rounded-lg">
                  <Waypoints size={20} className="color-primary" />
                </div>
                <span className="text-xs font-mono tracking-wider text-app-secondary uppercase">Cleaner</span>
              </button>
              
              {/* Deploy Button */}
              <button
                onClick={() => setDeployModalOpen(true)}
                className="flex flex-col items-center gap-2 p-3 rounded-lg
                          bg-gradient-to-br from-app-secondary-80 to-app-primary-dark-50 border border-app-primary-30 hover-border-primary-60
                          transition-all duration-300"
              >
                <div className="p-3 bg-gradient-to-br from-app-primary-20 to-app-primary-05 rounded-lg">
                  <Blocks size={20} className="color-primary" />
                </div>
                <span className="text-xs font-mono tracking-wider text-app-secondary uppercase">Deploy</span>
              </button>
              
              {/* Volume Button */}
              <button
                onClick={() => {
                  if (!tokenAddress) {
                    showToast("Please select a token first", "error");
                    return;
                  }
                  setVolumeModalOpen(true);
                }}
                className="flex flex-col items-center gap-2 p-3 rounded-lg
                          bg-gradient-to-br from-app-secondary-80 to-app-primary-dark-50 border border-app-primary-30 hover-border-primary-60
                          transition-all duration-300"
              >
                <div className="p-3 bg-gradient-to-br from-app-primary-20 to-app-primary-05 rounded-lg">
                  <Activity size={20} className="color-primary" />
                </div>
                <span className="text-xs font-mono tracking-wider text-app-secondary uppercase">Volume</span>
              </button>
              
              {/* Stagger Button */}
              <button
                onClick={() => {
                  if (!tokenAddress) {
                    showToast("Please select a token first", "error");
                    return;
                  }
                  setCustomBuyModalOpen(true);
                }}
                className="flex flex-col items-center gap-2 p-3 rounded-lg
                          bg-gradient-to-br from-app-secondary-80 to-app-primary-dark-50 border border-app-primary-30 hover-border-primary-60
                          transition-all duration-300"
              >
                <div className="p-3 bg-gradient-to-br from-app-primary-20 to-app-primary-05 rounded-lg">
                  <Workflow size={20} className="color-primary" />
                </div>
                <span className="text-xs font-mono tracking-wider text-app-secondary uppercase">Stagger</span>
              </button>
          </div>
          
          {/* Live Data Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-gradient-to-br from-app-primary-20 to-app-primary-05 rounded-lg">
                  <Activity size={16} className="color-primary" />
                </div>
                <span className="font-mono text-sm tracking-wider text-app-secondary uppercase">Live Data</span>
              </div>
              
              {/* Share PNL Button moved next to Live Data */}
              <button
                onClick={() => {
                  if (!tokenAddress) {
                    showToast("Please select a token first", "error");
                    return;
                  }
                  setCalculatePNLModalOpen(true);
                }}
                className="flex items-center gap-2 px-3 py-2 rounded-lg
                          bg-gradient-to-r from-app-primary-color to-app-primary-dark hover-from-app-primary-dark hover-to-app-primary-color
                          shadow-md shadow-app-primary-40 hover-shadow-app-primary-60
                          transition-all duration-300 relative overflow-hidden"
              >
                <ChartSpline size={16} className="text-black relative z-10" />
                <span className="text-sm font-mono tracking-wider text-black font-medium relative z-10">Share PNL</span>
              </button>
            </div>
            <DataBox iframeData={iframeData} tokenAddress={tokenAddress} tokenBalances={tokenBalances} />
          </div>
        </div>
      </div>


      
    </div>
  );
};