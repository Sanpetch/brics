"use client";

import { useState, useEffect } from "react";
import { useWallet } from "@/components/WalletContext";
import { ethers } from "ethers";

import { Wallet, ArrowDownUp, RefreshCw } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import Vault_ABI from "@/components/ABI/Vault.json";
import POOL_TOKEN_ABI from "@/components/ABI/POOL_TokenRegis.json";
import POOL_ABI from "@/components/ABI/POOL.json";
import POOL_FEE_ABI from "@/components/ABI/POOL_FeeManager.json";

interface Token {
  id: string;
  symbol: string;
  name: string;
  balance: string;
}

const vaultAddress = process.env.NEXT_PUBLIC_VAULT_CONTRACT_ADDRESS;
const CNY_CBDC = process.env.NEXT_PUBLIC_CBDC_CNY_ADDRESS;
const INR_CBDC = process.env.NEXT_PUBLIC_CBDC_INR_ADDRESS;
const RUB_CBDC = process.env.NEXT_PUBLIC_CBDC_RUB_ADDRESS;
const BRICS = process.env.NEXT_PUBLIC_BRICS_ADDRESS;
const POOL_ADDR = process.env.NEXT_PUBLIC_POOL_ADDRESS;
const TOKENREGISTRY = process.env.NEXT_PUBLIC_POOL_TOKENREGISTRY_ADDRESS;
const FEE = process.env.NEXT_PUBLIC_POOL_FEE_ADDRESS;

export default function PoolSWAPModule() {
  const [fromAmount, setFromAmount] = useState("");
  const [toAmount, setToAmount] = useState("");
  const [fromToken, setFromToken] = useState<string>("cny");
  const [toToken, setToToken] = useState<string>("brs");
  const [balances, setBalances] = useState<{ [key: string]: string }>({});
  const [exchangeRates, setExchangeRates] = useState<{ [key: string]: string }>({});
  const [loading, setLoading] = useState(false);
  const [exchangeRate, setExchangeRate] = useState(null);
  const [poolsInfo, setPoolsInfo] = useState(null);

  const [previewFees, setPreviewFees] = useState({
    totalFeeBrics: "0",
    protocolFeeBrics: "0",
    lpFeeBrics: "0",
    minAmountOut: "0"
  });
  // Function to get balance of a specific token
  const getBalance = async (tokenAddress: string) => {
    try {
      if (!window.ethereum) return "0.0";

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const userAddress = await signer.getAddress();

      //console.log("Getting balance for token:", tokenAddress, "user:", userAddress);

      const tokenContract = new ethers.Contract(
        tokenAddress,
        [
          "function balanceOf(address) view returns (uint256)",
          "function decimals() view returns (uint8)",
          "function symbol() view returns (string)"
        ],
        provider
      );

      const [balance, decimals, symbol] = await Promise.all([
        tokenContract.balanceOf(userAddress),
        tokenContract.decimals(),
        tokenContract.symbol()
      ]);

      //console.log("Raw balance:", balance.toString(), "decimals:", decimals);

      const formattedBalance = ethers.formatUnits(balance, decimals);
      // Format to match exact decimal places: .0 for tokens except BRICS which gets .04
      const decimalPlaces = symbol === "BRICS" ? 2 : 1;
      return Number(formattedBalance).toFixed(decimalPlaces);

    } catch (error) {
      console.error("Error getting balance:", error);
      return "0.0";
    }
  };

  // Function to fetch all balances
  const fetchBalances = async () => {
    try {
      if (!window.ethereum) return;

      const tokenAddresses: { [key: string]: string | undefined } = {
        cny: CNY_CBDC,
        rub: RUB_CBDC,
        inr: INR_CBDC,
        brs: BRICS
      };

      const newBalances: { [key: string]: string } = {};

      // Fetch balance for each token
      for (const [tokenId, address] of Object.entries(tokenAddresses)) {
        if (address) {
          const balance = await getBalance(address);
          //console.log(`Balance for ${tokenId}:`, balance);
          newBalances[tokenId] = balance;
        }
      }

      //console.log("All balances:", newBalances);
      setBalances(newBalances);

    } catch (error) {
      console.error("Error fetching balances:", error);
    }
  };

  const tokens: Token[] = [
    { id: "cny", symbol: "CNY", name: "Digital Yuan", balance: "1,000" },
    { id: "rub", symbol: "RUB", name: "Digital Ruble", balance: "800" },
    { id: "inr", symbol: "INR", name: "Digital Rupee", balance: "750" },
    { id: "brs", symbol: "BRICS", name: "BRICS Stablecoin", balance: "500" }
  ];

  const handleApprove = async (tokenAddress: string, amount: string) => {
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      const tokenContract = new ethers.Contract(
        tokenAddress,
        ["function approve(address spender, uint256 amount) returns (bool)"],
        signer
      );

      const amountToApprove = ethers.parseUnits(amount, 2);
      console.log("Approving amount:", amountToApprove.toString());

      const tx = await tokenContract.approve(POOL_ADDR, amountToApprove);
      console.log("Approval tx submitted:", tx.hash);

      await tx.wait();
      console.log("Approval confirmed");
      return true;
    } catch (error) {
      console.error("Approval failed:", error);
      return false;
    }
  };

  const handleSwap = async () => {
    if (!fromAmount || Number(fromAmount) <= 0) return;

    setLoading(true);
    try {
      // Get the token address to approve
      const tokenAddress = fromToken === "brs" ? BRICS! :
        fromToken === "cny" ? CNY_CBDC! :
          fromToken === "rub" ? RUB_CBDC! :
            fromToken === "inr" ? INR_CBDC! : "";

      // First approve the token spending
      //console.log("Approving token:", tokenAddress);
      const approved = await handleApprove(tokenAddress, fromAmount);
      if (!approved) {
        throw new Error("Token approval failed");
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const poolContract = new ethers.Contract(POOL_ADDR!, POOL_ABI, signer);

      // Convert token symbols for contract
      const fromTokenSymbol = fromToken === "brs" ? "BRICS" : fromToken.toUpperCase();
      const toTokenSymbol = toToken === "brs" ? "BRICS" : toToken.toUpperCase();

      // Convert amount to contract format
      const amountIn = ethers.parseUnits(fromAmount, 2);

      // Get min amount out from preview
      const preview = await poolContract.previewSwap(fromTokenSymbol, toTokenSymbol, amountIn);
      const minAmountOut = preview.suggestedMinAmountOut;

      console.log("Swapping:", {
        fromToken: fromTokenSymbol,
        toToken: toTokenSymbol,
        amountIn: amountIn.toString(),
        minAmountOut: minAmountOut.toString()
      });

      // Execute swap
      const tx = await poolContract.swap(
        fromTokenSymbol,
        toTokenSymbol,
        amountIn,
        minAmountOut
      );

      await tx.wait();

      // Reset form
      setFromAmount("");
      setToAmount("");

    } catch (error) {
      console.error('Swap failed:', error);
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    const getPoolsInfo = async () => {
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const poolContract = new ethers.Contract(POOL_ADDR!, POOL_ABI, provider);
        const info = await poolContract.getAllPoolsAvailability();
        console.log("Pool info : ", info)
        setPoolsInfo(info);
      } catch (error) {
        console.error("Error fetching pools info:", error);
      }
    };
    getPoolsInfo();
  }, [fromToken, toToken]);

  useEffect(() => {
    const getPreview = async () => {
      if (!fromAmount || !window.ethereum || Number(fromAmount) <= 0) {
        setPreviewFees({
          totalFeeBrics: "0",
          protocolFeeBrics: "0",
          lpFeeBrics: "0",
          minAmountOut: "0"
        });
        return;
      }

      try {
        const fromTokenSymbol = fromToken === "brs" ? "BRICS" : fromToken.toUpperCase();
        const toTokenSymbol = toToken === "brs" ? "BRICS" : toToken.toUpperCase();

        const provider = new ethers.BrowserProvider(window.ethereum);
        const poolContract = new ethers.Contract(POOL_ADDR!, POOL_ABI, provider);

        // Minimum amount check to prevent overflow
        if (Number(fromAmount) < 10) {  // Changed minimum to 10
          setPreviewFees({
            totalFeeBrics: "0",
            protocolFeeBrics: "0",
            lpFeeBrics: "0",
            minAmountOut: "0"
          });
          return;
        }

        const amountIn = ethers.parseUnits(fromAmount, 2);


        const preview = await poolContract.previewSwap(
          fromTokenSymbol,
          toTokenSymbol,
          amountIn
        );

        if (preview && preview.totalFeeBrics) {
          setPreviewFees({
            totalFeeBrics: ethers.formatUnits(preview.totalFeeBrics, 2),
            protocolFeeBrics: ethers.formatUnits(preview.protocolFeeBrics, 2),
            lpFeeBrics: ethers.formatUnits(preview.lpFeeBrics, 2),
            minAmountOut: Number(ethers.formatUnits(preview.suggestedMinAmountOut, 2)).toFixed(2)
          });
          
        }
      } catch (error) {
        console.log("Preview calculation failed for amount:", fromAmount);
        setPreviewFees({
          totalFeeBrics: "0",
          protocolFeeBrics: "0",
          lpFeeBrics: "0",
          minAmountOut: "0"
        });
      }
    };

    getPreview();
  }, [fromAmount, fromToken, toToken]);

  // Initial load and wallet change handler
  useEffect(() => {
    fetchBalances();

    if (window.ethereum) {
      window.ethereum.on('accountsChanged', fetchBalances);
      return () => {
        window.ethereum.removeListener('accountsChanged', fetchBalances);
      };
    }
  }, []);

  // Refresh balances when tokens change
  useEffect(() => {
    fetchBalances();
  }, [fromToken, toToken]);

  // Fetch exchange rate when currency changes


  useEffect(() => {
    const getRate = async () => {
      try {
        if (!window.ethereum || !fromToken || !toToken) return;

        const provider = new ethers.BrowserProvider(window.ethereum);
        const poolContract = new ethers.Contract(POOL_ADDR!, POOL_ABI, provider);

        const fromSymbol = fromToken === "brs" ? "BRICS" : fromToken.toUpperCase();
        const toSymbol = toToken === "brs" ? "BRICS" : toToken.toUpperCase();
        const rate = await poolContract.getExchangeRate(fromSymbol, toSymbol);

        // Contract uses 4 decimals (10000 = 1.0000)
        const formattedRate = Number(rate) / 10000;


        setExchangeRates({ [`${fromToken}-${toToken}`]: formattedRate.toFixed(4) });
        
        if (fromAmount) {
          const newToAmount = (Number(fromAmount) * formattedRate).toFixed(2);
          setToAmount(newToAmount);
        }
      } catch (error) {
        console.error('Error getting rate:', error);
      }
    };

    getRate();
  }, [fromAmount, fromToken, toToken]);

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Pool SWAP</h2>
        <Wallet className="text-blue-600 w-6 h-6" />
      </div>
      <div className="space-y-6">

        {/* From Token Selection */}
        <div className="p-4 bg-gray-50 rounded-lg">
          <label className="block text-sm text-gray-600 mb-2">From</label>
          <div className="flex gap-4">
            <select
              className="w-1/3 bg-white border rounded-lg p-2"
              value={fromToken}
              onChange={(e) => {
                setFromToken(e.target.value);
                if (e.target.value === "brs") {
                  setToToken("cny");
                } else {
                  setToToken("brs");
                }
              }}
            >
              <option value="brs">BRICS</option>
              <option value="cny">CNY</option>
              <option value="rub">RUB</option>
              <option value="inr">INR</option>
            </select>

            <div className="relative w-2/3">
              <input
                type="number"
                value={fromAmount}
                onChange={(e) => setFromAmount(e.target.value)}
                className="w-full border rounded-lg p-2"
                placeholder="0.0"
                step="0.01"
                min="0"
              />
              <button
                className="absolute right-2 top-1/2 -translate-y-1/2 text-blue-600 text-sm px-2 py-1 rounded hover:bg-blue-50"
                onClick={() => setFromAmount(balances[fromToken] || "0")}
              >
                MAX
              </button>
            </div>
          </div>
          <div className="text-sm text-gray-500 mt-2">
            Your balance: {Number(balances[fromToken] || "0").toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2
            })} {tokens.find(t => t.id === fromToken)?.symbol}
          </div>
        </div>

        {/* Swap Direction Toggle */}
        <div className="flex justify-center">
          <button
            className="p-2 hover:bg-gray-100 rounded-full"
            onClick={() => {
              const temp = fromToken;
              setFromToken(toToken);
              setToToken(temp);
              setFromAmount("");
              setToAmount("");
            }}
          >
            <ArrowDownUp className="w-5 h-5" />
          </button>
        </div>

        {/* To Token Selection */}
        <div className="p-4 bg-gray-50 rounded-lg">
          <label className="block text-sm text-gray-600 mb-2">To</label>
          <div className="flex gap-4">
            <select
              className="w-1/3 bg-white border rounded-lg p-2"
              value={toToken}
              onChange={(e) => setToToken(e.target.value)}
              disabled={fromToken !== "brs"}
            >
              {fromToken === "brs" ? (
                <>
                  <option value="cny">CNY</option>
                  <option value="rub">RUB</option>
                  <option value="inr">INR</option>
                </>
              ) : (
                <option value="brs">BRICS</option>
              )}
            </select>
            <input
              type="number"
              value={toAmount}
              className="w-2/3 border rounded-lg p-2 bg-gray-50"
              placeholder="0.0"
              readOnly
              step="0.01"
              min="0"
            />
          </div>
          {/* Display actual balance from contract */}
          <div className="text-sm text-gray-500 mt-2">
            Your balance: {Number(balances[toToken] || "0").toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2
            })} {tokens.find(t => t.id === toToken)?.symbol}
          </div>
        </div>

        {/* Exchange Info */}
        <div className="flex justify-between text-sm text-gray-600 p-2">
          <span>Exchange Rate</span>
          <div className="flex items-center gap-1">
            <span>1 {tokens.find(t => t.id === fromToken)?.symbol} = {exchangeRates[`${fromToken}-${toToken}`] || "1"} {tokens.find(t => t.id === toToken)?.symbol}</span>
            <RefreshCw
              className="w-4 h-4 cursor-pointer"
              onClick={() => getRate()}
            />
          </div>
        </div>

        {/* Warning for exceeding pool reserves */}
        {poolsInfo && poolsInfo[1] && poolsInfo[2] && fromAmount && (
          (fromToken === "brs" ? (
            // When BRICS is fromToken
            (toToken === "cny" && Number(fromAmount) > Number(ethers.formatUnits(poolsInfo[2][0], 2))) ||
            (toToken === "rub" && Number(fromAmount) > Number(ethers.formatUnits(poolsInfo[2][1], 2))) ||
            (toToken === "inr" && Number(fromAmount) > Number(ethers.formatUnits(poolsInfo[2][2], 2)))
          ) : (
            // When BRICS is toToken
            (fromToken === "cny" && Number(fromAmount) > Number(ethers.formatUnits(poolsInfo[1][0], 2))) ||
            (fromToken === "rub" && Number(fromAmount) > Number(ethers.formatUnits(poolsInfo[1][1], 2))) ||
            (fromToken === "inr" && Number(fromAmount) > Number(ethers.formatUnits(poolsInfo[1][2], 2)))
          ))
        ) && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 8V12M12 16H12.01M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <div>
                  <h3 className="font-semibold">Insufficient Pool Reserves</h3>
                  <p className="text-sm">Amount exceeds available liquidity in the pool</p>
                </div>
              </div>
            </div>
          )}
        {/* Validation Warnings */}
        {poolsInfo && poolsInfo[1] && poolsInfo[2] && toAmount && (
          (fromToken === "brs" ? (
            // When BRICS is fromToken (token0)
            (toToken === "cny" && (
              poolsInfo[1][0] <= ethers.parseUnits("1000", 2) ||
              (Number(toAmount) > 0 && poolsInfo[1][0] - ethers.parseUnits(toAmount, 2) <= ethers.parseUnits("1000", 2))
            )) ||
            (toToken === "rub" && (
              poolsInfo[1][1] <= ethers.parseUnits("1000", 2) ||
              (Number(toAmount) > 0 && poolsInfo[1][1] - ethers.parseUnits(toAmount, 2) <= ethers.parseUnits("1000", 2))
            )) ||
            (toToken === "inr" && (
              poolsInfo[1][2] <= ethers.parseUnits("1000", 2) ||
              (Number(toAmount) > 0 && poolsInfo[1][2] - ethers.parseUnits(toAmount, 2) <= ethers.parseUnits("1000", 2))
            ))
          ) : (
            // When BRICS is toToken (token1)
            (fromToken === "cny" && (
              poolsInfo[2][0] <= ethers.parseUnits("1000", 2) ||
              (Number(toAmount) > 0 && poolsInfo[2][0] - ethers.parseUnits(toAmount, 2) <= ethers.parseUnits("1000", 2))
            )) ||
            (fromToken === "rub" && (
              poolsInfo[2][1] <= ethers.parseUnits("1000", 2) ||
              (Number(toAmount) > 0 && poolsInfo[2][1] - ethers.parseUnits(toAmount, 2) <= ethers.parseUnits("1000", 2))
            )) ||
            (fromToken === "inr" && (
              poolsInfo[2][2] <= ethers.parseUnits("1000", 2) ||
              (Number(toAmount) > 0 && poolsInfo[2][2] - ethers.parseUnits(toAmount, 2) <= ethers.parseUnits("1000", 2))
            ))
          )
          )) && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 8V12M12 16H12.01M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <div>
                  <h3 className="font-semibold">Pool Reserves Too Low</h3>
                  <p className="text-sm">Pool reserves must remain above 1000 after swapping</p>
                </div>
              </div>
            </div>
          )}


        <div className="space-y-2 text-sm text-gray-600">
          <div className="flex justify-between">
            <span>Total Fee:</span>
            <span>{previewFees.totalFeeBrics} BRICS</span>
          </div>
          <div className="flex justify-between">
            <span>Protocol Fee:</span>
            <span>{previewFees.protocolFeeBrics} BRICS</span>
          </div>
          <div className="flex justify-between">
            <span>LP Fee:</span>
            <span>{previewFees.lpFeeBrics} BRICS</span>
          </div>
          <div className="flex justify-between">
            <span>Minimum amount:</span>
            <span>{previewFees.minAmountOut} {tokens.find(t => t.id === toToken)?.symbol}</span>
          </div>
        </div>

        <button
          className="w-full bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
          disabled={Boolean(
            !fromAmount ||
            Number(fromAmount) <= 0 ||
            loading ||
            Number(fromAmount) > Number(balances[fromToken]) ||
            (poolsInfo && (
              fromToken === "brs" ? (
                (toToken === "cny" && Number(fromAmount) > Number(ethers.formatUnits(poolsInfo[2][0], 2))) ||
                (toToken === "rub" && Number(fromAmount) > Number(ethers.formatUnits(poolsInfo[2][1], 2))) ||
                (toToken === "inr" && Number(fromAmount) > Number(ethers.formatUnits(poolsInfo[2][2], 2)))
              ) : (
                (fromToken === "cny" && Number(fromAmount) > Number(ethers.formatUnits(poolsInfo[1][0], 2))) ||
                (fromToken === "rub" && Number(fromAmount) > Number(ethers.formatUnits(poolsInfo[1][1], 2))) ||
                (fromToken === "inr" && Number(fromAmount) > Number(ethers.formatUnits(poolsInfo[1][2], 2)))
              )
            ))
          )}
          onClick={handleSwap}
        >
          {loading ? 'Swapping...' : 'Swap'}
        </button>
      </div>
    </div>
  );
} 