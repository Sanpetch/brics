"use client";

import { useState, useEffect } from "react";
import { ethers } from "ethers";
import POOL_ABI from "@/components/ABI/POOL.json";
import BRICS_ABI from "@/components/ABI/BRICS_Token.json";

interface UserLiquidity {
  liquidityTokens: string;
  token0Amount: string;
  token1Amount: string;
}

interface Token {
  id: string;
  name: string;
  label: string;
  address: string;
}

const POOL_ADDR = process.env.NEXT_PUBLIC_POOL_ADDRESS;
const CNY_CBDC = process.env.NEXT_PUBLIC_CBDC_CNY_ADDRESS;
const INR_CBDC = process.env.NEXT_PUBLIC_CBDC_INR_ADDRESS;
const RUB_CBDC = process.env.NEXT_PUBLIC_CBDC_RUB_ADDRESS;
const BRICS = process.env.NEXT_PUBLIC_BRICS_ADDRESS;

export default function PoolRemoveLiquidityModule() {
  const [amount0, setAmount0] = useState<string>("");
  const [amount1, setAmount1] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [poolsInfo, setPoolsInfo] = useState(null);
  const [fee, setFee] = useState("0");
  const [estimatedBRICS, setEstimatedBRICS] = useState("0");
  const [token0, setToken0] = useState<string>("CNY");
  const [token1, setToken1] = useState<string>("BRICS");
  const [estimatedLP, setEstimatedLP] = useState("0");

  const [userLiquidity, setUserLiquidity] = useState<UserLiquidity>({
    liquidityTokens: "0",
    token0Amount: "0",
    token1Amount: "0"
  });

  const tokens: Token[] = [
    { id: "CNY", name: "CNY_CBDC", label: "Digital Yuan", address: CNY_CBDC || "" },
    { id: "RUB", name: "RUB_CBDC", label: "Digital Ruble", address: RUB_CBDC || "" },
    { id: "INR", name: "INR_CBDC", label: "Digital Rupee", address: INR_CBDC || "" }];

  const bricsToken: Token = { id: "BRICS", name: "BRICS", label: "BRICS Stablecoin", address: BRICS || "" }



  const fromContractValue = (value: bigint): string => {
    const valueInTokenDecimals = Number(value) / 100; //หาร100 ทำให้แสดงค่าตรงกับในพูล
    return valueInTokenDecimals.toFixed(2);
  };





  useEffect(() => {
    const calculateEstimate = async () => {
      if (!window.ethereum || !amount0 || amount0 === "") return;
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const poolContract = new ethers.Contract(POOL_ADDR!, POOL_ABI, provider);
        const poolKey = await poolContract.getPoolKeybySymbol(token0, token1);
        const poolInfo = await poolContract.pools(poolKey);

        if (poolInfo.totalSupply === 0 || poolInfo.reserve0 === 0 || poolInfo.reserve1 === 0) {
          setEstimatedBRICS("0");
          setAmount1("0");
          return;
        }

        if (Number(amount0) > 0) {
          const amount0BigInt = ethers.parseUnits(amount0, 2);

          // If BRICS is token0
          if (token0 === "BRICS") {
            const liquidity1 = (amount0BigInt * poolInfo.totalSupply) / poolInfo.reserve1;
            const estimatedAmount = (liquidity1 * poolInfo.reserve0) / poolInfo.totalSupply;
            setEstimatedBRICS(ethers.formatUnits(estimatedAmount, 2));
            setAmount1(ethers.formatUnits(estimatedAmount, 2));
          }
          // If BRICS is token1
          else {
            const liquidity0 = (amount0BigInt * poolInfo.totalSupply) / poolInfo.reserve0;
            const estimatedAmount = (liquidity0 * poolInfo.reserve1) / poolInfo.totalSupply;
            setEstimatedBRICS(ethers.formatUnits(estimatedAmount, 2));
            setAmount1(ethers.formatUnits(estimatedAmount, 2));
          }
        } else {
          setEstimatedBRICS("0");
          setAmount1("0");
        }
      } catch (error) {
        console.error("Calculate estimate failed:", error);
        setEstimatedBRICS("0");
        setAmount1("0");
      }
    };
    calculateEstimate();
  }, [amount0, token0, token1]);




  useEffect(() => {
    const calculateEstimatedLP = async () => {
      if (!window.ethereum || !amount0 || !amount1) return;
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const poolContract = new ethers.Contract(POOL_ADDR!, POOL_ABI, provider);
        const poolKey = await poolContract.getPoolKeybySymbol(token0, token1);
        const poolInfo = await poolContract.pools(poolKey);

        if (poolInfo.totalSupply === 0 || poolInfo.reserve0 === 0 || poolInfo.reserve1 === 0) {
          setEstimatedLP("0");
          return;
        }

        const amount0BigInt = ethers.parseUnits(amount0, 2);
        const amount1BigInt = ethers.parseUnits(amount1, 2);

        const liquidity0 = (amount0BigInt * poolInfo.totalSupply) / poolInfo.reserve0;
        const liquidity1 = (amount1BigInt * poolInfo.totalSupply) / poolInfo.reserve1;

        // Use the minimum liquidity
        const liquidityToRemove = liquidity0 < liquidity1 ? liquidity0 : liquidity1;
        setEstimatedLP(ethers.formatUnits(liquidityToRemove, 2));
      } catch (error) {
        //console.error("Error calculating LP:", error);
        setEstimatedLP("0");
      }
    };
    calculateEstimatedLP();
  }, [amount0, amount1, token0, token1]);


  useEffect(() => {
    const calculateFee = async () => {
      if (!window.ethereum) return;
      const provider = new ethers.BrowserProvider(window.ethereum);
      const poolContract = new ethers.Contract(POOL_ADDR!, POOL_ABI, provider);

      // If BRICS is token0, get rate for token1 to BRICS
      const rate = await poolContract.getExchangeRate(
        token0 === "BRICS" ? token1 : token0,
        "BRICS"
      );
      const feeAmount = (rate * 2000n) / 10000n;
      setFee(ethers.formatUnits(feeAmount, 2));
    };
    calculateFee();
  }, [token0, token1]);

  const handleRemoveLiquidity = async (): Promise<void> => {
    if (!amount0 || !amount1) return;

    setLoading(true);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const poolContract = new ethers.Contract(POOL_ADDR!, POOL_ABI, signer);

      // Parse amounts with correct decimals
      const amount0In = ethers.parseUnits(amount0, 2);
      const amount1In = ethers.parseUnits(amount1, 2);


      const contract_BRICS = new ethers.Contract(BRICS, BRICS_ABI, signer);
      const approveTx = await contract_BRICS.approve(POOL_ADDR, ethers.parseUnits(fee, 2));
      await approveTx.wait();
      const tx = await poolContract.removeLiquidity(
        token0.toUpperCase(),
        token1.toUpperCase(),
        amount0In,
        amount1In
      );

      await tx.wait();
      setAmount0("");
      setAmount1("");
      alert("Withdraw successful!");
      window.location.reload();

    } catch (error) {
      console.error('Remove liquidity failed:', error);
      // Add more detailed error logging
      if (error.reason) console.error('Error reason:', error.reason);
      if (error.code) console.error('Error code:', error.code);
      alert("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        if (!window.ethereum) {
          throw new Error("No crypto wallet found");
        }
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const poolContract = new ethers.Contract(POOL_ADDR!, POOL_ABI, signer);

        // Get pools info
        try {
          const pools = await poolContract.getAllPoolsAvailability();
          if (pools && pools[1] && pools[2]) {
            setPoolsInfo(pools);
          } else {
            console.error("Invalid pools data structure:", pools);
          }
        } catch (poolError) {
          console.error("Error fetching pools:", poolError);
        }


        // Get user liquidity
        try {
          const liquidity = await poolContract.getUserLiquidity(
            token0 === "BRICS" ? token1 : token0,
            token0 === "BRICS" ? token0 : token1
          );

          if (token0 === "BRICS") {
            setUserLiquidity({
              liquidityTokens: fromContractValue(liquidity.liquidityTokens),
              token0Amount: fromContractValue(liquidity.token1Amount),
              token1Amount: fromContractValue(liquidity.token0Amount)
            });
          } else {
            setUserLiquidity({
              liquidityTokens: fromContractValue(liquidity.liquidityTokens),
              token0Amount: fromContractValue(liquidity.token0Amount),
              token1Amount: fromContractValue(liquidity.token1Amount)
            });
          }
        } catch (error) {
          //console.error("Error getting liquidity:", error);
          setUserLiquidity({
            liquidityTokens: "0",
            token0Amount: "0",
            token1Amount: "0"
          });
        }
      } catch (error) {
        console.error("Failed to initialize:", error);
      }
    };

    init();
  }, [token0, token1]);

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm">
      <div className="flex items-center gap-2 mb-6">
        <div className="w-6 h-6 text-blue-600">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold">Withdraw Liquidity</h2>
      </div>

      <div className="space-y-6">
        {/* Token Selection */}
        <div className="space-y-2">
          <label className="text-sm text-gray-600">Select Tokens</label>
          <div className="flex gap-4">
            <select
              className="w-1/2 bg-white border rounded-lg p-3"
              value={token0}
              onChange={(e) => {
                setToken0(e.target.value);
                // Reset token1 based on token0 selection
                if (e.target.value === "BRICS") {
                  setToken1("CNY"); // Default to first standard token
                } else {
                  setToken1("BRICS"); // Force BRICS as token1
                }
              }}
            >
              <option value="BRICS">{bricsToken.label}</option>
              {tokens.map(t => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>

            <select
              className="w-1/2 bg-white border rounded-lg p-3"
              value={token1}
              onChange={(e) => setToken1(e.target.value)}
              disabled={token0 !== "BRICS"} // Disable if token0 is not BRICS
            >
              {token0 === "BRICS" ?
                tokens.map(t => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                )) :
                <option value="BRICS">{bricsToken.label}</option>
              }
            </select>
          </div>
        </div>

        {/* Total Pool Position Display */}
        <div className="bg-blue-50 p-4 rounded-lg space-y-2">
          <h3 className="font-semibold text-blue-800">Your Pool Balance</h3>
          <div className="flex justify-between text-sm">
            <span>{token0}:</span>
            <span>{userLiquidity.token0Amount}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>{token1}:</span>
            <span>{userLiquidity.token1Amount}</span>
          </div>
          <div className="flex justify-between text-sm text-gray-600">
            <span>LP Tokens:</span>
            <span>{userLiquidity.liquidityTokens}</span>
          </div>
        </div>




        {/* Token0 Amount Input */}
        <div className="space-y-2">
          <label className="text-sm text-gray-600">Amount of {token0} to Remove</label>
          <div className="relative">
            <input
              type="number"
              value={amount0}
              onChange={(e) => setAmount0(e.target.value)}
              className="w-full border rounded-lg p-3"
              placeholder={`Enter ${token0} amount`}
              step="0.01"
              min="0"
            />
            <button
              className="absolute right-2 top-2 text-blue-600 text-sm px-2 py-1 rounded hover:bg-blue-50"
              onClick={() => setAmount0(userLiquidity.token0Amount)}
            >
              MAX
            </button>
          </div>
          <div className="text-sm text-gray-500">
            Available in Pool: {userLiquidity.token0Amount} {token0}
          </div>
        </div>

        {/* Token1 Amount Input */}
        <div className="space-y-2">
          <label className="text-sm text-gray-600">Amount of {token1} to Remove</label>
          <div className="relative">
            <input
              type="number"
              value={amount1}
              readOnly
              onChange={(e) => setAmount1(e.target.value)}
              className="w-full border rounded-lg p-3 bg-gray-50"
              placeholder={`Enter ${token1} amount`}
              step="0.01"
              min="0"
            />
            {/*<button
              className="absolute right-2 top-2 text-blue-600 text-sm px-2 py-1 rounded hover:bg-blue-50"
              onClick={() => setAmount1(token0 === "BRICS" ? userLiquidity.token0Amount : userLiquidity.token1Amount)}
            >
              MAX
            </button>*/}
          </div>
          <div className="text-sm text-gray-500">
            Available in Pool: {userLiquidity.token1Amount} {token1}
          </div>
        </div>



        {/* Validation Warnings */}

       
        {userLiquidity.token0Amount === "0" && userLiquidity.token1Amount === "0" && (
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-lg">
            <div className="flex items-center gap-2">
              <div>
                <h3 className="font-semibold">No Liquidity Found</h3>
                <p className="text-sm">This pool has no liquidity yet. Add liquidity to start earning fees.</p>
              </div>
            </div>
          </div>
        )}

        {(
          Number(amount0) > Number(userLiquidity.token0Amount) ||
          Number(amount1) > Number(userLiquidity.token1Amount)
        ) && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 8V12M12 16H12.01M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <div>
                  <h3 className="font-semibold">Insufficient Pool Balance</h3>
                  <p className="text-sm">The amount exceeds your available liquidity in the pool</p>
                </div>
              </div>
            </div>
          )}

        {poolsInfo && poolsInfo[1] && poolsInfo[2] && (
          (token0 === "BRICS" ? (
            // When BRICS is token0, check reverse order
            (token1 === "CNY" && (
              poolsInfo[2][0] <= ethers.parseUnits("1000", 2) ||
              poolsInfo[1][0] <= ethers.parseUnits("1000", 2) ||
              (poolsInfo[2][0] - ethers.parseUnits(amount0 || "0", 2) <= ethers.parseUnits("1000", 2)) ||
              (poolsInfo[1][0] - ethers.parseUnits(amount1 || "0", 2) <= ethers.parseUnits("1000", 2))
            )) ||
            (token1 === "RUB" && (
              poolsInfo[2][1] <= ethers.parseUnits("1000", 2) ||
              poolsInfo[1][1] <= ethers.parseUnits("1000", 2) ||
              (poolsInfo[2][1] - ethers.parseUnits(amount0 || "0", 2) <= ethers.parseUnits("1000", 2)) ||
              (poolsInfo[1][1] - ethers.parseUnits(amount1 || "0", 2) <= ethers.parseUnits("1000", 2))
            )) ||
            (token1 === "INR" && (
              poolsInfo[2][2] <= ethers.parseUnits("1000", 2) ||
              poolsInfo[1][2] <= ethers.parseUnits("1000", 2) ||
              (poolsInfo[2][2] - ethers.parseUnits(amount0 || "0", 2) <= ethers.parseUnits("1000", 2)) ||
              (poolsInfo[1][2] - ethers.parseUnits(amount1 || "0", 2) <= ethers.parseUnits("1000", 2))
            ))
          ) : (
            // Original checks when BRICS is token1
            (token0 === "CNY" && (
              poolsInfo[1][0] <= ethers.parseUnits("1000", 2) ||
              poolsInfo[2][0] <= ethers.parseUnits("1000", 2) ||
              (poolsInfo[1][0] - ethers.parseUnits(amount0 || "0", 2) <= ethers.parseUnits("1000", 2)) ||
              (poolsInfo[2][0] - ethers.parseUnits(amount1 || "0", 2) <= ethers.parseUnits("1000", 2))
            )) ||
            (token0 === "RUB" && (
              poolsInfo[1][1] <= ethers.parseUnits("1000", 2) ||
              poolsInfo[2][1] <= ethers.parseUnits("1000", 2) ||
              (poolsInfo[1][1] - ethers.parseUnits(amount0 || "0", 2) <= ethers.parseUnits("1000", 2)) ||
              (poolsInfo[2][1] - ethers.parseUnits(amount1 || "0", 2) <= ethers.parseUnits("1000", 2))
            )) ||
            (token0 === "INR" && (
              poolsInfo[1][2] <= ethers.parseUnits("1000", 2) ||
              poolsInfo[2][2] <= ethers.parseUnits("1000", 2) ||
              (poolsInfo[1][2] - ethers.parseUnits(amount0 || "0", 2) <= ethers.parseUnits("1000", 2)) ||
              (poolsInfo[2][2] - ethers.parseUnits(amount1 || "0", 2) <= ethers.parseUnits("1000", 2))
            ))
          )
          ) && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 8V12M12 16H12.01M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <div>
                  <h3 className="font-semibold">Pool Reserves Too Low</h3>
                  <p className="text-sm">Pool reserves must remain above 1000 after withdrawal</p>
                </div>
              </div>
            </div>
          ))}
        <div className="text-sm text-gray-600 space-y-2 mb-4">
          <p>Based on your withdrawal amount:</p>
          <div className="pl-4">
            {amount0 !== "" && (
              <>
                <p>{amount0} {token0}</p>
                <p>{amount1} {token1}</p>
                <p>≈ {estimatedLP} LP tokens will be burned</p>
              </>
            )}
          </div>
          <p>Withdrawal fee: {fee} BRICS</p>
        </div>


        <button
          className="w-full bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
          disabled={Boolean(
            !amount0 ||
            !amount1 ||
            Number(amount0) <= 0 ||
            Number(amount1) <= 0 ||
            loading ||
            Number(amount0) > Number(userLiquidity.token0Amount) ||
            Number(amount1) > Number(userLiquidity.token1Amount)
          )}
          onClick={handleRemoveLiquidity}
        >
          {loading ? 'Processing...' : 'Remove Liquidity'}
        </button>
      </div>
    </div>
  );
}