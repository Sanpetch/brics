// components/BRICSInterface/ExchangeModule.tsx
"use client";

import { ArrowRightLeft } from 'lucide-react';
import { useState } from 'react';

const currencies = [
  { id: "cny", name: "e-CNY", label: "Digital Yuan" },
  { id: "rub", name: "Digital Ruble", label: "Digital Ruble" },
  { id: "inr", name: "Digital Rupee", label: "Digital Rupee" },
  { id: "brl", name: "Digital Real", label: "Digital Real" },
  { id: "zar", name: "Digital Rand", label: "Digital Rand" },
  { id: "brs", name: "BRICS", label: "BRICS Stablecoin" }
];

export default function ExchangeModule() {
  const [fromCurrency, setFromCurrency] = useState(currencies[0].id);
  const [toCurrency, setToCurrency] = useState(currencies[5].id);
  const [amount, setAmount] = useState("");

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Currency Exchange</h2>
        <ArrowRightLeft className="text-blue-600 w-6 h-6" />
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm text-gray-600">From Currency</label>
          <select 
            className="w-full p-2 border rounded-lg bg-white"
            value={fromCurrency}
            onChange={(e) => setFromCurrency(e.target.value)}
          >
            {currencies.filter(c => c.id !== toCurrency).map(currency => (
              <option key={currency.id} value={currency.id}>
                {currency.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm text-gray-600">Amount</label>
          <input
            type="number"
            className="w-full p-2 border rounded-lg"
            placeholder="Enter amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm text-gray-600">To Currency</label>
          <select 
            className="w-full p-2 border rounded-lg bg-white"
            value={toCurrency}
            onChange={(e) => setToCurrency(e.target.value)}
          >
            {currencies.filter(c => c.id !== fromCurrency).map(currency => (
              <option key={currency.id} value={currency.id}>
                {currency.label}
              </option>
            ))}
          </select>
        </div>

        <div className="pt-2">
          <button 
            className="w-full bg-blue-600 text-white rounded-lg p-3 hover:bg-blue-700 transition-colors"
            onClick={() => console.log('Exchange initiated', { fromCurrency, toCurrency, amount })}
          >
            Execute Exchange
          </button>
        </div>

        {amount && (
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="text-sm text-gray-600">Estimated Rate</div>
            <div className="font-semibold">
              1 {currencies.find(c => c.id === fromCurrency)?.name} = 
              {' '}1 {currencies.find(c => c.id === toCurrency)?.name}
            </div>
            <div className="text-sm text-gray-600 mt-2">Estimated Fees</div>
            <div className="font-semibold">0.00 BRICS</div>
          </div>
        )}
      </div>
    </div>
  );
}