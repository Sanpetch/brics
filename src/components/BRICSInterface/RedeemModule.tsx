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
  { id: "CNY", name: "CNY_CBDC", label: "Digital Yuan", address:CNY_CBDC },
  { id: "RUB", name: "RUB_CBDC", label: "Digital Ruble", address:RUB_CBDC },
  { id: "INR", name: "INR_CBDC", label: "Digital Rupee", address:INR_CBDC },
  //{ id: "brl", name: "Digital Real", label: "Digital Real" },
  //{ id: "zar", name: "Digital Rand", label: "Digital Rand" },
  //{ id: "brs", name: "BRICS", label: "BRICS Stablecoin" }
];

const currencies = [
    { id: "BRICS", name: "BRICS", label: "BRICS Stablecoin", address:BRICS }
  ];


export default function ExchangeModule() {
    const [initialized, setInitialized] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [toCurrency, setToCurrency] = useState(toCurrencies[0].id);
    const [fromCurrency, setFromCurrency] = useState(currencies[0].id);
    const [amount, setAmount] = useState("");
    const [collateralDetails, setCollateralDetails] = useState({ preFloor: 0, postFloor: 0 });
    const [collateralRatio, setCollateralRatio] = useState(120);
    const [exchangeDetails, setExchangeDetails] = useState([]);
    const [baseRate, setBaseRate] = useState(null); // อัตราแลกเปลี่ยน 1 BRICS = ? CNY
    const [exchangeRates, setExchangeRates] = useState(1); // อัตราแลกเปลี่ยน 1 BRICS = ? CNY
    const [exchangeRate, setExchangeRate] = useState(1);
 

    const fetchCR= async () => {
        try {
          if (!window.ethereum) {
            throw new Error("No crypto wallet found");
          }
          const provider = new ethers.BrowserProvider(window.ethereum);
          const signer = await provider.getSigner();
         
          const vaultContract = new ethers.Contract(vaultAddress, Vault_ABI, signer);
          const CR = await vaultContract.getCollateralRatio();
          
          setCollateralRatio(Number(CR));
          
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
          const baseRateBigInt = await vaultContract.getExchangeRate(currencies[0].id);
          const baseRateFormatted = Number(baseRateBigInt) / 100; // แปลงจาก BigInt และปรับทศนิยม
    
          setBaseRate(baseRateFormatted);
    
          const details = [];
          const detailEX = [];
          for (const currency of toCurrencies) {
            const rateBigInt = await vaultContract.getExchangeRate(currency.id);
            const rateFormatted = Number(rateBigInt) / 100;
    
            const bricsToCurrency = (baseRateFormatted / rateFormatted); // คำนวณอัตราแลกเปลี่ยน 1 BRICS = ? สกุลเงินอื่น
          
            details.push({
              label: currency.label,
              id: currency.id,
              rate: rateFormatted,
              bricsToCurrency
            });

            detailEX.push(rateFormatted);
          }
          setExchangeDetails(details);
         
          setExchangeRates(
            {
                CNY: detailEX[0],    // 1 BRICS = 0.26 CNY -> scaled by 100
                RUB: detailEX[1],   // 1 BRICS = 3.77 RUB -> scaled by 100
                INR: detailEX[2]    // 1 BRICS = 3.02 INR -> scaled by 100
            }
          );
          
        } catch (err: any) {
          console.error("Error fetching balances:", err);
          setError(err.message || "Failed to fetch balances");
        }
    };

    const calculateCollateralToReceive =  () => {
        if (!amount || !toCurrency) return { preFloor: 0, postFloor: 0 };
      
        const exchangeRateLocal = exchangeRates[toCurrency] || 1;
       
        const bricsAmount = Number(amount);
        const collateralPreFloor = bricsAmount * exchangeRateLocal; // จำนวนเงินค้ำประกันก่อนปัดเศษ
        const collateralPostFloor = Math.floor(collateralPreFloor); // ปัดเศษลงเป็นจำนวนเต็ม
    
        return { preFloor: collateralPreFloor, postFloor: collateralPostFloor };

    };
  
    useEffect(() => {
        if (!initialized) {
            fetchCR();
            fetchEexchangeRates();
            setInitialized(true);
        }
    }, [initialized])

    useEffect(() => {
        setExchangeRate(exchangeRates[toCurrency]) ;
        const details = calculateCollateralToReceive();
        setCollateralDetails(details);
    }, [amount, toCurrency]);
  

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
        
            const bricsContract = new ethers.Contract(BRICS, BRICS_ABI, signer);
            const userAddress = await signer.getAddress();

            // ตรวจสอบยอดคงเหลือ BRICS ใน Wallet
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

            const collateralDetails = calculateCollateralToReceive();
          
            console.log("Redeem Amount (BRICS):", amount);
            console.log("Collateral Amount to Receive:",   collateralDetails.postFloor);

            // ********************* ยังไม่มี dialog wating (Loading) *********************

            const amountInWei = ethers.parseUnits(amount, 2); // 2 decimals for the example
            console.log("amountInWei:", amountInWei);

            const vaultContract = new ethers.Contract(vaultAddress, Vault_ABI, signer);
            const redeemTx = await vaultContract.redeemCollateral(selectedCurrency.id.toUpperCase(), amountInWei);
            await redeemTx.wait();

            alert(`Redeem successful! You received ${  collateralDetails.postFloor} ${selectedCurrency.label}.`);
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
                    <div className="text-sm text-gray-600">Estimated Rate</div>
                    <div className="font-semibold mb-2">
                    1 BRICS = {exchangeRate} {toCurrencies.find((c) => c.id === toCurrency)?.label}
                    </div>

                    <div className="text-sm text-gray-600 mt-2">Steps of Calculation</div>
                    <div className="text-sm">
                    -  collateral = {amount} /  {exchangeRate} ≈ {collateralDetails.preFloor}
                    </div>
                    <div className="text-sm">
                    - จำนวนเงินค้ำประกันหลังปัดเศษ: {collateralDetails.postFloor} {toCurrencies.find((c) => c.id === toCurrency)?.label}
                    </div>
                    <div className="font-semibold mt-2">
                    Estimated redeem: {collateralDetails.postFloor} {toCurrencies.find((c) => c.id === toCurrency)?.label}
                    </div>
                </div>
            )}
        </div>
        </div>
    );
}