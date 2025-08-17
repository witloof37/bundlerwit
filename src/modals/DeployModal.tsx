import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Rocket, Zap, X, Utensils } from 'lucide-react';
import { DeployPumpModal } from './DeployPumpModal';
import { DeployBonkModal } from './DeployBonkModal';
import { useToast } from "../Notifications";

interface BaseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface DeployModalProps extends BaseModalProps {
  onDeploy: (data: any) => void;
  handleRefresh: () => void;
  solBalances: Map<string, number>;
}

export const DeployModal: React.FC<DeployModalProps> = ({
  isOpen,
  onClose,
  onDeploy,
  handleRefresh,
  solBalances,
}) => {
  const [selectedDeployType, setSelectedDeployType] = useState<'pump' | 'bonk' | null>(null);

  const { showToast } = useToast();

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-app-primary-99">
      <div className="relative bg-app-primary border-2 border-app-primary-40 rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden transform modal-glow">
        {/* Header */}
        <div className="relative z-10 p-5 flex justify-between items-center border-b border-app-primary-40">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center bg-primary-20">
              <Rocket size={20} className="color-primary" />
            </div>
            <h2 className="text-xl font-bold text-app-primary font-mono">
              <span className="color-primary">/</span> SELECT DEPLOY TYPE <span className="color-primary">/</span>
            </h2>
          </div>
          <button 
            onClick={onClose}
            className="text-app-secondary hover:color-primary-light transition-colors p-1.5 hover:bg-primary-20 rounded-lg"
          >
            <X size={20} />
          </button>
        </div>

        {/* Deployment Options */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Pump Deploy Option */}
          <div 
            onClick={() => setSelectedDeployType('pump')}
            className="group relative cursor-pointer bg-app-tertiary border-2 border-app-primary-30 rounded-xl p-4 transition-all duration-300 hover-border-primary hover:shadow-lg hover:shadow-app-primary-20"
          >
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-lg bg-primary-20 flex items-center justify-center">
                <Zap size={24} className="color-primary group-hover:animate-pulse" />
              </div>
              <h3 className="text-lg font-bold text-app-primary font-mono">PUMP.FUN</h3>
              <p className="text-app-secondary text-xs leading-relaxed">
                Create a new pump.fun token with customizable parameters. Includes liquidity setup.
              </p>
            </div>
            <div className="absolute inset-0 bg-gradient-to-br from-app-primary-05 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl" />
          </div>

          {/* Bonk Deploy Option */}
          <div 
            onClick={() => setSelectedDeployType('bonk')}
            className="group relative cursor-pointer bg-app-tertiary border-2 border-app-primary-30 rounded-xl p-4 transition-all duration-300 hover-border-primary hover:shadow-lg hover:shadow-app-primary-20"
          >
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-lg bg-primary-20 flex items-center justify-center">
                <Rocket size={24} className="color-primary group-hover:animate-pulse" />
              </div>
              <h3 className="text-lg font-bold text-app-primary font-mono">LETSBONK.FUN</h3>
              <p className="text-app-secondary text-xs leading-relaxed">
                Create a new letsbonk.fun token with customizable parameters. Includes liquidity setup.
              </p>
            </div>
            <div className="absolute inset-0 bg-gradient-to-br from-app-primary-05 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl" />
          </div>

          
        </div>

        {/* Render selected modal */}
        {selectedDeployType === 'pump' && (
          <DeployPumpModal
            isOpen={true}
            onClose={() => setSelectedDeployType(null)}
            onDeploy={onDeploy}
            handleRefresh={handleRefresh}
            solBalances={solBalances}
          />
        )}
        
        {/* Render Bonk Deploy Modal when selected */}
        {selectedDeployType === 'bonk' && (
          <DeployBonkModal
            isOpen={true}
            onClose={() => setSelectedDeployType(null)}
            onDeploy={onDeploy}
            handleRefresh={handleRefresh}
            solBalances={solBalances}
          />
        )}
        

      </div>
    </div>,
    document.body
  );
};