import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle, ChevronLeft, ChevronRight, Info, Search, X, ArrowDown, Play, Square, TrendingUp } from 'lucide-react';
import { getWallets, getWalletDisplayName } from '../Utils';
import { useToast } from "../Notifications";
import { loadConfigFromCookies } from '../Utils';
import * as web3 from '@solana/web3.js';
import bs58 from 'bs58';
import { sendToJitoBundleService } from '../utils/jitoService';
import { stopVolumeBot as stopVolumeBotService } from '../utils/volumeBot';

const STEPS_VOLUME = ['Select Wallets', 'Volume Settings', 'Review & Control'];

interface BaseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface VolumeModalProps extends BaseModalProps {
  onVolume: (settings: any) => void;
  handleRefresh: () => void;
  tokenAddress: string; 
  solBalances: Map<string, number>;
  tokenBalances: Map<string, number>;
}

export const VolumeModal: React.FC<VolumeModalProps> = ({
  isOpen,
  onClose,
  onVolume,
  handleRefresh,
  tokenAddress,
  solBalances,
  tokenBalances
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedWallets, setSelectedWallets] = useState<string[]>([]);
  const [volumeSettings, setVolumeSettings] = useState({
    duration: 60, // minutes
    minBuyAmount: 0.01, // SOL
    maxBuyAmount: 0.1, // SOL
    minSellPercentage: 80, // % of tokens to sell
    maxSellPercentage: 100, // % of tokens to sell
    buyPressure: 60, // % bias towards buying
    intervalMin: 1, // minimum seconds between trades
    intervalMax: 5, // maximum seconds between trades
  });
  const [isRunning, setIsRunning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOption, setSortOption] = useState('balance');
  const [sortDirection, setSortDirection] = useState('desc');
  const [balanceFilter, setBalanceFilter] = useState('withSol');
  const [modalClass, setModalClass] = useState('');
  const [buttonHover, setButtonHover] = useState(false);
  const [volumeStats, setVolumeStats] = useState({
    totalTrades: 0,
    totalVolume: 0,
    timeRemaining: 0,
    currentPrice: 0
  });
  
  const wallets = getWallets();
  const { showToast } = useToast();

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      handleRefresh();
      resetForm();
      setModalClass('animate-modal-in');
      
      const timer = setTimeout(() => {
        setModalClass('');
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Reset form state
  const resetForm = () => {
    setCurrentStep(0);
    setSelectedWallets([]);
    setIsConfirmed(false);
    setSearchTerm('');
    setSortOption('balance');
    setSortDirection('desc');
    setBalanceFilter('withSol');
    setIsRunning(false);
  };

  const handleNext = () => {
    if (currentStep === 0 && selectedWallets.length === 0) {
      showToast("Please select at least one wallet", "error");
      return;
    }
    
    if (currentStep === 1) {
      if (volumeSettings.duration <= 0) {
        showToast("Please enter a valid duration", "error");
        return;
      }
      if (volumeSettings.minBuyAmount <= 0) {
        showToast("Please enter a valid minimum buy amount", "error");
        return;
      }
      if (volumeSettings.maxBuyAmount <= 0) {
        showToast("Please enter a valid maximum buy amount", "error");
        return;
      }
      if (volumeSettings.minBuyAmount >= volumeSettings.maxBuyAmount) {
        showToast("Minimum buy amount must be less than maximum buy amount", "error");
        return;
      }
    }
    
    setModalClass('animate-step-out');
    setTimeout(() => {
      setCurrentStep(prev => Math.min(prev + 1, STEPS_VOLUME.length - 1));
      setModalClass('animate-step-in');
    }, 150);
  };

  const handleBack = () => {
    setModalClass('animate-step-back-out');
    setTimeout(() => {
      setCurrentStep(prev => Math.max(prev - 1, 0));
      setModalClass('animate-step-back-in');
    }, 150);
  };

  const handleWalletToggle = (walletKey: string) => {
    setSelectedWallets(prev => {
      if (prev.includes(walletKey)) {
        return prev.filter(w => w !== walletKey);
      } else {
        return [...prev, walletKey];
      }
    });
  };

  const handleSelectAll = () => {
    const walletsWithSol = wallets.filter(wallet => {
      const balance = solBalances.get(wallet.address) || 0;
      return balance > 0.01; // Only wallets with at least 0.01 SOL
    });
    
    const walletAddresses = walletsWithSol.map(w => w.address);
    
    if (selectedWallets.length === walletAddresses.length) {
      setSelectedWallets([]);
    } else {
      setSelectedWallets(walletAddresses);
    }
  };

  const startVolumeBot = async () => {
    setIsSubmitting(true);
    try {
      console.log('🔍 Selected wallet addresses:', selectedWallets);
      console.log('🔍 Available wallets:', wallets.length);
      
      // Convert selected wallet addresses to private keys
      const selectedWalletPrivateKeys = selectedWallets.map(address => {
        const wallet = wallets.find(w => w.address === address);
        console.log('🔍 Finding wallet for address:', address, 'found:', !!wallet);
        if (wallet) {
          console.log('🔍 Wallet private key sample:', wallet.privateKey.substring(0, 20) + '...');
        }
        return wallet ? wallet.privateKey : null;
      }).filter(pk => pk !== null);
      
      console.log('🔍 Selected wallet private keys:', selectedWalletPrivateKeys.length);
      
      if (selectedWalletPrivateKeys.length === 0) {
        throw new Error('No valid wallets selected');
      }
      
      // Format data according to VolumeConfig interface
      const volumeConfig = {
        tokenAddress,
        wallets: selectedWalletPrivateKeys,
        minAmount: volumeSettings.minBuyAmount,
        maxAmount: volumeSettings.maxBuyAmount,
        intervalMin: volumeSettings.intervalMin,
        intervalMax: volumeSettings.intervalMax,
        interval: Math.floor((volumeSettings.intervalMin + volumeSettings.intervalMax) / 2), // Average interval
        duration: volumeSettings.duration,
        slippage: 5, // Default 5% slippage
        sellPercent: Math.floor((volumeSettings.minSellPercentage + volumeSettings.maxSellPercentage) / 2), // Average sell percentage
        protocol: 'auto' as const // Use auto protocol selection
      };
      
      console.log('🔍 Volume config:', volumeConfig);
      
      setIsRunning(true);
      setVolumeStats(prev => ({ ...prev, timeRemaining: volumeSettings.duration * 60 }));
      showToast("Starting volume bot...", "info");
      onVolume(volumeConfig);
    } catch (error) {
      console.error('Error starting volume bot:', error);
      showToast("Failed to start volume bot", "error");
      setIsRunning(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const stopVolumeBot = async () => {
    try {
      setIsSubmitting(true);
      await stopVolumeBotService();
      setIsRunning(false);
      setVolumeStats(prev => ({ ...prev, timeRemaining: 0 }));
      showToast("Volume bot stopped", "info");
    } catch (error) {
      console.error('Error stopping volume bot:', error);
      showToast("Failed to stop volume bot", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getFilteredWallets = () => {
    let filtered = wallets.filter(wallet => {
      const balance = solBalances.get(wallet.address) || 0;
      const displayName = getWalletDisplayName(wallet);
      
      // Balance filter
      if (balanceFilter === 'withSol' && balance <= 0.01) return false;
      if (balanceFilter === 'noSol' && balance > 0.01) return false;
      
      // Search filter
      if (searchTerm && !displayName.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }
      
      return true;
    });

    // Sort
    filtered.sort((a, b) => {
      let aValue, bValue;
      
      switch (sortOption) {
        case 'balance':
          aValue = solBalances.get(a.address) || 0;
          bValue = solBalances.get(b.address) || 0;
          break;
        case 'address':
          aValue = getWalletDisplayName(a);
          bValue = getWalletDisplayName(b);
          break;
        default:
          return 0;
      }
      
      if (sortDirection === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    return filtered;
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <style>
        {`
          @keyframes modal-in {
            0% { transform: translateY(20px); opacity: 0; }
            100% { transform: translateY(0); opacity: 1; }
          }
          @keyframes step-out {
            0% { transform: translateX(0); opacity: 1; }
            100% { transform: translateX(-20px); opacity: 0; }
          }
          @keyframes step-in {
            0% { transform: translateX(20px); opacity: 0; }
            100% { transform: translateX(0); opacity: 1; }
          }
          @keyframes step-back-out {
            0% { transform: translateX(0); opacity: 1; }
            100% { transform: translateX(20px); opacity: 0; }
          }
          @keyframes step-back-in {
            0% { transform: translateX(-20px); opacity: 0; }
            100% { transform: translateX(0); opacity: 1; }
          }
          .animate-modal-in { animation: modal-in 0.5s ease-out; }
          .animate-step-out { animation: step-out 0.15s ease-in; }
          .animate-step-in { animation: step-in 0.15s ease-out; }
          .animate-step-back-out { animation: step-back-out 0.15s ease-in; }
          .animate-step-back-in { animation: step-back-in 0.15s ease-out; }
        `}
      </style>
      
      <div className={`bg-app-secondary rounded-xl border border-app-primary-30 w-full max-w-4xl max-h-[90vh] overflow-hidden relative ${modalClass}`}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-app-primary-30 bg-app-tertiary">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-app-primary-color rounded-lg">
              <TrendingUp size={20} className="text-app-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-app-primary font-mono">VOLUME BOT</h2>
              <p className="text-sm text-app-secondary font-mono">Create trading volume while maintaining supply</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-app-primary-10 rounded-lg transition-colors"
          >
            <X size={20} className="text-app-secondary" />
          </button>
        </div>

        {/* Progress Steps */}
        <div className="px-6 py-4 bg-app-tertiary border-b border-app-primary-30">
          <div className="flex items-center justify-between relative">
            {STEPS_VOLUME.map((step, index) => (
              <div key={index} className="flex flex-col items-center relative z-10">
                <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center font-mono text-sm transition-all duration-300 ${
                  index <= currentStep 
                    ? 'border-app-primary-color bg-app-primary-color text-app-primary' 
                    : 'border-app-primary-30 bg-app-secondary text-app-muted'
                }`}>
                  {index < currentStep ? (
                    <CheckCircle size={16} />
                  ) : (
                    index + 1
                  )}
                </div>
                <span className={`mt-2 text-xs transition-all duration-300 font-mono tracking-wide ${
                  index <= currentStep ? 'text-app-primary' : 'text-app-muted'
                }`}>
                  {step}
                </span>
              </div>
            ))}
            
            {/* Progress line */}
            <div className="absolute top-5 left-5 right-5 h-0.5 bg-app-primary-20 -z-0">
              <div 
                className="h-full bg-app-primary-color transition-all duration-500"
                style={{ width: `${(currentStep / (STEPS_VOLUME.length - 1)) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {/* Step 1: Select Wallets */}
          {currentStep === 0 && (
            <div className={`space-y-6 ${modalClass || 'animate-content-fade'}`}>
              <div className="flex items-center space-x-2 mb-4">
                <div className="color-primary border border-app-primary-30 p-1 rounded">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-app-primary font-mono">
                  <span className="color-primary">/</span> SELECT WALLETS <span className="color-primary">/</span>
                </h3>
              </div>

              {/* Search and Filters */}
              <div className="mb-4 flex space-x-2">
                <div className="relative flex-grow">
                  <Search size={14} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-app-secondary" />
                  <input
                    type="text"
                    placeholder="Search wallets..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-app-primary border border-app-primary-30 rounded-lg text-app-primary focus:outline-none focus-border-primary transition-all font-mono"
                  />
                </div>
                
                <select
                  value={balanceFilter}
                  onChange={(e) => setBalanceFilter(e.target.value)}
                  className="px-3 py-2 bg-app-primary border border-app-primary-30 rounded-lg text-app-primary focus:outline-none font-mono"
                >
                  <option value="all">All Wallets</option>
                  <option value="withSol">With SOL</option>
                  <option value="noSol">No SOL</option>
                </select>
                
                <select
                  value={`${sortOption}-${sortDirection}`}
                  onChange={(e) => {
                    const [option, direction] = e.target.value.split('-');
                    setSortOption(option);
                    setSortDirection(direction);
                  }}
                  className="px-3 py-2 bg-app-primary border border-app-primary-30 rounded-lg text-app-primary focus:outline-none font-mono"
                >
                  <option value="balance-desc">Balance ↓</option>
                  <option value="balance-asc">Balance ↑</option>
                  <option value="address-asc">Address A-Z</option>
                  <option value="address-desc">Address Z-A</option>
                </select>
              </div>

              {/* Select All Button */}
              <div className="flex justify-between items-center mb-4">
                <button
                  onClick={handleSelectAll}
                  className="px-4 py-2 bg-app-primary-color text-app-primary rounded-lg hover:bg-app-primary-dark transition-all font-mono"
                >
                  {selectedWallets.length === getFilteredWallets().filter(w => (solBalances.get(w.address) || 0) > 0.01).length ? 'Deselect All' : 'Select All'}
                </button>
                <span className="text-sm text-app-secondary font-mono">
                  {selectedWallets.length} wallet(s) selected
                </span>
              </div>

              {/* Wallet List */}
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {getFilteredWallets().map((wallet) => {
                  const balance = solBalances.get(wallet.address) || 0;
                  const isSelected = selectedWallets.includes(wallet.address);
                  const hasEnoughSol = balance > 0.01;
                  
                  return (
                    <div
                      key={wallet.address}
                      onClick={() => hasEnoughSol && handleWalletToggle(wallet.address)}
                      className={`p-3 rounded-lg border transition-all cursor-pointer ${
                        isSelected
                          ? 'border-app-primary-color bg-app-primary-10'
                          : hasEnoughSol
                          ? 'border-app-primary-30 bg-app-tertiary hover:border-app-primary-50'
                          : 'border-app-primary-20 bg-app-secondary opacity-50 cursor-not-allowed'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className={`w-5 h-5 border rounded transition-all ${
                            isSelected ? 'bg-app-primary-color border-app-primary-color' : 'border-app-primary-40'
                          }`}>
                            {isSelected && <CheckCircle size={14} className="text-app-primary" />}
                          </div>
                          <div>
                            <div className="text-sm font-mono text-app-primary">
                              {getWalletDisplayName(wallet)}
                            </div>
                            <div className="text-xs text-app-secondary font-mono">
                              {wallet.address.slice(0, 8)}...{wallet.address.slice(-8)}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`text-sm font-mono ${
                            hasEnoughSol ? 'text-app-primary' : 'text-app-secondary'
                          }`}>
                            {balance.toFixed(4)} SOL
                          </div>
                          {!hasEnoughSol && (
                            <div className="text-xs text-red-400 font-mono">
                              Insufficient SOL
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 2: Volume Settings */}
          {currentStep === 1 && (
            <div className={`space-y-6 ${modalClass || 'animate-content-fade'}`}>
              <div className="flex items-center space-x-2 mb-4">
                <div className="color-primary border border-app-primary-30 p-1 rounded">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1 1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-app-primary font-mono">
                  <span className="color-primary">/</span> VOLUME SETTINGS <span className="color-primary">/</span>
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Duration */}
                <div className="space-y-2">
                  <label className="text-sm font-mono text-app-primary">Duration (minutes)</label>
                  <input
                    type="number"
                    value={volumeSettings.duration}
                    onChange={(e) => setVolumeSettings(prev => ({ ...prev, duration: parseInt(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 bg-app-primary border border-app-primary-30 rounded-lg text-app-primary focus:outline-none focus-border-primary font-mono"
                    min="1"
                    max="1440"
                  />
                </div>

                {/* Buy Amount Range */}
                <div className="space-y-2">
                  <label className="text-sm font-mono text-app-primary">Buy Amount Range (SOL)</label>
                  <div className="flex space-x-2">
                    <input
                      type="number"
                      value={volumeSettings.minBuyAmount}
                      onChange={(e) => setVolumeSettings(prev => ({ ...prev, minBuyAmount: parseFloat(e.target.value) || 0 }))}
                      className="w-full px-3 py-2 bg-app-primary border border-app-primary-30 rounded-lg text-app-primary focus:outline-none focus-border-primary font-mono"
                      placeholder="Min"
                      step="0.001"
                      min="0.001"
                    />
                    <input
                      type="number"
                      value={volumeSettings.maxBuyAmount}
                      onChange={(e) => setVolumeSettings(prev => ({ ...prev, maxBuyAmount: parseFloat(e.target.value) || 0 }))}
                      className="w-full px-3 py-2 bg-app-primary border border-app-primary-30 rounded-lg text-app-primary focus:outline-none focus-border-primary font-mono"
                      placeholder="Max"
                      step="0.001"
                      min="0.001"
                    />
                  </div>
                </div>

                {/* Sell Percentage Range */}
                <div className="space-y-2">
                  <label className="text-sm font-mono text-app-primary">Sell Percentage Range (%)</label>
                  <div className="flex space-x-2">
                    <input
                      type="number"
                      value={volumeSettings.minSellPercentage}
                      onChange={(e) => setVolumeSettings(prev => ({ ...prev, minSellPercentage: parseInt(e.target.value) || 0 }))}
                      className="w-full px-3 py-2 bg-app-primary border border-app-primary-30 rounded-lg text-app-primary focus:outline-none focus-border-primary font-mono"
                      placeholder="Min %"
                      min="1"
                      max="100"
                    />
                    <input
                      type="number"
                      value={volumeSettings.maxSellPercentage}
                      onChange={(e) => setVolumeSettings(prev => ({ ...prev, maxSellPercentage: parseInt(e.target.value) || 0 }))}
                      className="w-full px-3 py-2 bg-app-primary border border-app-primary-30 rounded-lg text-app-primary focus:outline-none focus-border-primary font-mono"
                      placeholder="Max %"
                      min="1"
                      max="100"
                    />
                  </div>
                </div>

                {/* Buy Pressure */}
                <div className="space-y-2">
                  <label className="text-sm font-mono text-app-primary">Buy Pressure ({volumeSettings.buyPressure}%)</label>
                  <input
                    type="range"
                    value={volumeSettings.buyPressure}
                    onChange={(e) => setVolumeSettings(prev => ({ ...prev, buyPressure: parseInt(e.target.value) }))}
                    className="w-full"
                    min="50"
                    max="90"
                  />
                  <div className="text-xs text-app-secondary font-mono">
                    Higher values favor buying over selling
                  </div>
                </div>

                {/* Interval Range */}
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-mono text-app-primary">Trade Interval Range (seconds)</label>
                  <div className="flex space-x-2">
                    <input
                      type="number"
                      value={volumeSettings.intervalMin}
                      onChange={(e) => setVolumeSettings(prev => ({ ...prev, intervalMin: parseInt(e.target.value) || 1 }))}
                      className="w-full px-3 py-2 bg-app-primary border border-app-primary-30 rounded-lg text-app-primary focus:outline-none focus-border-primary font-mono"
                      placeholder="Min seconds"
                      min="1"
                      max="60"
                    />
                    <input
                      type="number"
                      value={volumeSettings.intervalMax}
                      onChange={(e) => setVolumeSettings(prev => ({ ...prev, intervalMax: parseInt(e.target.value) || 1 }))}
                      className="w-full px-3 py-2 bg-app-primary border border-app-primary-30 rounded-lg text-app-primary focus:outline-none focus-border-primary font-mono"
                      placeholder="Max seconds"
                      min="1"
                      max="60"
                    />
                  </div>
                </div>
              </div>

              {/* Settings Summary */}
              <div className="bg-app-tertiary rounded-lg border border-app-primary-30 p-4">
                <h4 className="text-sm font-mono text-app-primary mb-2">CONFIGURATION SUMMARY</h4>
                <div className="grid grid-cols-2 gap-2 text-xs font-mono text-app-secondary">
                  <div>Duration: {volumeSettings.duration} minutes</div>
                  <div>Buy Pressure: {volumeSettings.buyPressure}%</div>
                  <div>Buy Range: {volumeSettings.minBuyAmount}-{volumeSettings.maxBuyAmount} SOL</div>
                  <div>Sell Range: {volumeSettings.minSellPercentage}-{volumeSettings.maxSellPercentage}%</div>
                  <div>Interval: {volumeSettings.intervalMin}-{volumeSettings.intervalMax}s</div>
                  <div>Wallets: {selectedWallets.length}</div>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Review & Control */}
          {currentStep === 2 && (
            <div className={`space-y-6 ${modalClass || 'animate-content-fade'}`}>
              <div className="flex items-center space-x-2 mb-4">
                <div className="color-primary border border-app-primary-30 p-1 rounded">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-app-primary font-mono">
                  <span className="color-primary">/</span> REVIEW & CONTROL <span className="color-primary">/</span>
                </h3>
              </div>

              {/* Volume Bot Status */}
              <div className="bg-app-tertiary rounded-lg border border-app-primary-30 p-4">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-lg font-mono text-app-primary">Volume Bot Status</h4>
                  <div className={`px-3 py-1 rounded-full text-xs font-mono ${
                    isRunning ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'
                  }`}>
                    {isRunning ? 'RUNNING' : 'STOPPED'}
                  </div>
                </div>

                {/* Stats */}
                {isRunning && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div className="text-center">
                      <div className="text-2xl font-mono text-app-primary">{volumeStats.totalTrades}</div>
                      <div className="text-xs text-app-secondary font-mono">Total Trades</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-mono text-app-primary">{volumeStats.totalVolume.toFixed(2)}</div>
                      <div className="text-xs text-app-secondary font-mono">Volume (SOL)</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-mono text-app-primary">{Math.floor(volumeStats.timeRemaining / 60)}</div>
                      <div className="text-xs text-app-secondary font-mono">Minutes Left</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-mono text-app-primary">{selectedWallets.length}</div>
                      <div className="text-xs text-app-secondary font-mono">Active Wallets</div>
                    </div>
                  </div>
                )}

                {/* Control Buttons */}
                <div className="flex space-x-4">
                  {!isRunning ? (
                    <button
                      onClick={startVolumeBot}
                      disabled={isSubmitting || !isConfirmed}
                      className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-mono transition-all ${
                        isSubmitting || !isConfirmed
                          ? 'bg-gray-500/20 text-gray-400 cursor-not-allowed'
                          : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                      }`}
                    >
                      <Play size={16} />
                      <span>{isSubmitting ? 'Starting...' : 'Start Volume Bot'}</span>
                    </button>
                  ) : (
                    <button
                      onClick={stopVolumeBot}
                      disabled={isSubmitting}
                      className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-mono transition-all ${
                        isSubmitting
                          ? 'bg-gray-500/20 text-gray-400 cursor-not-allowed'
                          : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                      }`}
                    >
                      <Square size={16} />
                      <span>{isSubmitting ? 'Stopping...' : 'Stop Volume Bot'}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Configuration Review */}
              <div className="bg-app-tertiary rounded-lg border border-app-primary-30 p-4">
                <h4 className="text-sm font-mono text-app-primary mb-3">CONFIGURATION REVIEW</h4>
                <div className="space-y-2 text-sm font-mono text-app-secondary">
                  <div className="flex justify-between">
                    <span>Selected Wallets:</span>
                    <span className="text-app-primary">{selectedWallets.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Duration:</span>
                    <span className="text-app-primary">{volumeSettings.duration} minutes</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Buy Amount Range:</span>
                    <span className="text-app-primary">{volumeSettings.minBuyAmount}-{volumeSettings.maxBuyAmount} SOL</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Buy Pressure:</span>
                    <span className="text-app-primary">{volumeSettings.buyPressure}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Trade Interval:</span>
                    <span className="text-app-primary">{volumeSettings.intervalMin}-{volumeSettings.intervalMax}s</span>
                  </div>
                </div>
              </div>

              {/* Confirmation */}
              {!isRunning && (
                <div className="bg-app-tertiary rounded-lg border border-app-primary-30 p-4">
                  <div 
                    className="flex items-start gap-3 cursor-pointer"
                    onClick={() => setIsConfirmed(!isConfirmed)}
                  >
                    <div className="relative mt-1">
                      <div 
                        className={`w-5 h-5 border border-app-primary-40 rounded transition-all ${
                          isConfirmed ? 'bg-app-primary-color border-0' : ''
                        }`}
                      ></div>
                      <CheckCircle 
                        size={14} 
                        className={`absolute top-0.5 left-0.5 text-app-primary transition-all ${
                          isConfirmed ? 'opacity-100' : 'opacity-0'
                        }`}
                      />
                    </div>
                    <span className="text-sm text-app-primary leading-relaxed font-mono select-none">
                      I understand that this volume bot will use the selected wallets to create trading activity. 
                      The bot will maintain a buying bias to preserve token supply while generating volume.
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex justify-between p-6 border-t border-app-primary-30 bg-app-tertiary">
          <button
            type="button"
            onClick={currentStep === 0 ? onClose : handleBack}
            className="px-6 py-3 bg-app-secondary text-app-secondary hover:bg-app-primary-10 border border-app-primary-30 rounded-lg transition-all font-mono"
          >
            <div className="flex items-center space-x-2">
              <ChevronLeft size={16} />
              <span>{currentStep === 0 ? 'Cancel' : 'Back'}</span>
            </div>
          </button>

          {currentStep < STEPS_VOLUME.length - 1 && (
            <button
              type="button"
              onClick={handleNext}
              disabled={(                (currentStep === 0 && selectedWallets.length === 0) ||                (currentStep === 1 && (volumeSettings.duration <= 0 || volumeSettings.minBuyAmount <= 0 || volumeSettings.maxBuyAmount <= 0 || volumeSettings.minBuyAmount >= volumeSettings.maxBuyAmount))              )}
              className={`px-6 py-3 rounded-lg transition-all font-mono flex items-center space-x-2 ${                ((currentStep === 0 && selectedWallets.length === 0) ||                (currentStep === 1 && (volumeSettings.duration <= 0 || volumeSettings.minBuyAmount <= 0 || volumeSettings.maxBuyAmount <= 0 || volumeSettings.minBuyAmount >= volumeSettings.maxBuyAmount)))                  ? 'bg-app-primary-50 text-app-primary-80 cursor-not-allowed opacity-50'                   : 'bg-app-primary-color text-app-primary hover:bg-app-primary-dark transform hover:-translate-y-0.5'              }`}
            >
              <span>Next</span>
              <ChevronRight size={16} />
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};