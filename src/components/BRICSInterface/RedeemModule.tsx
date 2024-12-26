// components/BRICSInterface/RedeemModule.tsx
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

export default function RedeemModule() {

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Redeem</h2>
        <Wallet className="text-blue-600 w-6 h-6" />
      </div>
      
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <span className="text-gray-600">xxxx</span>
          <span className="font-semibold">xxxx</span>
        </div>

        
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