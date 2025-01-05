// components/BRICSInterface/VaultStatus.tsx
"use client"; // Ensure client-side rendering
import { useState, useEffect } from "react";
import { useWallet } from "@/components/WalletContext";
import { ethers } from "ethers";

import { Wallet } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import Vault_ABI from "@/components/ABI/Vault.json";

const vaultAddress    = process.env.NEXT_PUBLIC_VAULT_CONTRACT_ADDRESS;
const CNY_CBDC = process.env.NEXT_PUBLIC_CBDC_CNY_ADDRESS;
const INR_CBDC = process.env.NEXT_PUBLIC_CBDC_INR_ADDRESS;
const RUB_CBDC = process.env.NEXT_PUBLIC_CBDC_RUB_ADDRESS;
const BRICS    = process.env.NEXT_PUBLIC_BRICS_ADDRESS;

const currencies = [
  { id: "CNY", name: "CNY_CBDC", label: "Digital Yuan", address:CNY_CBDC },
  { id: "RUB", name: "RUB_CBDC", label: "Digital Ruble", address:RUB_CBDC },
  { id: "INR", name: "INR_CBDC", label: "Digital Rupee", address:INR_CBDC },
  //{ id: "brl", name: "Digital Real", label: "Digital Real" },
  //{ id: "zar", name: "Digital Rand", label: "Digital Rand" },
  //{ id: "brs", name: "BRICS", label: "BRICS Stablecoin" }
];

const currencyWeights = {
  cny: 20,     
  rub: 50, 
  inr: 30, 
};


export default function VaultStatus() {
  const [error, setError] = useState<string | null>(null);
  const { accountData, connectToWallet } = useWallet();
  const [bricstotalSupply, setbricsTotalSupply] = useState(0);
  const [totalDeposits, setTotalDeposits] = useState({
    CNY: 0,
    RUB: 0,
    INR: 0
  });
  const [exchangeDetails, setExchangeDetails] = useState([]);
  const [baseRate, setBaseRate] = useState(null); // อัตราแลกเปลี่ยน 1 BRICS = ? CNY
  
  const [collateralRatio, setCollateralRatio] = useState(120);

  const fetchCR= async () => {
    try {
      if (!window.ethereum) {
        throw new Error("No crypto wallet found");
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
     
      const vaultContract = new ethers.Contract(vaultAddress, Vault_ABI, signer);
      const CR = await vaultContract.getCollateralRatio();

      setCollateralRatio(CR);
      
    } catch (err: any) {
      console.error("Error fetching balances:", err);
      setError(err.message || "Failed to fetch balances");
    }
  };

  const fetchBricstotalSupply = async () => {
    try {
      if (!window.ethereum) {
        throw new Error("No crypto wallet found");
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      const BRICSContract = new ethers.Contract(BRICS, Vault_ABI, signer);
      const totalSupply = await BRICSContract.totalSupply();
      const bricsTotal = ethers.formatUnits(totalSupply, 2); // ใช้ทศนิยม 2 ตำแหน่ง
      
      const totalBRICSFormatted = Intl.NumberFormat('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(bricsTotal);

      setbricsTotalSupply(totalBRICSFormatted);
      
    } catch (err: any) {
      console.error("Error fetching balances:", err);
      setError(err.message || "Failed to fetch balances");
    }
  };

  const fetchTotalDeposits = async () => {
    try {
      if (!window.ethereum) {
        throw new Error("No crypto wallet found");
      }
      
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
     
      const vaultContract = new ethers.Contract(vaultAddress, Vault_ABI, signer);

      // ดึงข้อมูล Total Deposits สำหรับแต่ละ currency
      const deposits = {};
      for (const currency of currencies) {
        const totalDepositsInWei = await vaultContract.getTotalDeposits(currency.id);

        const totalDepositsFormatted = Intl.NumberFormat('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }).format(ethers.formatUnits(totalDepositsInWei, 2));

        deposits[currency.id] = totalDepositsFormatted;
      }

      setTotalDeposits(deposits);
      
    } catch (err: any) {
      console.error("Error fetching balances:", err);
      setError(err.message || "Failed to fetch balances");
    }
  };

  const fetchEexchangeRates= async () => {
    try {
      if (!window.ethereum) {
        throw new Error("No crypto wallet found");
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
     
      const vaultContract = new ethers.Contract(vaultAddress, Vault_ABI, signer);

      // ดึงค่าอัตราแลกเปลี่ยน 1 BRICS = ? CNY
      const baseRateBigInt = await vaultContract.getExchangeRate(currencies[0].id);
      const baseRateFormatted = Number(baseRateBigInt) / 100; // แปลงจาก BigInt และปรับทศนิยม

      setBaseRate(baseRateFormatted);

      // ดึงอัตราแลกเปลี่ยนสำหรับสกุลเงินอื่น ๆ และคำนวณอัตราแลกเปลี่ยนเทียบกับ BRICS
      const details = [];
      for (const currency of currencies) {
        const rateBigInt = await vaultContract.getExchangeRate(currency.id);
        const rateFormatted = Number(rateBigInt) / 100;

        const bricsToCurrency = (baseRateFormatted / rateFormatted); // คำนวณอัตราแลกเปลี่ยน 1 BRICS = ? สกุลเงินอื่น

        details.push({
          label: currency.label,
          id: currency.id,
          rate: rateFormatted,
          bricsToCurrency
        });
      }
      setExchangeDetails(details);
      
    } catch (err: any) {
      console.error("Error fetching balances:", err);
      setError(err.message || "Failed to fetch balances");
    }
  };

  const callRefresh = async () => {
    setTotalDeposits({
      CNY: '0.00',
      RUB: '0.00',
      INR: '0.00'
    });
    setbricsTotalSupply('0.00');
    setCollateralRatio('0');

    fetchBricstotalSupply();
    fetchTotalDeposits();
    fetchCR();
    fetchEexchangeRates();
  };

  useEffect(() => {
    fetchBricstotalSupply();
    fetchTotalDeposits();
    fetchCR();
    fetchEexchangeRates();
  }, []);

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Vault</h2>
        <Wallet className="text-blue-600 w-6 h-6" />
      </div>
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <span className="text-gray-600">BRICS Total Supply</span>
          <span className="font-semibold">{bricstotalSupply} BRICS</span>
        </div>
       
        <div className="flex justify-between items-center">
          <span className="text-gray-600">Collateralization Ratio</span>
          <span className="font-semibold">{collateralRatio}%</span>
        </div>

       
        
        <h2 className="text-sm font-semibold mb-4">Total Deposits</h2>
        <div className="space-y-2 mt-4 text-sm">
          {currencies.map((currency) => (
            <div key={currency.id} className="flex justify-between items-center">
               <span className="text-gray-600">{currency.id} Deposited</span>
               <span className="font-semibold">{totalDeposits[currency.id]} Tokens</span>
            </div>
          ))}
        </div>


        <h2 className="text-sm font-semibold mb-4">ExchangeRate</h2>
        <div className="space-y-2 mt-4">
          {exchangeDetails.map((detail, index) => (
            <div key={index} className="text-xs flex justify-between items-center">
              <span className="font-semibold">1 BRICS = {baseRate.toFixed(2)} CNY / {detail.rate.toFixed(2)} CNY</span> 
              <span className="font-bold"> = {detail.bricsToCurrency.toFixed(2)} {detail.id} </span>
            </div>
          ))}
        </div>


        <div className="pt-4">
          <button
            className="w-full bg-blue-600 text-white rounded-lg p-3 hover:bg-blue-700 transition-colors"
            onClick={callRefresh}
          >
            Refresh
          </button>
        </div>
        {/*
        <Alert className="bg-blue-50 text-blue-800">
          <AlertTitle>System Status</AlertTitle>
          <AlertDescription>
            All currency pools maintaining optimal ratios
          </AlertDescription>
        </Alert>
        */}

      </div>
    </div>
  );
}