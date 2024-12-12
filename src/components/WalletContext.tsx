"use client"; // Make sure this is here

import React, { createContext, useState, useContext, useCallback, ReactNode } from "react";
import { ethers } from "ethers";

// Define the structure of the account data
interface AccountData {
  address: string;
  balance: string;
  chainId: string;
  network: string;
}

// Define the structure of the WalletContext value
interface WalletContextValue {
  accountData: AccountData | null; // Account data or null if not connected
  connectToWallet: () => Promise<void>; // Function to connect to the wallet
}

// Create the WalletContext with undefined as the initial value
const WalletContext = createContext<WalletContextValue | undefined>(undefined);

// Define the props for the WalletProvider component
interface WalletProviderProps {
  children: ReactNode;
}

// WalletProvider component
export const WalletProvider: React.FC<WalletProviderProps> = ({ children }) => {
  const [accountData, setAccountData] = useState<AccountData | null>(null);

  const connectToWallet = useCallback(async () => {
    const ethereum = (window as any).ethereum; // MetaMask's Ethereum object
    if (typeof ethereum !== "undefined") {
      try {
        const accounts = await ethereum.request({ method: "eth_requestAccounts" });
        const address = accounts[0];
        const provider = new ethers.BrowserProvider(ethereum);
        const balance = await provider.getBalance(address);
        const network = await provider.getNetwork();

        setAccountData({
          address,
          balance: ethers.formatEther(balance),
          chainId: network.chainId.toString(),
          network: network.name || "Unknown", // Handle cases where network name is undefined
        });
      } catch (error: any) {
        alert(`Error connecting to MetaMask: ${error.message || error}`);
      }
    } else {
      alert("MetaMask not installed");
    }
  }, []);

  return (
    <WalletContext.Provider value={{ accountData, connectToWallet }}>
      {children}
    </WalletContext.Provider>
  );
};

// Hook to use the WalletContext
export const useWallet = (): WalletContextValue => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return context;
};
