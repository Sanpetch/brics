"use client"; // Ensure client-side rendering
import { useState, useEffect } from "react";
import { useWallet } from "@/components/WalletContext";
import { ethers } from "ethers";

// ABI
import CNY_CBDC_ABI from "@/components/ABI/CNY_CBDC_Token.json";
import INR_CBDC_ABI from "@/components/ABI/INR_CBDC_Token.json";
import RUB_CBDC_ABI from "@/components/ABI/RUB_CBDC_Token.json";
import BRICS_ABI from "@/components/ABI/BRICS_Token.json";

import { Building2 } from "lucide-react";
import { mockCBDCs } from "./mockData";

const CNY_CBDC = process.env.NEXT_PUBLIC_CBDC_CNY_ADDRESS;
const INR_CBDC = process.env.NEXT_PUBLIC_CBDC_INR_ADDRESS;
const RUB_CBDC = process.env.NEXT_PUBLIC_CBDC_RUB_ADDRESS;
const BRICS    = process.env.NEXT_PUBLIC_BRICS_ADDRESS;

export default function CBDCPools() {
  const { accountData, connectToWallet } = useWallet();
  const [initialized, setInitialized] = useState(false);
  const [balances, setBalances] = useState<{ [address: string]: string }>({}); // Store balances
  const [error, setError] = useState<string | null>(null);
  const [balanceOfBRICS, setbalanceOfBRICS] = useState(false);

  useEffect(() => {
    if (!initialized && !accountData) {
      connectToWallet().finally(() => setInitialized(true));
    }
  }, [initialized, accountData, connectToWallet]);

  const fetchBalances = async () => {
    try {
      if (!window.ethereum) {
        throw new Error("No crypto wallet found");
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract_CNY = new ethers.Contract(CNY_CBDC, CNY_CBDC_ABI, signer);
      const contract_INR = new ethers.Contract(INR_CBDC, INR_CBDC_ABI, signer);
      const contract_RUB = new ethers.Contract(RUB_CBDC, RUB_CBDC_ABI, signer);
      const contract_BRICS = new ethers.Contract(BRICS, BRICS_ABI, signer);

      //CNY
      const rawBalance = await contract_CNY.balanceOf(accountData?.address);
      const decimals = await contract_CNY.decimals();
      const formattedBalance = ethers.formatUnits(rawBalance, decimals);

      //INR
      const rawBalanceINR = await contract_INR.balanceOf(accountData?.address);
      const decimalsINR = await contract_INR.decimals();
      const formattedBalanceINR = ethers.formatUnits(rawBalanceINR, decimalsINR);

      //RUB
      const rawBalanceRUB = await contract_RUB.balanceOf(accountData?.address);
      const decimalsRUB = await contract_RUB.decimals();
      const formattedBalanceRUB = ethers.formatUnits(rawBalanceRUB, decimalsRUB);


      //RUB
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

      /*
      for (const cbdc of mockCBDCs) {
        if (!cbdc.address || !ethers.isAddress(cbdc.address)) {
          console.warn(`Invalid address: ${cbdc.address}`);
          balances[cbdc.address] = "Invalid Address";
          continue;
        }
        
        
        balances[cbdc.address] = new Intl.NumberFormat("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(Number(formattedBalance));
      }
        */
      setBalances(balances);
    } catch (err: any) {
      console.error("Error fetching balances:", err);
      setError(err.message || "Failed to fetch balances");
    }
  };

  useEffect(() => {
    if (accountData?.address) {
      fetchBalances();
    }
  }, [accountData]);

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm">
        <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">BRICS</h2>
            <Building2 className="text-blue-600 w-6 h-6" />
        </div>
        <div className="space-y-3">
            <div
            className="flex items-center justify-between p-2 bg-gray-50 rounded"
            >
                <div>
                    <div className="font-medium">BRICS</div>
                    <div className="text-sm text-gray-500">BRICS Token</div>
                </div>
                <div className="text-right">
                    <div className="font-medium">
                    {balanceOfBRICS || 0.00} Tokens
                    </div>
                    <div className="text-sm text-green-600">Active</div>
                </div>
            </div>
        </div>
     <div className="space-y-3">
     <div className="flex items-center justify-between mb-4"></div>
     </div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">CBDC Vault</h2>
        <Building2 className="text-blue-600 w-6 h-6" />
      </div>
      {error && <div className="text-red-600 mb-4">{error}</div>}
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
              <div className="font-medium">
                {balances[cbdc.address]
                  ? balances[cbdc.address] === "Invalid Address"
                    ? "Invalid Address"
                    : `${balances[cbdc.address]} Tokens`
                  :  cbdc.status == 'Active' ?  ( "Loading..."  ): ("Disable" )
                  
                  }
              </div>
              {cbdc.status == 'Active' ?  (
              <div className="text-sm text-green-600">{cbdc.status}</div>
              ) : (
                <div className="text-sm text-red-600">{cbdc.status}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
