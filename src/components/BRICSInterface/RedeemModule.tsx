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

const vaultAddress    = process.env.NEXT_PUBLIC_VAULT_CONTRACT_ADDRESS;
const BRICS    = process.env.NEXT_PUBLIC_BRICS_ADDRESS;
const CNY_CBDC = process.env.NEXT_PUBLIC_CBDC_CNY_ADDRESS;
const INR_CBDC = process.env.NEXT_PUBLIC_CBDC_INR_ADDRESS;
const RUB_CBDC = process.env.NEXT_PUBLIC_CBDC_RUB_ADDRESS;

const toCurrencies = [
  { id: "cny", name: "CNY_CBDC", label: "Digital Yuan", address:CNY_CBDC },
  { id: "rub", name: "RUB_CBDC", label: "Digital Ruble", address:RUB_CBDC },
  { id: "inr", name: "INR_CBDC", label: "Digital Rupee", address:INR_CBDC },
  //{ id: "brl", name: "Digital Real", label: "Digital Real" },
  //{ id: "zar", name: "Digital Rand", label: "Digital Rand" },
  //{ id: "brs", name: "BRICS", label: "BRICS Stablecoin" }
];

const currencies = [
    { id: "brs", name: "BRICS", label: "BRICS Stablecoin", address:BRICS }
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


export default function ExchangeModule() {
    const [toCurrency, setToCurrency] = useState(toCurrencies[0].id);
    const [fromCurrency, setFromCurrency] = useState(currencies[0].id);
    const [amount, setAmount] = useState("");
    const [estimatedBRICS, setEstimatedBRICS] = useState(0);

    // อัตราแลกเปลี่ยน
    const exchangeRate = exchangeRates[toCurrency] || 1;

    const calculateCollateralToReceive = () => {
      if (!amount || !toCurrency) return 0;
  
      const exchangeRate = exchangeRates[toCurrency] || 1; // อัตราแลกเปลี่ยนของสกุลเงินที่เลือก
      const equivalentCurrency = Number(amount) * exchangeRate; // จำนวนโทเค็นที่ได้ตาม Exchange Rate
      const collateralAmount = equivalentCurrency * (collateralRatio / 100); // Apply CR = 150%
  
      return collateralAmount;
    };
  

    useEffect(() => {
      const estimatedValue = calculateCollateralToReceive();
      setEstimatedBRICS(estimatedValue);
    }, [amount, toCurrency]);
  
    const estimateCollateralToReceive = calculateCollateralToReceive();

    const handleRedeem = async () => {
      if (!amount) {
          alert("Please enter an amount.");
          return;
      }
      try {
          if (!window.ethereum) {
              throw new Error("No crypto wallet found");
          }
          const provider = new ethers.BrowserProvider(window.ethereum);
          const signer = await provider.getSigner();
  
          // ตรวจสอบยอดคงเหลือ BRICS ใน Wallet
          const bricsContract = new ethers.Contract(BRICS, BRICS_ABI, signer);
          const userAddress = await signer.getAddress();
          const balance = await bricsContract.balanceOf(userAddress);
          const balanceInDecimal = ethers.formatUnits(balance, 2); // 2 decimals
  
          if (Number(amount) > Number(balanceInDecimal)) {
              alert(`Insufficient BRICS balance. You only have ${balanceInDecimal} BRICS.`);
              return;
          }
  
          const selectedCurrency = toCurrencies.find((c) => c.id === toCurrency);
          if (!selectedCurrency) {
              alert("Invalid currency selected.");
              return;
          }
  
          const collateralAmount = calculateCollateralToReceive();
  
          console.log("Redeem Amount (BRICS):", amount);
          console.log("Collateral Amount to Receive:", collateralAmount);
  
          // Approve Vault เพื่อให้สามารถใช้โทเค็น BRICS คืนได้
          //const approveTx = await bricsContract.approve(vaultAddress, ethers.parseUnits(amount, 2));
          //await approveTx.wait();
  
           // ยังไม่มี dialog wating (Loading) *********************
        
          // เรียกใช้ฟังก์ชัน Redeem ใน Vault
          const vaultContract = new ethers.Contract(vaultAddress, Vault_ABI, signer);
          
          //const pre_redeemTx = await vaultContract["previewRedeem(string,uint256)"](selectedCurrency.id.toUpperCase(), amount);
          //alert(`Preview Redeem: You will receive ${ethers.formatUnits(pre_redeemTx, 2)} ${selectedCurrency.label}.`);
          
          // Call the redeemCollateral function
          const amountInWei = ethers.parseUnits(amount, 2); // 2 decimals for the example
          console.log("amountInWei:", amountInWei);
          const redeemTx = await vaultContract.redeemCollateral(selectedCurrency.id.toUpperCase(), amountInWei);
          await redeemTx.wait();

          /*
          const redeemTx = await vaultContract.redeemCollateral(
              selectedCurrency.id.toUpperCase(), // ส่งชื่อสกุลเงิน เช่น "CNY_CBDC", "RUB_CBDC"
              ethers.parseUnits(amount, 2)
          );
          */
          //await redeemTx.wait();
  
          alert(`Redeem successful! You received ${collateralAmount.toFixed(2)} ${selectedCurrency.label}.`);
          window.location.reload();
      } catch (error) {
          console.error("Error during redeem:", error);
          alert("Something went wrong. Please try again.");
      }
  };
  
  

    const handleAmountChange = (e) => {
        setAmount(e.target.value);
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-sm">
        <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Redeem</h2>
            <ArrowRightLeft className="text-blue-600 w-6 h-6" />
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm text-gray-600">From Currency</label>
            <select 
                className="w-full p-2 border rounded-lg bg-white"
                value={fromCurrency}
                onChange={(e) => setFormCurrency(e.target.value)}
            >
                {currencies.filter(c => c.id !== toCurrency).map(currencies => (
                <option key={currencies.id} value={currencies.id}>
                    {currencies.label}
                </option>
                ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm text-gray-600">Amount</label>
            <input
                name="amount"
                type="number"
                className="w-full p-2 border rounded-lg"
                placeholder="Enter amount"
                value={amount}
                onChange={handleAmountChange}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm text-gray-600">To Currency</label>
            <select 
                className="w-full p-2 border rounded-lg bg-white"
                value={toCurrency}
                onChange={(e) => setToCurrency(e.target.value)}
            >
                {toCurrencies.filter(c => c.id !== fromCurrency).map(toCurrencies => (
                <option key={toCurrencies.id} value={toCurrencies.id}>
                    {toCurrencies.label}
                </option>
                ))}
            </select>
            </div>

            <div className="pt-2">
              <button 
                  className="w-full bg-green-600 text-white rounded-lg p-3 hover:bg-green-700 transition-colors"
                  onClick={handleRedeem}
              >
                  Redeem
              </button>
            </div>

            {amount && (
              <div className="bg-gray-50 p-4 rounded-lg mt-4">
                  <div className="text-sm text-gray-600">Collateral to Receive</div>
                  <div className="font-semibold">
                      {new Intl.NumberFormat('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        }).format(estimateCollateralToReceive)} {toCurrencies.find(c => c.id === toCurrency)?.label}
                  </div>
              </div>
            )}
        </div>
        </div>
    );
}