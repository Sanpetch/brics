// components/BRICSInterface/PoolWithdrawModule.tsx
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

export default function PoolWithdrawModule() {
  const [balances, setBalances] = useState<{ [address: string]: string }>({}); // Store balances

  const fetchBalances = async () => {
    try {
      if (!window.ethereum) {
        throw new Error("No crypto wallet found");
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      const vaultContract = new ethers.Contract(vaultAddress, Vault_ABI, signer);
      // wait Deploy samrt contract and use ABI
      //  getTotalDeposits('CNY), getTotalDeposits('INR), getTotalDeposits('RUB)

      /*
      //CNY
      const rawBalance = await vaultContract.getUserDeposit(
          accountData?.address,
          'CNY'
      );
      const decimals = await contract_CNY.decimals();
      const formattedBalance = ethers.formatUnits(rawBalance, decimals);

      //INR
      const rawBalanceINR = await vaultContract.getUserDeposit(
        accountData?.address,
        'INR'
      );
      const decimalsINR = await contract_INR.decimals();
      const formattedBalanceINR = ethers.formatUnits(rawBalanceINR, decimalsINR);

      //RUB
      const rawBalanceRUB = await vaultContract.getUserDeposit(
        accountData?.address,
        'RUB'
      );
      const decimalsRUB = await contract_RUB.decimals();
      const formattedBalanceRUB = ethers.formatUnits(rawBalanceRUB, decimalsRUB);

      //BRICS
      const rawBalanceBRICS = await contract_BRICS.balanceOf(accountData?.address);
      const decimalsBRICS = await contract_BRICS.decimals();
      const formattedBalanceBRICS = ethers.formatUnits(rawBalanceBRICS, decimalsBRICS);

      const balanceBIRCS = new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(Number(formattedBalanceBRICS));
      setbalanceOfBRICS(balanceBIRCS);

      const balances: { [address: string]: string } = {};
      balances[CNY_CBDC] = new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(Number(formattedBalance));

      balances[INR_CBDC] = new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(Number(formattedBalanceINR));

      balances[RUB_CBDC] = new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(Number(formattedBalanceRUB));
      */

      
      //setBalances(balances);
    } catch (err: any) {
      console.error("Error fetching balances:", err);
      setError(err.message || "Failed to fetch balances");
    }
  };




  return (
    <div className="bg-white p-6 rounded-lg shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Pool withdraw </h2>
        <Wallet className="text-blue-600 w-6 h-6" />
      </div>
      
      <div className="space-y-4">
        

        <Alert className="bg-blue-50 text-blue-800">
          <AlertTitle>System Status</AlertTitle>
          <AlertDescription>
            All currency pools maintaining optimal ratios
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
}