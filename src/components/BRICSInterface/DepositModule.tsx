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

const currencies = [
  { id: "cny", name: "CNY_CBDC", label: "Digital Yuan", address:CNY_CBDC },
  { id: "rub", name: "RUB_CBDC", label: "Digital Ruble", address:RUB_CBDC },
  { id: "inr", name: "INR_CBDC", label: "Digital Rupee", address:INR_CBDC },
  //{ id: "brl", name: "Digital Real", label: "Digital Real" },
  //{ id: "zar", name: "Digital Rand", label: "Digital Rand" },
  //{ id: "brs", name: "BRICS", label: "BRICS Stablecoin" }
];

const toCurrencies = [
    { id: "brs", name: "BRICS", label: "BRICS Stablecoin", address:BRICS }
  ];

// wait get from smart contract.
const collateralRatio = 120; // Collateralization Ratio in percentage

/*
Smart contract
cny :1000
rub 69
inr 12
*/
const exchangeRates = {
  cny: 26,    // 1 BRICS = 0.26 CNY -> scaled by 100
  rub: 377,   // 1 BRICS = 3.77 RUB -> scaled by 100
  inr: 302    // 1 BRICS = 3.02 INR -> scaled by 100
};

const currencyWeights = {
    cny: 20,     
    rub: 50, 
    inr: 30, 
};

export default function ExchangeModule() {
    const [fromCurrency, setFromCurrency] = useState(currencies[0].id);
    const [toCurrency, setToCurrency] = useState(toCurrencies[0].id);
    const [amount, setAmount] = useState("");
    const [estimatedBRICS, setEstimatedBRICS] = useState(0);
    const [details, setDetails] = useState({ preCR: 0, postCR: 0 });
   
    const exchangeRate = exchangeRates[fromCurrency] || 1 ;
    
    const calculateEstimatebricsMinted = () => {
        if (!amount || !fromCurrency) return { preCR: 0, postCR: 0 }

        const exchangeRateLocal = exchangeRates[fromCurrency]; // อัตราแลกเปลี่ยนของสกุลเงินที่เลือก
        const collateralValue = Number(amount) * 100; // แปลงเป็นหน่วยที่มี 2 ตำแหน่งทศนิยม (scaled by 100)
        const bricsPreCR = collateralValue / exchangeRateLocal; // จำนวน BRICS ก่อนใช้ collateralRatio
        const bricsPostCR = (bricsPreCR * 100) / collateralRatio; // จำนวน BRICS หลังใช้ collateralRatio
    
        return { preCR: bricsPreCR, postCR: Math.floor(bricsPostCR) }; // ปัดเศษลงให้เป็นจำนวนเต็ม
    }

    useEffect(() => {
        const { preCR, postCR } = calculateEstimatebricsMinted();

        setEstimatedBRICS(postCR);
        setDetails({ preCR, postCR });

    }, [amount, fromCurrency]);


    const handleDeposit = async () => {
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
            
            const selectedCurrency = currencies.find((c) => c.id === fromCurrency);
            if (!selectedCurrency) {
                alert("Invalid currency selected.");
                return;
            }

            // แปลงจำนวนเงินเป็นหน่วยที่มี 2 ทศนิยม
            const amountInWei = ethers.parseUnits(amount, 2); 

            if(selectedCurrency.id == 'cny')
            {
                const contract_CNY = new ethers.Contract(CNY_CBDC, CNY_CBDC_ABI, signer);
                
                // Approve Vault ให้สามารถใช้จำนวนโทเค็นที่ระบุได้
                const approveTx = await contract_CNY.approve(vaultAddress, amountInWei);
                await approveTx.wait(); 
            }
            else if (selectedCurrency.id == 'rub')
            {
                const contract_RUB = new ethers.Contract(RUB_CBDC, RUB_CBDC_ABI, signer);

                // Approve Vault ให้สามารถใช้จำนวนโทเค็นที่ระบุได้
                const approveTx = await contract_RUB.approve(vaultAddress, amountInWei);
                await approveTx.wait(); 
            }
            else if (selectedCurrency.id == 'inr')
            {
                const contract_INR = new ethers.Contract(INR_CBDC, INR_CBDC_ABI, signer);

                // Approve Vault ให้สามารถใช้จำนวนโทเค็นที่ระบุได้
                const approveTx = await contract_INR.approve(vaultAddress, amountInWei);
                await approveTx.wait(); 
            }
            
            // ********************* ยังไม่มี dialog wating (Loading) *********************

            // เรียกฟังก์ชัน depositCollateral ใน Smart Contract
            const vaultContract = new ethers.Contract(vaultAddress, Vault_ABI, signer);
            const depositTx = await vaultContract.depositCollateral(
                selectedCurrency.id.toUpperCase(),
                amountInWei
            );
            await depositTx.wait(); // รอการฝากสำเร็จ
        
            alert("Deposit successful!");
            window.location.reload();
        } catch (error) {
            console.error("Error during deposit:", error);
            alert("Something went wrong. Please try again.");
        }
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-sm">
        <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Deposit</h2>
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
                {toCurrencies.filter(c => c.id !== fromCurrency).map(toCurrencies => (
                <option key={toCurrencies.id} value={toCurrencies.id}>
                    {toCurrencies.label}
                </option>
                ))}
            </select>
            </div>

            <div className="pt-2">
            <button 
                className="w-full bg-blue-600 text-white rounded-lg p-3 hover:bg-blue-700 transition-colors"
                onClick={handleDeposit}
            >
                Deposit
            </button>
            </div>

            {amount && (
            <div className="bg-gray-50 p-4 rounded-lg">
                <div className="font-semibold">Estimated Rate</div>
                <div className="text-sm">
                    - 1 BRICS ≈ {(exchangeRate / 100).toFixed(2)} {currencies.find((c) => c.id === fromCurrency)?.label} 
                </div>
                <div className="text-sm">
                    - 1 {currencies.find((c) => c.id === fromCurrency)?.label} to BRICS สามารถทำได้โดยการหาร 1 ด้วย {exchangeRate / 100}
                </div>
                <div className="text-sm ">
                    - 1 {currencies.find((c) => c.id === fromCurrency)?.label} ≈ {(100 / exchangeRate).toFixed(2)} BRICS
                </div>
                <div className="font-semibold mt-2">Estimated BRICS mint</div>
                <div className="text-sm">
                - คำนวณ BRICS ที่จะได้รับ (ก่อนใช้ CR): {details.preCR.toFixed(2)} BRICS
                </div>
                <div className="text-sm">
                - ปรับจำนวน BRICS ด้วย CR({collateralRatio}%) = ({details.preCR.toFixed(2)} x 100 ) / {collateralRatio/100} ≈ {details.postCR.toFixed(2)}
                </div>
                <div className="font-semibold mt-2">
                Estimated mint: {new Intl.NumberFormat('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                }).format(estimatedBRICS)} BRICS
                </div>
            </div>
            )}
        </div>
        </div>
    );
}