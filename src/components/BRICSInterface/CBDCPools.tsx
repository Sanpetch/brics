"use client"; // Ensure client-side rendering
import { useState, useEffect } from "react";
import { useWallet } from "@/components/WalletContext";
import { ethers } from "ethers";

// ABI
import CNY_CBDC_ABI from "@/components/ABI/CNY_CBDC_Token.json";

import { Building2 } from "lucide-react";
import { mockCBDCs } from "./mockData";

const CNY_CBDC = process.env.NEXT_PUBLIC_CBDC_CNY_ADDRESS;

export default function CBDCPools() {
  const { accountData, connectToWallet } = useWallet();
  const [initialized, setInitialized] = useState(false);
  const [balances, setBalances] = useState<{ [address: string]: string }>({}); // Store balances
  const [error, setError] = useState<string | null>(null);

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

      const rawBalance = await contract_CNY.balanceOf(accountData?.address);
      const decimals = await contract_CNY.decimals();
      const formattedBalance = ethers.formatUnits(rawBalance, decimals);

      const balances: { [address: string]: string } = {};
      balances[CNY_CBDC] = new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(Number(formattedBalance));

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
        <h2 className="text-xl font-semibold">National CBDC Pools</h2>
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
                  : "Loading..."}
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
