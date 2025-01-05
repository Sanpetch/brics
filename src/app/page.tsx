"use client"; // Ensure client-side rendering
import { useState, useEffect } from "react";
import { useWallet, WalletProvider } from "@/components/WalletContext"; // Import Wallet context
import Header from "@/components/BRICSInterface/Header";
import VaultStatus from "@/components/BRICSInterface/VaultStatus";


import CBDCPools from "@/components/BRICSInterface/CBDCPools";
import ExchangeModule from "@/components/BRICSInterface/ExchangeModule";
import Analytics from "@/components/BRICSInterface/Analytics";
import RiskManagement from "@/components/BRICSInterface/RiskManagement";

import CBDCVault from "@/components/BRICSInterface/CBDCVault";
import DepositModule from "@/components/BRICSInterface/DepositModule";
import RedeemModule from "@/components/BRICSInterface/RedeemModule";

import PoolModule from "@/components/BRICSInterface/PoolModule";
import PoolDepositModule from "@/components/BRICSInterface/PoolDepositModule";
import PoolSWAPModule from "@/components/BRICSInterface/PoolSWAPModule";
import PoolWithdrawModule from "@/components/BRICSInterface/PoolWithdrawModule";

function ConnectWalletSection() {
  const { accountData, connectToWallet } = useWallet();
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!initialized && !accountData) {
      connectToWallet().finally(() => setInitialized(true));
    }
  }, [initialized, accountData, connectToWallet]);


  return (
    <div className="p-6 bg-white shadow rounded mb-8">
      {!accountData ? (
        <button
          onClick={connectToWallet}
          className="px-6 py-3 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
        >
          Connect Wallet
        </button>
      ) : (
        <div>
          <h3 className="text-lg font-bold mb-4">Wallet Connected</h3>
          <p>
            <strong>Address:</strong> {accountData.address}
          </p>
          <p>
            <strong>Balance:</strong> {accountData.balance} ETH
          </p>
          <p>
            <strong>Network:</strong> {accountData.network}
          </p>
        </div>
      )}
    </div>
  );
}

export default function Home() {
  return (
    <WalletProvider>
      <div className="min-h-screen bg-gray-50 p-8">
        {
        /*
        <ConnectWalletSection />
        */
        }
        <Header />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <VaultStatus />


          <CBDCVault />
          <DepositModule />
          <RedeemModule />

          <PoolModule />
          <PoolDepositModule />
          <PoolSWAPModule />
          <PoolWithdrawModule />


          <Analytics />
          <RiskManagement />


        </div>
      </div>
    </WalletProvider>
  );
}
