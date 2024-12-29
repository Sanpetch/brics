// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./TokenRegistry.sol";
import "hardhat/console.sol";

contract BRICSPool is ReentrancyGuard, Ownable {
    TokenRegistry public tokenRegistry;
    address public feeCollector;

    mapping(address => mapping(address => uint256)) public exchangeRates; // Stores exchange rates between token pairs
    mapping(bytes32 => Pool) public pools;

    uint256 public constant MINIMUM_LIQUIDITY = 1000; //Prevent devided by zero caused error
    uint256 public constant PROTOCOL_FEE = 5; // 0.05%
    uint256 public constant LP_FEE = 15; // 0.15%
    uint256 public constant TOTAL_FEE = PROTOCOL_FEE + LP_FEE; // 0.2%
    uint256 public constant FEE_DENOMINATOR = 10000;
    uint256 public constant RATE_CHANGE_LIMIT = 5000; // 50% max rate change
    uint256 public constant RATE_PRECISION = 1000; // 1000 = 1

    struct Pool {
        address token0;         
        address token1;
        uint256 reserve0;
        uint256 reserve1;
        uint256 totalSupply;
        mapping(address => uint256) balances; 
        bool token0OutPaused;
        bool token1OutPaused;
        bool isActive;
    }

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

    event ProtocolFeeCollected(uint256 amount);
    event LPFeeDistributed(address LP, uint256 amount);
    event PoolCreated(string token0Symbol, string token1Symbol);


    constructor(address initialOwner, address _tokenRegistry) Ownable(initialOwner) {
        feeCollector = initialOwner;
        tokenRegistry = TokenRegistry(_tokenRegistry);
        updateExchangeRate("CNY", "CNY", RATE_PRECISION); // 1.0 CNY base
        updateExchangeRate("RUB", "CNY", 69);  // 0.069 RUB/CNY
        updateExchangeRate("INR", "CNY", 86);  // 0.086 INR/CNY
    
        createPool("CNY", "BRICS");
        createPool("RUB", "BRICS");
        createPool("INR", "BRICS");

    }

    modifier checkTokenAvailability(
        string memory fromSymbol,
        string memory toSymbol,
        uint256 amountOut
    ) {
        bytes32 poolKey = getPoolKeybySymbol(fromSymbol, toSymbol);
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

    function setFeeCollector(address _feeCollector) external onlyOwner {
        require(_feeCollector != address(0), "Invalid address");
        feeCollector = _feeCollector;
    }


    function getPoolKeybySymbol(string memory token0Symbol, string memory token1Symbol) public view returns (bytes32) {
        address token0 = tokenRegistry.getTokenAddress(token0Symbol);
        address token1 = tokenRegistry.getTokenAddress(token1Symbol);
        return token0 < token1 
            ? keccak256(abi.encodePacked(token0, token1))
            : keccak256(abi.encodePacked(token1, token0));
    }


    function createPool(string memory token0Symbol, string memory token1Symbol)
        public
        onlyOwner
    {
        address token0 = tokenRegistry.getTokenAddress(token0Symbol);
        address token1 = tokenRegistry.getTokenAddress(token1Symbol);
        require(token0 != address(0) && token1 != address(0), "Invalid token symbol");

        bytes32 poolKey = getPoolKeybySymbol(token0Symbol, token1Symbol);
        require(!pools[poolKey].isActive, "Pool exists");

        Pool storage newPool = pools[poolKey];
        newPool.token0 = token0;
        newPool.token1 = token1;
        newPool.isActive = true;

        emit PoolCreated(token0Symbol, token1Symbol);
    }


    function getAllPoolsAvailability() external view returns (
        string[] memory poolNames,
        uint256[] memory reserves0,
        uint256[] memory reserves1,
        bool[] memory isAvailable
    ) {
        uint256 activePoolCount = 0;
        string[] memory supportedTokens = tokenRegistry.getSupportedTokens();
        
        for (uint i = 0; i < supportedTokens.length; i++) {
            for (uint j = i + 1; j < supportedTokens.length; j++) {
                bytes32 poolKey = getPoolKeybySymbol(supportedTokens[i], supportedTokens[j]);
                if (pools[poolKey].isActive) {
                    activePoolCount++;
                }
            }
        }
        poolNames = new string[](activePoolCount * 2);
        reserves0 = new uint256[](activePoolCount);
        reserves1 = new uint256[](activePoolCount);
        isAvailable = new bool[](activePoolCount);

        uint256 currentIndex = 0;
        for (uint i = 0; i < supportedTokens.length; i++) {
            for (uint j = i + 1; j < supportedTokens.length; j++) {
                bytes32 poolKey = getPoolKeybySymbol(supportedTokens[i], supportedTokens[j]);
                if (pools[poolKey].isActive) {
                    Pool storage pool = pools[poolKey];
                    poolNames[currentIndex * 2] = supportedTokens[i];
                    poolNames[currentIndex * 2 + 1] = supportedTokens[j];
                    reserves0[currentIndex] = pool.reserve0;
                    reserves1[currentIndex] = pool.reserve1;
                    isAvailable[currentIndex] = pool.reserve0 > MINIMUM_LIQUIDITY && 
                                            pool.reserve1 > MINIMUM_LIQUIDITY;
                    currentIndex++;
                }
            }
        }
    }

    function getPoolInfo(string memory token0Symbol, string memory token1Symbol)
        public 
        view
        returns (
            uint256 reserve0,
            uint256 reserve1,
            uint256 totalLiquidity,
            uint256 rateT0ToT1,  // Current exchange rate between tokens
            uint256 rateT1ToT0,  // Reverse exchange rate 
            bool isHealthy
        )
    {
        bytes32 poolKey = getPoolKeybySymbol(token0Symbol, token1Symbol);
        Pool storage pool = pools[poolKey];
        address token0 = tokenRegistry.getTokenAddress(token0Symbol);
        address token1 = tokenRegistry.getTokenAddress(token1Symbol);
        

        reserve0 = pool.reserve0;
        reserve1 = pool.reserve1;
        totalLiquidity = pool.totalSupply;
        rateT0ToT1 = exchangeRates[token0][token1];
        rateT1ToT0 = exchangeRates[token1][token0];
        
        isHealthy = reserve0 > MINIMUM_LIQUIDITY && 
                    reserve1 > MINIMUM_LIQUIDITY && 
                    rateT0ToT1 > 0 && rateT1ToT0 > 0;
    }

    function setPoolActive(
        string memory token0Symbol,
        string memory token1Symbol,
        bool _isActive
        ) external onlyOwner {
        bytes32 poolKey = getPoolKeybySymbol(token0Symbol, token1Symbol);
        pools[poolKey].isActive = _isActive;
        }

    function setTokenOutPause(
        string memory token0Symbol, 
        string memory token1Symbol,
        bool pauseToken0,
        bool pauseToken1
    ) external onlyOwner {
        bytes32 poolKey = getPoolKeybySymbol(token0Symbol, token1Symbol);
        pools[poolKey].token0OutPaused = pauseToken0;
        pools[poolKey].token1OutPaused = pauseToken1;
    }

    function addLiquidity(
        string memory token0Symbol,
        string memory token1Symbol,
        uint256 amount0Desired,
        uint256 amount1Desired
        ) external nonReentrant returns (uint256 amount0, uint256 amount1, uint256 liquidity) {
        bytes32 poolKey = getPoolKeybySymbol(token0Symbol, token1Symbol);
        Pool storage pool = pools[poolKey];
        address BRICS = tokenRegistry.getTokenAddress("BRICS");

        if (pool.totalSupply == 0) {
            amount0 = amount0Desired;
            amount1 = amount1Desired;
            liquidity = sqrt(amount0 * amount1) - MINIMUM_LIQUIDITY;
            pool.totalSupply = MINIMUM_LIQUIDITY;
        } else {
            amount0 = amount0Desired;
            amount1 = (amount0 * pool.reserve1) / pool.reserve0;
            require(amount1 <= amount1Desired, "Excessive amount1");
            liquidity = min((amount0 * pool.totalSupply) / pool.reserve0, (amount1 * pool.totalSupply) / pool.reserve1);
        }

        uint256 protocolFeeBrics = (getExchangeRate(token0Symbol, "BRICS") * PROTOCOL_FEE) / FEE_DENOMINATOR;
        require(IERC20(BRICS).transferFrom(msg.sender, feeCollector, protocolFeeBrics), "Protocol fee failed");

        address token0 = tokenRegistry.getTokenAddress(token0Symbol);
        address token1 = tokenRegistry.getTokenAddress(token1Symbol);

        require(IERC20(token0).transferFrom(msg.sender, address(this), amount0), "Transfer0 failed");
        require(IERC20(token1).transferFrom(msg.sender, address(this), amount1), "Transfer1 failed");

        pool.reserve0 += amount0;
        pool.reserve1 += amount1;
        pool.totalSupply += liquidity;
        pool.balances[msg.sender] += liquidity;

        emit LiquidityAdded(token0Symbol, token1Symbol, amount0, amount1, liquidity);
        }

    function removeLiquidity(
        string memory token0Symbol,
        string memory token1Symbol,
        uint256 liquidity,
        uint256 amount0Min,
        uint256 amount1Min
    ) external nonReentrant returns (uint256 amount0, uint256 amount1) {
        bytes32 poolKey = getPoolKeybySymbol(token0Symbol, token1Symbol);
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

        address token0 = tokenRegistry.getTokenAddress(token0Symbol);
        address token1 = tokenRegistry.getTokenAddress(token1Symbol);

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


    function swap(
        string memory fromSymbol,
        string memory toSymbol,
        uint256 amountIn,
        uint256 minAmountOut
    ) external nonReentrant returns (uint256 amountOut) {
        bytes32 poolKey = getPoolKeybySymbol(fromSymbol, toSymbol);
        Pool storage pool = pools[poolKey];
        address fromToken = tokenRegistry.getTokenAddress(fromSymbol);
        
        bool isToken0 = fromToken == pool.token0;
        amountOut = isToken0 
            ? (amountIn * pool.reserve1) / pool.reserve0 
            : (amountIn * pool.reserve0) / pool.reserve1;
        
        uint256 feeBrics = (getExchangeRate(fromSymbol, "BRICS") * TOTAL_FEE) / FEE_DENOMINATOR;
        uint256 protocolFeeBrics = (feeBrics * PROTOCOL_FEE) / TOTAL_FEE;
        require(amountOut >= minAmountOut, "Output below minimum");
        
        address BRICS = tokenRegistry.getTokenAddress("BRICS");
        address toToken = tokenRegistry.getTokenAddress(toSymbol);

        require(IERC20(fromToken).transferFrom(msg.sender, address(this), amountIn), "TransferFrom failed");
        require(IERC20(toToken).transfer(msg.sender, amountOut), "Transfer failed");
        require(IERC20(BRICS).transfer(feeCollector, protocolFeeBrics), "Protocol fee failed");
        require(IERC20(BRICS).transfer(msg.sender, feeBrics - protocolFeeBrics), "LP fee failed");
        
        emit LPFeeDistributed(msg.sender, feeBrics - protocolFeeBrics);

        if (isToken0) {
            pool.reserve0 += amountIn;
            pool.reserve1 -= amountOut;
        } else {
            pool.reserve1 += amountIn;
            pool.reserve0 -= amountOut;
        }

        emit Swapped(fromSymbol, toSymbol, amountIn, amountOut);
    }


    //Returns user's LP tokens and equivalent token amounts
    function getUserLiquidity(
        string memory token0Symbol,
        string memory token1Symbol
    )
        public
        view
        returns (
            uint256 liquidityTokens,
            uint256 token0Amount,
            uint256 token1Amount
        )
    {
        bytes32 poolKey = getPoolKeybySymbol(token0Symbol, token1Symbol);
        Pool storage pool = pools[poolKey];

        liquidityTokens = pool.balances[msg.sender];
        token0Amount = (liquidityTokens * pool.reserve0) / pool.totalSupply;
        token1Amount = (liquidityTokens * pool.reserve1) / pool.totalSupply;
    }

    function getExpectedOutput(
        string memory fromSymbol,
        string memory toSymbol,
        uint256 amountIn
    ) external view returns (uint256 amountOut, uint256 bricsFee) {
        address fromToken = tokenRegistry.getTokenAddress(fromSymbol);
        address toToken = tokenRegistry.getTokenAddress(toSymbol);
        address bricsAddr = tokenRegistry.getTokenAddress("BRICS");

        uint256 rate = exchangeRates[fromToken][toToken];
        amountOut = (amountIn * rate) / RATE_PRECISION;
        
        // Calculate fee in BRICS
        if(toToken == bricsAddr) {
            bricsFee = (amountOut * TOTAL_FEE) / FEE_DENOMINATOR;
        } else {
            // For other tokens, calculate equivalent BRICS value of output
            uint256 rateToBrics = exchangeRates[toToken][bricsAddr];
            uint256 bricsEquivalent = (amountOut * rateToBrics) / RATE_PRECISION;
            bricsFee = (bricsEquivalent * TOTAL_FEE) / FEE_DENOMINATOR;
        }

        return (amountOut, bricsFee);
    }

    function updateExchangeRate(
        string memory token0Symbol,
        string memory token1Symbol,
        uint256 newRate
    ) public onlyOwner {
        address token0 = tokenRegistry.getTokenAddress(token0Symbol);
        address token1 = tokenRegistry.getTokenAddress(token1Symbol);

        uint256 currentRate = exchangeRates[token0][token1];
        if (currentRate > 0) {
            uint256 rateDiff = newRate > currentRate
                ? ((newRate - currentRate) * 10000) / currentRate
                : ((currentRate - newRate) * 10000) / currentRate;
            require(rateDiff <= RATE_CHANGE_LIMIT, "Rate change too high");
        }

        exchangeRates[token0][token1] = newRate;
        // Set reverse rate (if rate is 2000 meaning 2.0, reverse is 500 meaning 0.5)
        uint256 reverseRate = (RATE_PRECISION * RATE_PRECISION) / newRate;
        exchangeRates[token1][token0] = reverseRate;

        emit RateUpdated(token0Symbol, token1Symbol, newRate);
    }

    function getExchangeRate(
        string memory token0Symbol,
        string memory token1Symbol
    ) public view returns (uint256) {
        if (keccak256(bytes(token0Symbol)) == keccak256(bytes(token1Symbol))) {
        return RATE_PRECISION;
    }
        address token0 = tokenRegistry.getTokenAddress(token0Symbol);
        address token1 = tokenRegistry.getTokenAddress(token1Symbol);

        uint256 directRate = exchangeRates[token0][token1];
        if (directRate > 0) return directRate;

        uint256 reverseRate = exchangeRates[token1][token0];
        require(reverseRate > 0, "Exchange rate not set");

        return (RATE_PRECISION * RATE_PRECISION) / reverseRate;
    }


    function calculateBricsValue(uint256 amount) public view returns (uint256) {
        string memory baseCurrency = "CNY";  // Base currency for rate comparison
        uint256 bricsValue;
        
        for(uint i = 0; i < tokenRegistry.getSupportedTokensLength(); i++) {
            string memory symbol = tokenRegistry.getTokenAtIndex(i);
            if(keccak256(bytes(symbol)) != keccak256(bytes("BRICS"))) {
                uint256 weight = tokenRegistry.getTokenWeight(symbol);
                address tokenAddr = tokenRegistry.getTokenAddress(symbol);
                address baseAddr = tokenRegistry.getTokenAddress(baseCurrency);
                uint256 tokenToBase = keccak256(bytes(symbol)) == keccak256(bytes(baseCurrency)) ? 
                    RATE_PRECISION : exchangeRates[tokenAddr][baseAddr];
                
                bricsValue += (amount * weight * tokenToBase) / (RATE_PRECISION);
            }
        }
        
        return bricsValue / tokenRegistry.WEIGHT_PRECISION();
    }

    function updateBricsRates() external onlyOwner {
        address bricsAddr = tokenRegistry.getTokenAddress("BRICS");
        address cnyAddr = tokenRegistry.getTokenAddress("CNY");
        
        uint256 bricsValueInCNY = calculateBricsValue(RATE_PRECISION); 
        
        string[] memory tokens = tokenRegistry.getSupportedTokens();
        for(uint i = 0; i < tokens.length; i++) {
            string memory symbol = tokens[i];
            if(keccak256(bytes(symbol)) != keccak256(bytes("BRICS"))) {
                address tokenAddr = tokenRegistry.getTokenAddress(symbol);
                
                if(tokenAddr == cnyAddr) {
                    
                    exchangeRates[bricsAddr][cnyAddr] = bricsValueInCNY;
                    exchangeRates[cnyAddr][bricsAddr] = (RATE_PRECISION * RATE_PRECISION) / bricsValueInCNY;
                } else {
                    uint256 tokenToCNY = exchangeRates[tokenAddr][cnyAddr];
                    uint256 bricsToToken = (bricsValueInCNY * RATE_PRECISION) / tokenToCNY;
                    
                    exchangeRates[bricsAddr][tokenAddr] = bricsToToken;
                    exchangeRates[tokenAddr][bricsAddr] = (RATE_PRECISION * RATE_PRECISION) / bricsToToken;
                }
            }
        }
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
