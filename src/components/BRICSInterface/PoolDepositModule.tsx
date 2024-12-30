// components/BRICSInterface/ExchangeModule.tsx
"use client";
import { ethers } from "ethers";
import { ArrowRightLeft } from 'lucide-react';
import { useState, useEffect } from 'react';

import CNY_CBDC_ABI from "@/components/ABI/CNY_CBDC_Token.json";
import INR_CBDC_ABI from "@/components/ABI/INR_CBDC_Token.json";
import RUB_CBDC_ABI from "@/components/ABI/RUB_CBDC_Token.json";
import BRICS_ABI from "@/components/ABI/BRICS_Token.json";
import Vault_ABI from "@/components/ABI/Vault.json";
import POOL_TOKEN_ABI from "@/components/ABI/POOL_TokenRegis.json";
import POOL_ABI from "@/components/ABI/POOL.json";

const POOL_ADDR    = process.env.NEXT_PUBLIC_POOL_ADDRESS;
const TOKENREGISTRY    = process.env.NEXT_PUBLIC_POOL_TOKENREGISTRY_ADDRESS;
const BRICS    = process.env.NEXT_PUBLIC_BRICS_ADDRESS;
const CNY_CBDC = process.env.NEXT_PUBLIC_CBDC_CNY_ADDRESS;
const INR_CBDC = process.env.NEXT_PUBLIC_CBDC_INR_ADDRESS;
const RUB_CBDC = process.env.NEXT_PUBLIC_CBDC_RUB_ADDRESS;

const currencies = [
  { id: "cny", name: "CNY_CBDC", label: "Digital Yuan", address:CNY_CBDC },
  { id: "rub", name: "RUB_CBDC", label: "Digital Ruble", address:RUB_CBDC },
  { id: "inr", name: "INR_CBDC", label: "Digital Rupee", address:INR_CBDC },
  //{ id: "brl", name: "Digital Real", label: "Digital Real" },
  //{ id: "zar", name: "Digital Rand", label: "Digital Rand" },
  //{ id: "brs", name: "BRICS", label: "BRICS Stablecoin" }
];

const toCurrencies = [
    { id: "BRICS", name: "BRICS", label: "BRICS Stablecoin", address:BRICS }
  ];

// wait get from smart contract.
const exchangeRates = {
    cny: 1,     // 1 CNY = 1 BRICS
    rub: 0.069, // 1 RUB = 0.069 BRICS
    inr: 0.012, // 1 INR = 0.012 BRICS
};

const currencyWeights = {
    cny: 20,     
    rub: 50, 
    inr: 30, 
};

const collateralRatio = 150; // Collateralization Ratio in percentage
const FEE_RATE = 1;  // 0.01% (1/10000)


export default function PoolDeposit() {
    const [fromCurrency, setFromCurrency] = useState(currencies[0].id);
    const [toCurrency, setToCurrency] = useState(toCurrencies[0].id);
    const [token0, setToken0] = useState("");
    const [token1, setToken1] = useState("");
    const [amount0, setAmount0] = useState("");
    const [amount1, setAmount1] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
  
    const handleAddLiquidity = async () => {
      setLoading(true);
      setError(null);
      setSuccess(null);
  
      try {
        if (!window.ethereum) {
          throw new Error("No crypto wallet found");
        }
  
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
  
        // Initialize the pool contract
        const poolContract = new ethers.Contract(POOL_ADDR, POOL_ABI, signer);
        
        const selectedCurrency = currencies.find((c) => c.id === fromCurrency);
        if (!selectedCurrency) {
            alert("Invalid currency selected.");
            return;
        }
        
        const amountInWei = ethers.parseUnits(amount0, 2); ; // 2 decimals for the example
        const amountInWei1 = ethers.parseUnits(amount1, 2); ; // 2 decimals for the example
      
        // approve
        if(selectedCurrency.id == 'cny')
        {
            const contract_CNY = new ethers.Contract(CNY_CBDC, CNY_CBDC_ABI, signer);
            const checkname = await contract_CNY.totalSupply();
            console.log(checkname);

            // เรียก approve ให้ Vault ใช้งานจำนวนโทเค็น
            const approveTx = await contract_CNY.approve(POOL_ADDR, amountInWei);
            await approveTx.wait(); 
        }
        else if (selectedCurrency.id == 'rub')
        {
            const contract_RUB = new ethers.Contract(RUB_CBDC, RUB_CBDC_ABI, signer);
            const checkname = await contract_RUB.totalSupply();
            console.log(checkname);

            // เรียก approve ให้ Vault ใช้งานจำนวนโทเค็น
            const approveTx = await contract_RUB.approve(POOL_ADDR, amountInWei);
            await approveTx.wait(); 

        }
        else if (selectedCurrency.id == 'inr')
        {
            const contract_INR = new ethers.Contract(INR_CBDC, INR_CBDC_ABI, signer);
            const checkname = await contract_INR.totalSupply();
            console.log(checkname);

            // เรียก approve ให้ Vault ใช้งานจำนวนโทเค็น
            const approveTx = await contract_INR.approve(POOL_ADDR, amountInWei);
            await approveTx.wait(); 
        }


        // fromCurrency = token0
        // toCurrency = token1
        
       
        // Call addLiquidity function
        const tx = await poolContract.addLiquidity(
          fromCurrency.toUpperCase(),
          toCurrency.toUpperCase(),
          amountInWei,
          amountInWei1
        );
        await tx.wait(); // Wait for the transaction to be mined

        alert("Liquidity successful!");
        setSuccess("Liquidity added successfully!");

        window.location.reload();
        
      } catch (err) {
        console.error(err);
        setError(err.message || "An error occurred");
      } finally {
        setLoading(false);
      }
    };
  
    return (
        <div className="bg-white p-6 rounded-lg shadow-sm">
        <h2 className="text-xl font-semibold mb-4">Deposit Liquidity</h2>
  
        {error && <div className="text-red-600 mb-4">{error}</div>}
        {success && <div className="text-green-600 mb-4">{success}</div>}
  
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Token 1</label>
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
  
          <div>
            <label className="block text-sm font-medium text-gray-700">Token 2</label>
            <select 
              className="w-full p-2 border rounded-lg bg-white"
              value={toCurrency}
              onChange={(e) => setToCurrency(e.target.value)}
            >
              {toCurrencies.filter(c => c.id !== fromCurrency).map(currency => (
                <option key={currency.id} value={currency.id}>
                  {currency.label}
                </option>
              ))}
            </select>
          </div>
  
          <div>
            <label className="block text-sm font-medium text-gray-700">Amount 1</label>
            <input
              type="number"
              value={amount0}
              onChange={(e) => setAmount0(e.target.value)}
              placeholder="Enter amount for token 1"
               className="w-full p-2 border rounded-lg"
            />
          </div>
  
          <div>
            <label className="block text-sm font-medium text-gray-700">Amount 2</label>
            <input
              type="number"
              value={amount1}
              onChange={(e) => setAmount1(e.target.value)}
              placeholder="Enter amount for token 2"
              className="w-full p-2 border rounded-lg"
            />
          </div>
  
  
          {/* Add Liquidity Button */}
          <div>
            <button
              disabled={loading}
              onClick={handleAddLiquidity}
              className="w-full bg-blue-600 text-white font-semibold py-2 px-4 rounded-md shadow-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "Processing..." : "Add Liquidity"}
            </button>
          </div>
        </div>
      </div>
    );
}