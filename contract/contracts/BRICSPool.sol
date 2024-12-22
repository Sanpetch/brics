// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "hardhat/console.sol";

contract BRICSPool is ReentrancyGuard, Ownable {
    
    address public constant BRICS = 0x047b37Ef4d76C2366F795Fb557e3c15E0607b7d8;
    address public constant RUB = 0x8207D032322052AfB9Bf1463aF87fd0c0097EDDE;
    address public constant CNY = 0x7FDc955b5E2547CC67759eDba3fd5d7027b9Bd66;
    address public constant INR = 0xc4d5177E415a5f5116Dc07Db14273f2755Ef7aAe;
    address public adminAddress;

    enum TokenSymbol {
        CNY,
        INR,
        RUB,
        BRICS
    }

    struct Pool {
        uint256 reserve0;
        uint256 reserve1;
        uint256 totalSupply;
        mapping(address => uint256) balances; //Add exchange rate
        bool token0OutPaused;  // Prevent token0 outflow
        bool token1OutPaused;  // Prevent token1 outflow
    }

    struct BasketWeight {
        uint256 INRWeight;
        uint256 rubWeight;
        uint256 cnyWeight;
    }

    mapping(bytes32 => Pool) public pools;
    mapping(address => mapping(address => uint256)) public exchangeRates; // Stores exchange rates between token pairs
    mapping(TokenSymbol => address) public tokenAddresses;
    mapping(string => TokenSymbol) public symbolToEnum;
    
    BasketWeight public basketWeights;

    uint256 public constant WEIGHT_PRECISION = 100;
    uint256 public constant MINIMUM_LIQUIDITY = 1000; //Prevent devided by zero caused error
    uint256 public constant FEE = 20; // 0.2%
    uint256 public constant FEE_DENOMINATOR = 10000;
    uint256 public constant RATE_CHANGE_LIMIT = 1000; // 10% max rate change


    event PoolCreated(string token0Symbol, string token1Symbol);
    event LiquidityAdded(
        string token0Symbol,
        string token1Symbol,
        uint256 amount0,
        uint256 amount1,
        uint256 liquidity
    );
    event LiquidityRemoved(
        string token0Symbol,
        string token1Symbol,
        uint256 amount0,
        uint256 amount1,
        uint256 liquidity
    );
    event Swapped(
        string fromSymbol,
        string toSymbol,
        uint256 amountIn,
        uint256 amountOut
    );
    event RateUpdated(
        string token0Symbol,
        string token1Symbol,
        uint256 newRate
    );

    constructor(address initialOwner) Ownable(initialOwner) {
        tokenAddresses[TokenSymbol.INR] = INR;
        tokenAddresses[TokenSymbol.BRICS] = BRICS;
        tokenAddresses[TokenSymbol.RUB] = RUB;
        tokenAddresses[TokenSymbol.CNY] = CNY;

        symbolToEnum["INR"] = TokenSymbol.INR;
        symbolToEnum["BRICS"] = TokenSymbol.BRICS;
        symbolToEnum["RUB"] = TokenSymbol.RUB;
        symbolToEnum["CNY"] = TokenSymbol.CNY;

        basketWeights = BasketWeight(30, 50, 20); //updated CNY 20, RUB 50, INR 30

        createPool("INR", "BRICS");
        createPool("RUB", "BRICS");
        createPool("CNY", "BRICS");
        createPool("INR", "RUB");
        createPool("INR", "CNY");
        createPool("RUB", "CNY");
    }

    modifier checkTokenAvailability(
        string memory fromSymbol, 
        string memory toSymbol, 
        uint256 amountOut
    ) {
        bytes32 poolKey = getPoolKey(fromSymbol, toSymbol);
        Pool storage pool = pools[poolKey];
        
        if (keccak256(bytes(fromSymbol)) < keccak256(bytes(toSymbol))) {
            require(!pool.token1OutPaused, "Token1 outflow paused");
            require(pool.reserve1 >= amountOut, "Insufficient token1");
        } else {
            require(!pool.token0OutPaused, "Token0 outflow paused");
            require(pool.reserve0 >= amountOut, "Insufficient token0");
        }
        _;
    }


    function getPoolKey(string memory token0Symbol, string memory token1Symbol)
        public
        pure
        returns (bytes32)
    {
        if (keccak256(bytes(token0Symbol)) < keccak256(bytes(token1Symbol))) {
            return keccak256(abi.encodePacked(token0Symbol, token1Symbol));
        }
        return keccak256(abi.encodePacked(token1Symbol, token0Symbol));
    }

    function createPool(string memory token0Symbol, string memory token1Symbol)
        public
        onlyOwner
    {
        bytes32 poolKey = getPoolKey(token0Symbol, token1Symbol);
        require(pools[poolKey].totalSupply == 0, "Pool exists");
        emit PoolCreated(token0Symbol, token1Symbol);
    }

    function addLiquidity(
        string memory token0Symbol,
        string memory token1Symbol,
        uint256 amount0Desired,
        uint256 amount1Desired
    )
        external
        nonReentrant
        returns (
            uint256 amount0,
            uint256 amount1,
            uint256 liquidity
        )
    {
        bytes32 poolKey = getPoolKey(token0Symbol, token1Symbol);
        Pool storage pool = pools[poolKey];

        if (pool.totalSupply == 0) {
            // First LP sets the price ratio
            amount0 = amount0Desired;
            amount1 = amount1Desired;
            liquidity = sqrt(amount0 * amount1) - MINIMUM_LIQUIDITY;
            console.log("Initial liquidity:", liquidity);
            pool.totalSupply = MINIMUM_LIQUIDITY;
        } else {
            // Calculate token1 amount based on current ratio
            amount0 = amount0Desired;
            amount1 = (amount0 * pool.reserve1) / pool.reserve0;
            require(amount1 <= amount1Desired, "Excessive amount1");

            liquidity = min(
                (amount0 * pool.totalSupply) / pool.reserve0,
                (amount1 * pool.totalSupply) / pool.reserve1
            );
        }

        require(liquidity > 0, "Insufficient liquidity minted");

        address token0 = getAddressFromSymbol(token0Symbol);
        address token1 = getAddressFromSymbol(token1Symbol);

        require(
            IERC20(token0).transferFrom(msg.sender, address(this), amount0),
            "Transfer0 failed"
        );
        require(
            IERC20(token1).transferFrom(msg.sender, address(this), amount1),
            "Transfer1 failed"
        );

        pool.reserve0 += amount0;
        pool.reserve1 += amount1;
        pool.totalSupply += liquidity;
        pool.balances[msg.sender] += liquidity;

        emit LiquidityAdded(
            token0Symbol,
            token1Symbol,
            amount0,
            amount1,
            liquidity
        );
    }

    function removeLiquidity(
        string memory token0Symbol,
        string memory token1Symbol,
        uint256 liquidity,
        uint256 amount0Min,
        uint256 amount1Min
    ) external nonReentrant returns (uint256 amount0, uint256 amount1) {
        bytes32 poolKey = getPoolKey(token0Symbol, token1Symbol);
        Pool storage pool = pools[poolKey];

        require(
            pool.balances[msg.sender] >= liquidity,
            "Insufficient liquidity"
        );

        amount0 = (liquidity * pool.reserve0) / pool.totalSupply;
        amount1 = (liquidity * pool.reserve1) / pool.totalSupply;
        require(amount0 >= amount0Min, "Insufficient amount0");
        require(amount1 >= amount1Min, "Insufficient amount1");

        pool.balances[msg.sender] -= liquidity;
        pool.totalSupply -= liquidity;
        pool.reserve0 -= amount0;
        pool.reserve1 -= amount1;

        address token0 = getAddressFromSymbol(token0Symbol);
        address token1 = getAddressFromSymbol(token1Symbol);

        require(
            IERC20(token0).transfer(msg.sender, amount0),
            "Transfer0 failed"
        );
        require(
            IERC20(token1).transfer(msg.sender, amount1),
            "Transfer1 failed"
        );

        emit LiquidityRemoved(
            token0Symbol,
            token1Symbol,
            amount0,
            amount1,
            liquidity
        );
    }

    // Emergency withdrawal function
    function emergencyWithdraw(string memory token0Symbol, string memory token1Symbol) 
        external 
        onlyOwner 
        nonReentrant 
    {
        bytes32 poolKey = getPoolKey(token0Symbol, token1Symbol);
        Pool storage pool = pools[poolKey];
        
        address token0 = getAddressFromSymbol(token0Symbol);
        address token1 = getAddressFromSymbol(token1Symbol);
        
        uint256 balance0 = IERC20(token0).balanceOf(address(this));
        uint256 balance1 = IERC20(token1).balanceOf(address(this));
        
        require(IERC20(token0).transfer(owner(), balance0), "Transfer0 failed");
        require(IERC20(token1).transfer(owner(), balance1), "Transfer1 failed");
        
        pool.reserve0 = 0;
        pool.reserve1 = 0;
        pool.totalSupply = 0;
    }

    function getAddressFromSymbol(string memory symbol)
        internal
        view
        returns (address)
    {
        TokenSymbol tokenSymbol = symbolToEnum[symbol];
        return tokenAddresses[tokenSymbol];
    }

    /*function swap(
        string memory fromSymbol,
        string memory toSymbol,
        uint256 amountIn
    ) external nonReentrant returns (uint256 amountOut) {
        bytes32 poolKey = getPoolKey(fromSymbol, toSymbol);
        Pool storage pool = pools[poolKey];

        amountOut = (amountIn * pool.reserve1) / pool.reserve0;

        address fromToken = getAddressFromSymbol(fromSymbol);
        address toToken = getAddressFromSymbol(toSymbol);

        require(
            IERC20(fromToken).transferFrom(msg.sender, address(this), amountIn),
            "TransferFrom failed"
        );
        require(
            IERC20(toToken).transfer(msg.sender, amountOut),
            "Transfer failed"
        );

        pool.reserve0 += amountIn;
        pool.reserve1 -= amountOut;

        emit Swapped(fromSymbol, toSymbol, amountIn, amountOut);
    }*/
    //Swap with minimum amount to prevent Transaction delay issues, Outdate rate, front-running attack
    function swap(
        string memory fromSymbol, 
        string memory toSymbol, 
        uint256 amountIn,
        uint256 minAmountOut
    ) external nonReentrant returns (uint256 amountOut) {
        bytes32 poolKey = getPoolKey(fromSymbol, toSymbol);
        Pool storage pool = pools[poolKey];
        
        amountOut = (amountIn * pool.reserve1) / pool.reserve0;
        require(amountOut >= minAmountOut, "Output below minimum");
        
        address fromToken = getAddressFromSymbol(fromSymbol);
        address toToken = getAddressFromSymbol(toSymbol);
        
        require(IERC20(fromToken).transferFrom(msg.sender, address(this), amountIn), "TransferFrom failed");
        require(IERC20(toToken).transfer(msg.sender, amountOut), "Transfer failed");
        
        pool.reserve0 += amountIn;
        pool.reserve1 -= amountOut;
        
        emit Swapped(fromSymbol, toSymbol, amountIn, amountOut);
    }

    //Returns user's LP tokens and equivalent token amounts
    function getUserLiquidity(
        string memory token0Symbol,
        string memory token1Symbol
    )
        external
        view
        returns (
            //address user
            uint256 liquidityTokens,
            uint256 token0Amount,
            uint256 token1Amount
        )
    {
        bytes32 poolKey = getPoolKey(token0Symbol, token1Symbol);
        Pool storage pool = pools[poolKey];

        liquidityTokens = pool.balances[msg.sender];
        token0Amount = (liquidityTokens * pool.reserve0) / pool.totalSupply;
        token1Amount = (liquidityTokens * pool.reserve1) / pool.totalSupply;
    }

    function getPoolInfo(string memory token0Symbol, string memory token1Symbol) 
        external
        view
        returns (
            uint256 reserve0,
            uint256 reserve1,
            uint256 totalLiquidity,
            uint256 currentRate,
            uint256 totalValueInBRICS,
            bool isHealthy
        ) 
    {
        bytes32 poolKey = getPoolKey(token0Symbol, token1Symbol);
        Pool storage pool = pools[poolKey];
        
        reserve0 = pool.reserve0;
        reserve1 = pool.reserve1;
        totalLiquidity = pool.totalSupply;
        
        require(reserve0 > MINIMUM_LIQUIDITY, "Low reserve0");
        require(reserve1 > MINIMUM_LIQUIDITY, "Low reserve1");
        
        currentRate = reserve0 > 0 ? (reserve1 * 1e18) / reserve0 : 0;
        
        // Calculate total value in BRICS
        address token0 = getAddressFromSymbol(token0Symbol);
        address token1 = getAddressFromSymbol(token1Symbol);
        uint256 price0 = exchangeRates[token0][BRICS];
        uint256 price1 = exchangeRates[token1][BRICS];
        totalValueInBRICS = (reserve0 * price0 + reserve1 * price1) / 1e18;
        
        // Check if pool is healthy
        isHealthy = reserve0 > MINIMUM_LIQUIDITY && 
                    reserve1 > MINIMUM_LIQUIDITY && 
                    currentRate > 0;
    }


    function getAmountWithFee(uint256 amount) private pure returns (uint256) {
        return (amount * (FEE_DENOMINATOR - FEE)) / FEE_DENOMINATOR;
    }

    // Get currency weights in BRICS
    function getWeights()
        external
        view
        returns (
            uint256 INRValue,
            uint256 rubValue,
            uint256 cnyValue
        )
    {
        Pool storage INRPool = pools[getPoolKey("INR", "BRICS")];
        Pool storage rubPool = pools[getPoolKey("RUB", "BRICS")];
        Pool storage cnyPool = pools[getPoolKey("CNY", "BRICS")];

        return (
            (INRPool.reserve0 * basketWeights.INRWeight) / WEIGHT_PRECISION,
            (rubPool.reserve0 * basketWeights.rubWeight) / WEIGHT_PRECISION,
            (cnyPool.reserve0 * basketWeights.cnyWeight) / WEIGHT_PRECISION
        );
    }

    function getExpectedOutput(
        string memory fromSymbol,
        string memory toSymbol,
        uint256 amountIn
    ) external view returns (uint256) {
        bytes32 poolKey = getPoolKey(fromSymbol, toSymbol);
        Pool storage pool = pools[poolKey];

        return (amountIn * pool.reserve1) / pool.reserve0;
    }

    function getExistingPools() external view returns (string[][] memory) {
        string[4] memory symbols = ["INR", "BRICS", "RUB", "CNY"];
        string[][] memory existingPools = new string[][](6);
        uint256 poolCount = 0;

        for (uint256 i = 0; i < 4; i++) {
            for (uint256 j = i + 1; j < 4; j++) {
                bytes32 poolKey = getPoolKey(symbols[i], symbols[j]);
                Pool storage pool = pools[poolKey];

                existingPools[poolCount] = new string[](2);
                existingPools[poolCount][0] = symbols[i];
                existingPools[poolCount][1] = symbols[j];
                poolCount++;
            }
            
        }
        return existingPools;
    }

    function updateBasketWeights(uint256 inrWeight, uint256 rubWeight, uint256 cnyWeight) external onlyOwner {
        require(inrWeight + rubWeight + cnyWeight == WEIGHT_PRECISION, "Invalid weights");
        basketWeights = BasketWeight(inrWeight, rubWeight, cnyWeight);
    }

    

    function updateExchangeRate(string memory token0Symbol, string memory token1Symbol, uint256 newRate) public onlyOwner {
        bytes32 poolKey = getPoolKey(token0Symbol, token1Symbol);
        Pool storage pool = pools[poolKey];
        require(pool.totalSupply > 0, "Pool doesn't exist");

        uint256 currentRate = pool.reserve1 * 1e18 / pool.reserve0;
        uint256 rateDiff = newRate > currentRate ? 
            ((newRate - currentRate) * 10000) / currentRate : 
            ((currentRate - newRate) * 10000) / currentRate;
        require(rateDiff <= RATE_CHANGE_LIMIT, "Rate change too high");

        uint256 newReserve1 = (pool.reserve0 * newRate) / 1e18;
        pool.reserve1 = newReserve1;
        emit RateUpdated(token0Symbol, token1Symbol, newRate);
    }

    function calculateBricsRate(uint256 cnyRate, uint256 rubRate, uint256 inrRate) public view returns (uint256) {
        uint256 bricsValue = (
            (cnyRate * basketWeights.cnyWeight) +
            (rubRate * basketWeights.rubWeight) +
            (inrRate * basketWeights.INRWeight)
        ) / WEIGHT_PRECISION;
        
        return bricsValue;
        }

    function updateBricsFromRates(uint256 cnyRate, uint256 rubRate, uint256 inrRate) external onlyOwner{
        uint256 bricsValue = calculateBricsRate(cnyRate, rubRate, inrRate);
        updateExchangeRate("CNY", "BRICS", bricsValue);
        updateExchangeRate("RUB", "BRICS", bricsValue);
        updateExchangeRate("INR", "BRICS", bricsValue);
    }




    function sqrt(uint256 y) internal pure returns (uint256 z) {
        if (y > 3) {
            z = y;
            uint256 x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }

    function min(uint256 x, uint256 y) internal pure returns (uint256) {
        return x < y ? x : y;
    }
}
