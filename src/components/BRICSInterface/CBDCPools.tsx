import { Building2 } from 'lucide-react';
import { mockCBDCs } from './mockData';

export default function CBDCPools() {
  return (
    <div className="bg-white p-6 rounded-lg shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">National CBDC Pools</h2>
        <Building2 className="text-blue-600 w-6 h-6" />
      </div>
      <div className="space-y-3">
        {mockCBDCs.map((cbdc) => (
          <div
            key={cbdc.country}
            className="flex items-center justify-between p-2 bg-gray-50 rounded"
          >
            <div>
              <div className="font-medium">{cbdc.country}</div>
              <div className="text-sm text-gray-500">{cbdc.currency}</div>
            </div>
            <div className="text-right">
              <div className="font-medium">{cbdc.balance}</div>
              <div className="text-sm text-green-600">{cbdc.status}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}