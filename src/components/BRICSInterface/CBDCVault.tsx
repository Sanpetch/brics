"use client"; // Ensure client-side rendering
import { useState, useEffect } from "react";
import { useWallet } from "@/components/WalletContext";
import { ethers } from "ethers";
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
// ABI
import CNY_CBDC_ABI from "@/components/ABI/CNY_CBDC_Token.json";
import INR_CBDC_ABI from "@/components/ABI/INR_CBDC_Token.json";
import RUB_CBDC_ABI from "@/components/ABI/RUB_CBDC_Token.json";
import BRICS_ABI from "@/components/ABI/BRICS_Token.json";
import Vault_ABI from "@/components/ABI/Vault.json";

import { Building2 } from "lucide-react";
import { mockCBDCs } from "./mockData";

const vaultAddress    = process.env.NEXT_PUBLIC_VAULT_CONTRACT_ADDRESS;
const CNY_CBDC = process.env.NEXT_PUBLIC_CBDC_CNY_ADDRESS;
const INR_CBDC = process.env.NEXT_PUBLIC_CBDC_INR_ADDRESS;
const RUB_CBDC = process.env.NEXT_PUBLIC_CBDC_RUB_ADDRESS;
const BRICS    = process.env.NEXT_PUBLIC_BRICS_ADDRESS;

const currencies = [
  { id: "CNY", name: "CNY_CBDC", label: "Digital Yuan", address:CNY_CBDC },
  { id: "RUB", name: "RUB_CBDC", label: "Digital Ruble", address:RUB_CBDC },
  { id: "INR", name: "INR_CBDC", label: "Digital Rupee", address:INR_CBDC },
  //{ id: "brl", name: "Digital Real", label: "Digital Real" },
  //{ id: "zar", name: "Digital Rand", label: "Digital Rand" },
  //{ id: "brs", name: "BRICS", label: "BRICS Stablecoin" }
];

/*
const exchangeRates = {
  cny: 3.84,   // 1 CNY ≈ 3.84 BRICS
  rub: 0.265,  // 1 RUB ≈ 0.265 BRICS
  inr: 0.331   // 1 INR ≈ 0.331 BRICS
};
*/

export default function CBDCPools() {
  const { accountData, connectToWallet } = useWallet();
  const [initialized, setInitialized] = useState(false);
  const [balances, setBalances] = useState<{ [address: string]: string }>({}); // Store balances
  const [error, setError] = useState<string | null>(null);
  const [balanceOfBRICS, setbalanceOfBRICS] = useState(false);
  const [mintedOfBRICSbyUser, setMintedOfBRICSbyUser] = useState(false);
  const [statusMessages, setStatusMessages] = useState([]);
  const [collateralRatio, setCollateralRatio] = useState(120);
  const [exchangeDetails, setExchangeDetails] = useState([]);
  const [baseRate, setBaseRate] = useState(null); // อัตราแลกเปลี่ยน 1 BRICS = ? CNY

  const fetchBalances = async () => {
    try {
      if (!window.ethereum) {
        throw new Error("No crypto wallet found");
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      const vaultContract = new ethers.Contract(vaultAddress, Vault_ABI, signer);

      const contract_CNY = new ethers.Contract(CNY_CBDC, CNY_CBDC_ABI, signer);
      const contract_INR = new ethers.Contract(INR_CBDC, INR_CBDC_ABI, signer);
      const contract_RUB = new ethers.Contract(RUB_CBDC, RUB_CBDC_ABI, signer);
      const contract_BRICS = new ethers.Contract(BRICS, BRICS_ABI, signer);


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

      const rawMintedOfBRICSbyUser = await vaultContract.userMintedBRICS(accountData?.address);
      const formattedMintedOfBRICSbyUser = ethers.formatUnits(rawMintedOfBRICSbyUser, decimalsBRICS);
      const balanceMintedBIRCS = new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(Number(formattedMintedOfBRICSbyUser));
      setMintedOfBRICSbyUser(balanceMintedBIRCS);

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

  const fetchCR= async () => {
    try {
      if (!window.ethereum) {
        throw new Error("No crypto wallet found");
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
     
      const vaultContract = new ethers.Contract(vaultAddress, Vault_ABI, signer);
      const CR = await vaultContract.getCollateralRatio();

      setCollateralRatio(CR);
      
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

      // ดึงค่าอัตราแลกเปลี่ยน 1 BRICS = ? CNY
      const baseRateBigInt = await vaultContract.getExchangeRate(currencies[0].id);
      const baseRateFormatted = Number(baseRateBigInt) / 100; // แปลงจาก BigInt และปรับทศนิยม

      setBaseRate(baseRateFormatted);

      // ดึงอัตราแลกเปลี่ยนสำหรับสกุลเงินอื่น ๆ และคำนวณอัตราแลกเปลี่ยนเทียบกับ BRICS
      const details = [];
      for (const currency of currencies) {
        const rateBigInt = await vaultContract.getExchangeRate(currency.id);
        const rateFormatted = Number(rateBigInt) / 100;

        const bricsToCurrency = (baseRateFormatted / rateFormatted); // คำนวณอัตราแลกเปลี่ยน 1 BRICS = ? สกุลเงินอื่น

        details.push({
          label: currency.label,
          id: currency.id,
          rate: rateFormatted,
          bricsToCurrency
        });
      }
      setExchangeDetails(details);
      
    } catch (err: any) {
      console.error("Error fetching balances:", err);
      setError(err.message || "Failed to fetch balances");
    }
  };

  const handlePreviewLiquidate = async () => {
    try {
      if (!window.ethereum) {
        throw new Error("No crypto wallet found");
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const vaultContract = new ethers.Contract(vaultAddress, Vault_ABI, signer);

      const previewMessages = [];

      for (const currency of currencies) {
        const result = await vaultContract.previewLiquidate(accountData?.address, currency.id);
        if(result)
        {
          /*
          const bricsMintedBigInt = result[0];
          const actualCollateralValueBigInt = result[1];
          const requiredCollateralValueBigInt = result[2];
          const deficitCollateralValueBigInt = result[3];
          const tokensToLiquidateBigInt = result[4];

          const bricsMinted = Number(bricsMintedBigInt);
          const actualCollateralValue = Number(actualCollateralValueBigInt);
          const requiredCollateralValue = Number(requiredCollateralValueBigInt);
          const deficitCollateralValue = Number(deficitCollateralValueBigInt);
          const tokensToLiquidate = Number(tokensToLiquidateBigInt);
          */
          const tokensToLiquidate = Number(result[4]);
          console.log(tokensToLiquidate);
          if (tokensToLiquidate > 0) {
            previewMessages.push({
              symbol: currency.id,
              status: "Warning",
              message: `You need to liquidate ${tokensToLiquidate/100} ${currency.label} tokens due to insufficient collateral.`,
              currency
            });
          } else {
            previewMessages.push({
              symbol: currency.id,
              status: "OK",
              message: `${currency.label} is maintaining optimal ratios.`,
            });
          }
        }

        setStatusMessages(previewMessages);
      }

      } catch (error) {
        //console.error("Error previewing liquidation:", error);
        //alert("Failed to preview liquidation. Please try again.");
      }
  };

  const handleLiquidate = async (currency) => {
    try {
      if (!window.ethereum) {
        throw new Error("No crypto wallet found");
      }
  
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const vaultContract = new ethers.Contract(vaultAddress, Vault_ABI, signer);
      
      console.log(currency.id);
      console.log(accountData?.address);
      // Call liquidate function
      const tx = await vaultContract.liquidate(accountData?.address, currency.id);
      await tx.wait(); // Wait for transaction confirmation
  
      alert(`Successfully liquidated ${currency.label} tokens.`);

      window.location.reload();
    } catch (error) {
      console.error("Error during liquidation:", error);
      alert("Failed to perform liquidation. Please try again.");
    }
  };


  const checkSystemStatus = async () => {
    try {
      if (!window.ethereum) {
        throw new Error("No crypto wallet found");
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const vaultContract = new ethers.Contract(vaultAddress, Vault_ABI, signer);
      
      const messages = [];
      const collateralRatioBigInt = Number(collateralRatio); // แปลง CR เป็น BigInt
     
      for (const currency of currencies) {
        const exchangeRateBigInt = await vaultContract.getExchangeRate(currency.id);
        const exchangeRate = Number(exchangeRateBigInt) / 100; // แปลง BigInt เป็น number
        console.log(exchangeRate);
        // Convert the exchange rate to a percentage for easier comparison
        const effectiveRatio = (100 * exchangeRate) / collateralRatioBigInt;
        //console.log("effectiveRatio: " + effectiveRatio);
        
        if (effectiveRatio < 100) {
          messages.push({
            symbol: currency.symbol,
            status: "Warning",
            message: `${currency.label}(${currency.id}) is below the required Collateral Ratio (CR).`
          });
        } else {
          messages.push({
            symbol: currency.symbol,
            status: "OK",
            message: `${currency.label}(${currency.id}) is maintaining optimal ratios.`
          });
        }
      }

      setStatusMessages(messages);
    } catch (error) {
      console.error("Error checking system status:", error);
      alert("Failed to fetch system status. Please try again.");
    }
  };


  useEffect(() => {
    if (accountData?.address) {
      fetchBalances();
      handlePreviewLiquidate();
    }
    fetchCR();
  }, [accountData]);

  useEffect(() => {
    if (!initialized) {
      setCollateralRatio(120);
      fetchEexchangeRates();
      setInitialized(true);
    }
  }, [initialized]);


  return (
    <div className="bg-white p-6 rounded-lg shadow-sm">
        <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">BRICS Token</h2>
            <Building2 className="text-blue-600 w-6 h-6" />
        </div>
        <div className="space-y-3">
            <div
            className="flex items-center justify-between p-2 bg-gray-50 rounded"
            >
                <div>
                    <div className="text-sm text-gray-500 font-medium">Wallet</div>
                    <div className="text-sm text-gray-500 font-medium">Vault</div>
                </div>
                <div className="text-right">
                    <div className="text-right">
                      <div className="text-sm font-medium">
                      {balanceOfBRICS || 0.00} Tokens
                      </div>
                      <div className="text-sm font-medium">
                      {mintedOfBRICSbyUser || 0.00} Tokens
                      </div>
                    </div>
                </div>
            </div>
        </div>
        
        <div className="space-y-3">
          <div className="flex items-center justify-between mb-4"></div>
        </div>

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">CBDC Vault by user</h2>
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
        <div className="space-y-3">
          <div className="flex items-center justify-between mb-4"></div>
        </div>
        {statusMessages.length > 0 && (
         <div className="flex items-center justify-between mb-4">
          <div className="w-full space-y-3">
            {statusMessages.map((status, index) => (
              <Alert
                key={index}
                className={
                  status.status === "Warning"
                    ? "bg-red-50 text-red-800"
                    : "bg-blue-50 text-blue-800"
                }
              >
                <AlertTitle>{status.status === "Warning" ? "Warning" : ""}</AlertTitle>
                <AlertDescription>{status.message}</AlertDescription>
                {status.status === "Warning" && (
                  <button
                    className="w-full bg-red-600 text-white rounded-lg p-3 hover:bg-red-700 transition-colors mt-2"
                    onClick={() => handleLiquidate(status.currency)} // ส่ง currency เข้าไปในฟังก์ชัน
                  >
                    Force Liquidation
                  </button>
                )}
                </Alert>
            ))}


      
          </div>

        </div>
        )}  
       

    
        <div className="pt-4">
          <button
            className="w-full bg-blue-600 text-white rounded-lg p-3 hover:bg-blue-700 transition-colors"
            onClick={handlePreviewLiquidate}
          >
            Check Status
        </button>
      </div>
    </div>
  );
}
