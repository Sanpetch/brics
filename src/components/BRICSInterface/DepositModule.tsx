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


export default function ExchangeModule() {
    const [fromCurrency, setFromCurrency] = useState(currencies[0].id);
    const [toCurrency, setToCurrency] = useState(toCurrencies[0].id);
    const [amount, setAmount] = useState("");
    const [estimatedBRICS, setEstimatedBRICS] = useState(0);

    // คำนวณอัตราแลกเปลี่ยน
    const exchangeRate = exchangeRates[fromCurrency] || 1;

     // Calculate collateralRatio
    const calculateCR = () => {
        if (!amount) return 0;

        const collateralValueCNY = Number(amount) * exchangeRate;
        const bricsMinted = collateralValueCNY / (collateralRatio / 100);

        return (collateralValueCNY / bricsMinted) * 100;
    }

    // Calculate Estimate BRICS mint.
    const calculateEstimatebricsMinted = () => {
        if (!amount) return 0;

        // 20241226
        const collateralValueCNY = Number(amount) * exchangeRate;
        const bricsMinted = collateralValueCNY / (collateralRatio / 100);
        
        return bricsMinted;
    }

    // อัปเดตค่า estimatedBRICS ทุกครั้งที่ amount หรือ fromCurrency เปลี่ยน
    useEffect(() => {
        const newEstimatedBRICS = calculateEstimatebricsMinted();
        setEstimatedBRICS(newEstimatedBRICS);
    }, [amount, fromCurrency]);


    const estimatedCR = calculateCR();
    const estimatebricsMinted = calculateEstimatebricsMinted();


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

            console.log(selectedCurrency);
            //const amountInWei = ethers.utils.parseUnits(amount, 2); // 2 decimals for the example
            const amountInWei = ethers.parseUnits(amount, 2); // 2 decimals for the example

            if(selectedCurrency.id == 'cny')
            {
                const contract_CNY = new ethers.Contract(CNY_CBDC, CNY_CBDC_ABI, signer);
                const checkname = await contract_CNY.totalSupply();
                console.log(checkname);

                // เรียก approve ให้ Vault ใช้งานจำนวนโทเค็น
                const approveTx = await contract_CNY.approve(vaultAddress, amountInWei);
                await approveTx.wait(); 
            }
            else if (selectedCurrency.id == 'rub')
            {
                const contract_RUB = new ethers.Contract(RUB_CBDC, RUB_CBDC_ABI, signer);
                const checkname = await contract_RUB.totalSupply();
                console.log(checkname);

                // เรียก approve ให้ Vault ใช้งานจำนวนโทเค็น
                const approveTx = await contract_RUB.approve(vaultAddress, amountInWei);
                await approveTx.wait(); 

            }
            else if (selectedCurrency.id == 'inr')
            {
                const contract_INR = new ethers.Contract(INR_CBDC, INR_CBDC_ABI, signer);
                const checkname = await contract_INR.totalSupply();
                console.log(checkname);

                // เรียก approve ให้ Vault ใช้งานจำนวนโทเค็น
                const approveTx = await contract_INR.approve(vaultAddress, amountInWei);
                await approveTx.wait(); 
            }
            
             // ยังไม่มี dialog wating (Loading) *********************


            // เรียก Deposit บน Vault (Smart Contract Deposit function)
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

    const handleAmountChange = (e) => {
        setAmount(e.target.value);
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
                className="w-full bg-blue-600 text-white rounded-lg p-3 hover:bg-blue-700 transition-colors"
                onClick={handleDeposit}
            >
                Deposit
            </button>
            </div>

            {amount && (
            <div className="bg-gray-50 p-4 rounded-lg">
                <div className="text-sm text-gray-600">Estimated Rate</div>
                <div className="font-semibold">
                1 {currencies.find((c) => c.id === fromCurrency)?.label} ={" "}
                {exchangeRate.toFixed(2)} BRICS
                </div>
                
                <div className="text-sm text-gray-600 mt-2">Estimated BRICS minted</div>
                <div className="font-semibold">
                    {new Intl.NumberFormat('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                    }).format(estimatebricsMinted)} BRICS
                </div>
            </div>
            )}
        </div>
        </div>
    );
}