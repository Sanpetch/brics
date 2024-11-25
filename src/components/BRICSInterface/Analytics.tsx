// components/BRICSInterface/Analytics.tsx
"use client";

import { LineChart, BarChart3, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { useState } from 'react';

const timeRanges = ['24h', '7d', '30d', 'All'] as const;
type TimeRange = typeof timeRanges[number];

interface StatCardProps {
  title: string;
  value: string;
  change: number;
  timeRange: TimeRange;
}

const StatCard = ({ title, value, change, timeRange }: StatCardProps) => {
  return (
    <div className="bg-white p-4 rounded-lg shadow-sm">
      <div className="flex justify-between items-start mb-2">
        <span className="text-sm text-gray-600">{title}</span>
        <span className="text-xs text-gray-500">{timeRange}</span>
      </div>
      <div className="flex items-end gap-2">
        <span className="text-2xl font-semibold">{value}</span>
        <div className={`flex items-center text-sm ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {change >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
          {Math.abs(change)}%
        </div>
      </div>
    </div>
  );
};

interface DistributionBarProps {
  label: string;
  percentage: number;
}

const DistributionBar = ({ label, percentage }: DistributionBarProps) => (
  <div className="flex justify-between items-center">
    <span className="text-sm">{label}</span>
    <div className="flex items-center gap-2">
      <div className="w-32 bg-gray-200 rounded-full h-2">
        <div 
          className="bg-blue-600 h-2 rounded-full" 
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-sm">{percentage}%</span>
    </div>
  </div>
);

export default function Analytics() {
  const [selectedRange, setSelectedRange] = useState<TimeRange>('24h');

  const distributions = [
    { label: 'e-CNY', percentage: 40 },
    { label: 'Digital Ruble', percentage: 25 },
    { label: 'Digital Rupee', percentage: 15 },
    { label: 'Digital Real', percentage: 12 },
    { label: 'Digital Rand', percentage: 8 }
  ];

  return (
    <div className="col-span-2 bg-white p-6 rounded-lg shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold">System Analytics</h2>
          <LineChart className="text-blue-600 w-6 h-6" />
        </div>
        <div className="flex gap-2">
          {timeRanges.map((range) => (
            <button
              key={range}
              onClick={() => setSelectedRange(range)}
              className={`px-3 py-1 rounded-full text-sm ${
                selectedRange === range
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <StatCard
          title="Total Volume"
          value="2.5B BRS"
          change={12.5}
          timeRange={selectedRange}
        />
        <StatCard
          title="Active Vaults"
          value="5"
          change={0}
          timeRange={selectedRange}
        />
        <StatCard
          title="Total Transactions"
          value="1,234"
          change={8.3}
          timeRange={selectedRange}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium">CBDC Distribution</h3>
            <BarChart3 className="text-blue-600 w-5 h-5" />
          </div>
          <div className="space-y-3">
            {distributions.map((dist) => (
              <DistributionBar 
                key={dist.label}
                label={dist.label}
                percentage={dist.percentage}
              />
            ))}
          </div>
        </div>

        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium">Recent Activity</h3>
          </div>
          <div className="space-y-3">
            {[
              { action: 'Exchange CNY → BRS', time: '2 min ago' },
              { action: 'New Vault Created', time: '5 min ago' },
              { action: 'Exchange RUB → BRS', time: '8 min ago' }
            ].map((activity, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <span>{activity.action}</span>
                </div>
                <span className="text-gray-600">{activity.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}