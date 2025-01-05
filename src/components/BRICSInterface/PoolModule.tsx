"use client"; // Ensure client-side rendering
import { useState, useEffect } from "react";
import { useWallet } from "@/components/WalletContext";
import { ethers } from "ethers";
import { Building2 } from "lucide-react";
import { mockCBDCs } from "./mockData";

// ABI
import CNY_CBDC_ABI from "@/components/ABI/CNY_CBDC_Token.json";
import INR_CBDC_ABI from "@/components/ABI/INR_CBDC_Token.json";
import RUB_CBDC_ABI from "@/components/ABI/RUB_CBDC_Token.json";
import BRICS_ABI from "@/components/ABI/BRICS_Token.json";
import Vault_ABI from "@/components/ABI/Vault.json";
import POOL_TOKEN_ABI from "@/components/ABI/POOL_TokenRegis.json";
import POOL_FEE_ABI from "@/components/ABI/POOL_FeeManager.json";
import POOL_ABI from "@/components/ABI/POOL.json";

const POOL_ADDR    = process.env.NEXT_PUBLIC_POOL_ADDRESS;
const POOL_TOKENREGISTRY    = process.env.NEXT_PUBLIC_POOL_TOKENREGISTRY_ADDRESS;
const POOL_FEE    = process.env.NEXT_PUBLIC_POOL_FEE_ADDRESS;
const CNY_CBDC = process.env.NEXT_PUBLIC_CBDC_CNY_ADDRESS;
const INR_CBDC = process.env.NEXT_PUBLIC_CBDC_INR_ADDRESS;
const RUB_CBDC = process.env.NEXT_PUBLIC_CBDC_RUB_ADDRESS;
const BRICS    = process.env.NEXT_PUBLIC_BRICS_ADDRESS;

export default function PoolModule() {
    const { accountData, connectToWallet } = useWallet();
    const [initialized, setInitialized] = useState(false);
    const [pools, setPools] = useState([]); // Store pool data
    const [error, setError] = useState<string | null>(null);
  
    useEffect(() => {
      if (!initialized && !accountData) {
        connectToWallet().finally(() => setInitialized(true));
      }
    }, [initialized, accountData, connectToWallet]);
    
    const resolveProxy = (proxyData) => {
        return JSON.parse(JSON.stringify(proxyData));
    };
    
    const resolveProxyWithBigInt = (proxyData) => {
        const replacer = (_, value) =>
          typeof value === "bigint" ? value.toString() : value; // แปลง BigInt เป็น string
        return JSON.parse(JSON.stringify(proxyData, replacer));
    };

    const fetchPoolsAvailability = async () => {
        try {
          if (!window.ethereum) {
            throw new Error("No crypto wallet found");
          }
      
          const provider = new ethers.BrowserProvider(window.ethereum);
          const signer = await provider.getSigner();
          const poolContract = new ethers.Contract(POOL_ADDR, POOL_ABI, signer);
      
          // Call getAllPoolsAvailability
          const [poolNames, reserves0, reserves1, isAvailable] = await poolContract.getAllPoolsAvailability();
      
          console.log({
            poolNamesLength: poolNames.length,
            reserves0Length: reserves0.length,
            reserves1Length: reserves1.length,
            isAvailableLength: isAvailable.length,
          });
      
          // Align array lengths
          const minLength = Math.min(
            poolNames.length,
            reserves0.length,
            reserves1.length,
            isAvailable.length
          );
      
          const resolvedPoolNames = poolNames.slice(0, minLength);
          const resolvedReserves0 = reserves0.slice(0, minLength);
          const resolvedReserves1 = reserves1.slice(0, minLength);
          const resolvedIsAvailable = isAvailable.slice(0, minLength);
      
          const poolsData = [];
          //  continue;
          let name = "";
          for (let i = 0; i < 6; i++) {
            if(poolNames[i]== 'CNY' )
            {
              name = `${poolNames[i]}/${poolNames[1]}`;
              poolsData.push({
                name: name,
                reserve0: ethers.formatUnits(resolvedReserves0[0].toString(), 2),
                reserve1: ethers.formatUnits(resolvedReserves1[0].toString(), 2),
                isAvailable: resolvedIsAvailable[0],
              });
            }
            else if(poolNames[i]== 'RUB')
            {
              name = `${poolNames[i]}/${poolNames[3]}`;
              poolsData.push({
                name: name,
                reserve0: ethers.formatUnits(resolvedReserves0[1].toString(), 2),
                reserve1: ethers.formatUnits(resolvedReserves1[1].toString(), 2),
                isAvailable: resolvedIsAvailable[1],
              });
            }
            else if(poolNames[i]== 'INR')
            {
              name = `${poolNames[i]}/${poolNames[5]}`;
              poolsData.push({
                name: name,
                reserve0: ethers.formatUnits(resolvedReserves0[2].toString(), 2),
                reserve1: ethers.formatUnits(resolvedReserves1[2].toString(), 2),
                isAvailable: resolvedIsAvailable[2],
              });
            }
            
          }
      
          setPools(poolsData);
        } catch (err: any) {
          console.error("Error fetching pools availability:", err);
          setError(err.message || "Failed to fetch pools availability");
        }
      };
  
    useEffect(() => {
      if (accountData?.address) {
        fetchPoolsAvailability();
      }
    }, [accountData]);
  
    return (
      <div className="bg-white p-6 rounded-lg shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">All Pools Availability</h2>
          <Building2 className="text-blue-600 w-6 h-6" />
        </div>
  
        {error && <div className="text-red-600 mb-4">{error}</div>}
  
        <div className="space-y-3">
        {pools.map((pool, index) => (
            <div
            key={index}
            className={`flex items-center justify-between p-2 bg-gray-50 rounded ${
                pool.isAvailable ? "border-green-500" : "border-red-500"
            }`}
            >
            <div>
                <div className="font-medium">{pool.name}</div>
                <div className="text-sm text-gray-500">
                Reserves: {pool.reserve0} / {pool.reserve1}
                </div>
            </div>
            <div className="text-right">
                <div className={`text-sm ${pool.isAvailable ? "text-green-600" : "text-red-600"}`}>
                {pool.isAvailable ? "Available" : "Unavailable"}
                </div>
            </div>
            </div>
        ))}
        </div>
      </div>
    );
}
  