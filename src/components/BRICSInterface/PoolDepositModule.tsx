"use client"

import React, { useState, useEffect } from 'react';
import { ethers } from "ethers";
import { useWallet } from "@/components/WalletContext";
import POOL_ABI from "@/components/ABI/POOL.json";
import POOL_FEE_ABI from "@/components/ABI/POOL_FeeManager.json";
import CNY_CBDC_ABI from "@/components/ABI/CNY_CBDC_Token.json";
import INR_CBDC_ABI from "@/components/ABI/INR_CBDC_Token.json";
import RUB_CBDC_ABI from "@/components/ABI/RUB_CBDC_Token.json";
import BRICS_ABI from "@/components/ABI/BRICS_Token.json";

const POOL_ADDR = process.env.NEXT_PUBLIC_POOL_ADDRESS;
const POOL_FEE_ADDR = process.env.NEXT_PUBLIC_POOL_FEE_ADDRESS;
const BRICS = process.env.NEXT_PUBLIC_BRICS_ADDRESS;
const CNY_CBDC = process.env.NEXT_PUBLIC_CBDC_CNY_ADDRESS;
const INR_CBDC = process.env.NEXT_PUBLIC_CBDC_INR_ADDRESS;
const RUB_CBDC = process.env.NEXT_PUBLIC_CBDC_RUB_ADDRESS;

const currencies = [
  { id: "cny", symbol: "CNY", name: "Digital Yuan", balance: "1,000" },
  { id: "rub", symbol: "RUB", name: "Digital Ruble", balance: "800" },
  { id: "inr", symbol: "INR", name: "Digital Rupee", balance: "750" },
];

const toCurrencies = [
  { id: "brs", symbol: "BRICS", name: "BRICS Stablecoin", balance: "500" }

];

export default function PoolDeposit() {
  const { accountData, connectToWallet } = useWallet();
  const [initialized, setInitialized] = useState(false);
  const [fromCurrency, setFromCurrency] = useState(currencies[0].id);
  const [toCurrency, setToCurrency] = useState(toCurrencies[0].id);
  const [amount0, setAmount0] = useState("");
  const [amount1, setAmount1] = useState("");
  const [exchangeRate, setExchangeRate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [balances, setBalances] = useState<{ [key: string]: string }>({});




  useEffect(() => {
    if (!initialized && !accountData) {
      connectToWallet().finally(() => setInitialized(true));
    }
  }, [initialized, accountData, connectToWallet]);

  // Fetch exchange rate when currency changes
  useEffect(() => {
    const fetchExchangeRate = async () => {
      if (!window.ethereum) return;

      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const poolContract = new ethers.Contract(POOL_ADDR, POOL_ABI, provider);

        const rate = await poolContract.getExchangeRate(
          fromCurrency.toUpperCase(),
          "BRICS"
        );





        setExchangeRate(rate);
      } catch (err) {
        console.error("Error fetching exchange rate:", err);
        setError("Failed to fetch exchange rate");
      }
    };

    fetchExchangeRate();
  }, [fromCurrency]);



  // Update amount1 when amount0 or exchange rate changes
  useEffect(() => {
    if (amount0 && exchangeRate) {
      try {
        const convertedAmount = parseFloat(amount0) * parseFloat(exchangeRate) / 10000;
        setAmount1(convertedAmount.toFixed(4));
      } catch (err) {
        console.error("Error converting amount:", err);
      }
    }
  }, [amount0, exchangeRate]);

  const handleAmount0Change = (e) => {
    const value = e.target.value;
    setAmount0(value);
  };

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
  }, [fromCurrency, toCurrency]);

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

  const handleAddLiquidity = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (!window.ethereum) {
        throw new Error("No crypto wallet found");
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      // Initialize the pool contract
      const poolContract = new ethers.Contract(POOL_ADDR, POOL_ABI, signer);

      const selectedCurrency = currencies.find((c) => c.id === fromCurrency);
      if (!selectedCurrency) {
        alert("Invalid currency selected.");
        return;
      }

      const amountInWei = ethers.parseUnits(amount0, 2);; // 2 decimals for the example
      const amountInWei1 = ethers.parseUnits(amount1, 2);; // 2 decimals for the example


      // Check allowance for token1


      // approve
      if (selectedCurrency.id == 'cny') {
        const contract_CNY = new ethers.Contract(CNY_CBDC, CNY_CBDC_ABI, signer);
        const checkname = await contract_CNY.totalSupply();
        //console.log(checkname);

        // เรียก approve ให้ Vault ใช้งานจำนวนโทเค็น
        const approveTx = await contract_CNY.approve(POOL_ADDR, amountInWei);
        await approveTx.wait();

        // Check allowance for token0
        const allowanceToken0 = await contract_CNY.allowance(
          accountData.address,
          POOL_ADDR
        );
        console.log("Allowance for token0:", allowanceToken0.toString());
      }
      else if (selectedCurrency.id == 'rub') {
        const contract_RUB = new ethers.Contract(RUB_CBDC, RUB_CBDC_ABI, signer);
        const checkname = await contract_RUB.totalSupply();
        //console.log(checkname);

        // เรียก approve ให้ Vault ใช้งานจำนวนโทเค็น
        const approveTx = await contract_RUB.approve(POOL_ADDR, amountInWei);
        await approveTx.wait();


        // Check allowance for token0
        const allowanceToken0 = await contract_RUB.allowance(
          accountData.address,
          POOL_ADDR
        );
        console.log("Allowance for token0:", allowanceToken0.toString());

      }
      else if (selectedCurrency.id == 'inr') {
        const contract_INR = new ethers.Contract(INR_CBDC, INR_CBDC_ABI, signer);
        const checkname = await contract_INR.totalSupply();
        //console.log(checkname);

        // เรียก approve ให้ Vault ใช้งานจำนวนโทเค็น
        const approveTx = await contract_INR.approve(POOL_ADDR, amountInWei);
        await approveTx.wait();


        // Check allowance for token0
        const allowanceToken0 = await contract_INR.allowance(
          accountData.address,
          POOL_ADDR
        );
        console.log("Allowance for token0:", allowanceToken0.toString());
      }

      // BRICS TOKEN; approve Pool address;
      const contract_BRICS = new ethers.Contract(BRICS, BRICS_ABI, signer);
      const checkname = await contract_BRICS.totalSupply();
      //console.log(checkname);
      // Get pool reserves to determine fee type
      const poolKey = await poolContract.getPoolKeybySymbol(
        fromCurrency.toUpperCase(),
        "BRICS"
      );
      const pool = await poolContract.pools(poolKey);


      // Calculate BRICS fee based on exchange rate and pool reserves
      const baseFee = (Number(exchangeRate) * 2000 / 1000000); // 2000 basis points = base fee
      const lowFee = (Number(exchangeRate) * 1000 / 1000000);  // 1000 basis points = low fee


      // Use low fee if either reserve is below minimumLiquidity
      const isLowFee = pool.reserve0 < 1000 || pool.reserve1 < 1000;
      const bricsFee = ethers.parseUnits(
        (isLowFee ? lowFee : baseFee).toFixed(2),
        2
      );
      console.log("Deposit Fee:", bricsFee);
      console.log("Deposit Fee (BRICS):", bricsFee.toString());


      // Approve total amount including fee
      const totalBricsAmount = amountInWei1 + bricsFee;
      // เรียก approve ให้ Vault ใช้งานจำนวนโทเค็น
      const approveTx = await contract_BRICS.approve(POOL_ADDR, totalBricsAmount);
      await approveTx.wait();


      const allowanceToken1 = await contract_BRICS.allowance(
        accountData.address,
        POOL_ADDR
      );
      console.log("Allowance for token1:", allowanceToken1.toString());
      // fromCurrency = token0
      // toCurrency = token1


      // Call addLiquidity function
      const tx = await poolContract.addLiquidity(
        fromCurrency.toUpperCase(),
        "BRICS",
        amountInWei,
        amountInWei1
      );
      await tx.wait(); // Wait for the transaction to be mined

      alert("Liquidity successful!");
      setSuccess("Liquidity added successfully!");

      window.location.reload();

    } catch (err) {
      console.error(err);
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm">
      <h2 className="text-xl font-semibold mb-4">Deposit Liquidity</h2>

      {error && <div className="text-red-600 mb-4">{error}</div>}
      {success && <div className="text-green-600 mb-4">{success}</div>}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">From Token</label>
          <select
            className="w-full p-2 border rounded-lg bg-white"
            value={fromCurrency}
            onChange={(e) => setFromCurrency(e.target.value)}
          >
            {currencies.map(currency => (
              <option key={currency.id} value={currency.id}>
                {currency.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">To Token</label>
          <select
            className="w-full p-2 border rounded-lg bg-white"
            value={toCurrency}
            disabled
          >
            {toCurrencies.map(currency => (
              <option key={currency.id} value={currency.id}>
                {currency.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Amount From</label>
          <div className="relative mt-1">
            <input
              type="number"
              value={amount0}
              onChange={handleAmount0Change}
              placeholder="Enter amount"
              className="w-full h-10 px-3 border rounded-lg"
            />
            <button
              className="absolute right-3 top-2 text-blue-600 text-sm font-medium hover:bg-blue-50 px-2 py-1 rounded"
              onClick={() => setAmount0(balances[fromCurrency] || "0")}
            >
              MAX
            </button>
          </div>
        </div>
      </div>
      <div className="text-sm text-gray-500 mt-2 ">
        Your balance: {Number(balances[fromCurrency] || "0").toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        })} {currencies.find(t => t.id === fromCurrency)?.symbol}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mt-3">
          Amount To (Rate: {exchangeRate ? `1 ${fromCurrency.toUpperCase()} = ${(Number(exchangeRate) / 10000).toFixed(4)} ${toCurrencies.find(t => t.id === toCurrency)?.symbol}` : 'Loading...'})
        </label>
        <input
          type="number"
          value={amount1}
          readOnly
          className="w-full p-2 border rounded-lg bg-gray-50"
        />
      </div>
      <div className="text-sm text-gray-500 mt-2">
        Your balance: {Number(balances[toCurrency] || "0").toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        })} {toCurrencies.find(t => t.id === toCurrency)?.symbol}
      </div>

      <div className="mt-4 text-sm text-gray-600 ">
        Base fee : {exchangeRate ? `${(Number(exchangeRate) * 2000 / 1000000).toFixed(4)} BRICS` : 'Loading...'}
      </div>
      <div className="mt-4 text-sm text-gray-600 ">
        Low fee : {exchangeRate ? ` ${(Number(exchangeRate) * 1000 / 1000000).toFixed(4)} BRICS` : 'Loading...'}

      </div>

      <button
        className="w-full bg-blue-600 text-white font-semibold py-2 px-4 rounded-md shadow-sm hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
        disabled={Boolean(
          !amount0 ||
          !amount1 ||
          Number(amount0) <= 0 ||
          Number(amount1) <= 0 ||
          loading ||
          Number(amount0) > Number(balances[fromCurrency]) ||
          Number(amount1) > Number(balances[toCurrency])
        )}
        onClick={handleAddLiquidity}
      >
        {loading ? "Processing..." : "Deposit"}
      </button>
    </div>
  )
}