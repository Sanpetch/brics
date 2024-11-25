// components/BRICSInterface/VaultStatus.tsx
import { Wallet } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

export default function VaultStatus() {
  return (
    <div className="bg-white p-6 rounded-lg shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">BRICS Multi-Currency Vault</h2>
        <Wallet className="text-blue-600 w-6 h-6" />
      </div>
      
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <span className="text-gray-600">Total Value Locked</span>
          <span className="font-semibold">3.55B BRICS</span>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-gray-600">Collateralization Ratio</span>
          <span className="font-semibold">150%</span>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-gray-600">Stability Fee</span>
          <span className="font-semibold">0.5%</span>
        </div>
        
        <Alert className="bg-blue-50 text-blue-800">
          <AlertTitle>System Status</AlertTitle>
          <AlertDescription>
            All currency pools maintaining optimal ratios
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
}