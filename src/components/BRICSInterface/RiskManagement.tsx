// components/BRICSInterface/RiskManagement.tsx
"use client";

import { Shield, AlertTriangle, Settings, Info } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

interface RiskParameterProps {
  title: string;
  value: string | number;
  status: 'safe' | 'warning' | 'danger';
  info?: string;
}

const RiskParameter = ({ title, value, status, info }: RiskParameterProps) => {
  const statusColors = {
    safe: 'text-green-600',
    warning: 'text-yellow-600',
    danger: 'text-red-600'
  };

  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
      <div className="flex items-center gap-2">
        <span className="text-gray-700">{title}</span>
        {info && (
          <div className="group relative">
            <Info className="w-4 h-4 text-gray-400 cursor-help" />
            <div className="hidden group-hover:block absolute bottom-full left-1/2 transform -translate-x-1/2 p-2 bg-gray-800 text-white text-xs rounded w-48 mb-2">
              {info}
            </div>
          </div>
        )}
      </div>
      <div className={`font-medium ${statusColors[status]}`}>
        {value}
      </div>
    </div>
  );
};

interface ThresholdSettingProps {
  title: string;
  value: number;
  min: number;
  max: number;
  unit: string;
  onChange: (value: number) => void;
}

const ThresholdSetting = ({ title, value, min, max, unit, onChange }: ThresholdSettingProps) => (
  <div className="space-y-2">
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-600">{title}</span>
      <span className="text-sm font-medium">{value}{unit}</span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
    />
    <div className="flex justify-between text-xs text-gray-500">
      <span>{min}{unit}</span>
      <span>{max}{unit}</span>
    </div>
  </div>
);

export default function RiskManagement() {
  return (
    <div className="bg-white p-6 rounded-lg shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold">Risk Management</h2>
          <Shield className="text-blue-600 w-6 h-6" />
        </div>
        <button className="p-2 hover:bg-gray-100 rounded-full">
          <Settings className="w-5 h-5 text-gray-600" />
        </button>
      </div>

      <div className="space-y-4 mb-6">
        <Alert className="border-yellow-200 bg-yellow-50">
          <AlertTriangle className="w-4 h-4 text-yellow-600" />
          <AlertTitle className="text-yellow-600">Risk Alert</AlertTitle>
          <AlertDescription className="text-yellow-700">
            CNY/BRICS liquidity pool approaching minimum threshold
          </AlertDescription>
        </Alert>

        <RiskParameter
          title="System Health"
          value="Optimal"
          status="safe"
          info="Overall system risk assessment based on multiple parameters"
        />
        <RiskParameter
          title="Collateralization Ratio"
          value="150%"
          status="safe"
          info="The ratio of collateral value to minted BRICS tokens"
        />
        <RiskParameter
          title="Liquidation Threshold"
          value="130%"
          status="warning"
          info="Minimum collateralization ratio before liquidation"
        />
      </div>

      <div className="border-t pt-4">
        <h3 className="text-lg font-medium mb-4">Risk Parameters</h3>
        <div className="space-y-6">
          <ThresholdSetting
            title="Minimum Collateralization Ratio"
            value={150}
            min={100}
            max={200}
            unit="%"
            onChange={(value) => console.log('New collateral ratio:', value)}
          />
          <ThresholdSetting
            title="Stability Fee"
            value={0.5}
            min={0}
            max={5}
            unit="%"
            onChange={(value) => console.log('New stability fee:', value)}
          />
          <ThresholdSetting
            title="Debt Ceiling"
            value={1000000}
            min={0}
            max={5000000}
            unit=" BRICS"
            onChange={(value) => console.log('New debt ceiling:', value)}
          />
        </div>
      </div>

      <div className="border-t mt-6 pt-4">
        <h3 className="text-lg font-medium mb-4">Emergency Controls</h3>
        <div className="grid grid-cols-2 gap-4">
          <button
            className="p-3 border border-red-200 text-red-600 rounded-lg hover:bg-red-50"
            onClick={() => console.log('Emergency shutdown triggered')}
          >
            Emergency Shutdown
          </button>
          <button
            className="p-3 border border-yellow-200 text-yellow-600 rounded-lg hover:bg-yellow-50"
            onClick={() => console.log('Pause operations triggered')}
          >
            Pause Operations
          </button>
        </div>
      </div>
    </div>
  );
}