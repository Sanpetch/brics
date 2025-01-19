// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./TokenRegistry.sol";
import "./FeeManager.sol";


contract BRICSPool is ReentrancyGuard {
    TokenRegistry public tokenRegistry;
    FeeManager public feeManager;

    mapping(address => mapping(address => uint256)) public exchangeRates; // Stores exchange rates between token pairs
    mapping(bytes32 => Pool) public pools;

    uint256 public minimumLiquidity= 100000;// 1000.00
    //uint256 public RATE_CHANGE_LIMIT = 1000; // 10% max rate change
    uint256 public constant RATE_PRECISION = 10000; // 10000 = 1

    struct Pool {
        address token0;         
        address token1;
        uint256 reserve0;
        uint256 reserve1;
        uint256 totalSupply; //LP
        mapping(address => uint256) balances; 
        bool token0OutPaused;
        bool token1OutPaused;
        
    }
    event PoolOperation(
        string token0Symbol,
        string token1Symbol,
        uint256 amount0,
        uint256 amount1,
        uint256 liquidity,
        string operation // "add", "remove", or "swap"
    );
    event RateUpdated(
        string token0Symbol,
        string token1Symbol,
        uint256 newRate
    );

    event PoolCreated(string token0Symbol, string token1Symbol);

    constructor(address _tokenRegistry, address _feeManager) {
        tokenRegistry = TokenRegistry(_tokenRegistry);
        feeManager = FeeManager(_feeManager);
        updateExchangeRate("CNY", "CNY", RATE_PRECISION); // 1.0 CNY base
        updateExchangeRate("RUB", "CNY", 730);  // 0.073 RUB/CNY
        updateExchangeRate("INR", "CNY", 860);  // 0.086 INR/CNY
        updateBricsRates();
        createPool("CNY", "BRICS");
        createPool("RUB", "BRICS");
        createPool("INR", "BRICS");

    }

    function getPoolKeybySymbol(string memory token0Symbol, string memory token1Symbol) public view returns (bytes32) {
        address token0 = tokenRegistry.getTokenAddress(token0Symbol);
        address token1 = tokenRegistry.getTokenAddress(token1Symbol);
        return token0 < token1 
            ? keccak256(abi.encodePacked(token0, token1))
            : keccak256(abi.encodePacked(token1, token0));
    }


    function createPool(string memory token0Symbol, string memory token1Symbol) public {
        address token0 = tokenRegistry.getTokenAddress(token0Symbol);
        address token1 = tokenRegistry.getTokenAddress(token1Symbol);
        require(token0 != address(0) && token1 != address(0), "Invalid token symbol");

        bytes32 poolKey = getPoolKeybySymbol(token0Symbol, token1Symbol);
        Pool storage newPool = pools[poolKey];
        require(newPool.token0 == address(0) && newPool.token1 == address(0), "Pool exists");

        newPool.token0 = token0;
        newPool.token1 = token1;
        newPool.token0OutPaused = true;
        newPool.token1OutPaused = true;

        emit PoolCreated(token0Symbol, token1Symbol);
    }

    function isPoolActive(bytes32 poolKey) public view returns (bool) {
        Pool storage pool = pools[poolKey];
        return pool.token0 != address(0) && 
            pool.token1 != address(0) && 
            !pool.token0OutPaused && 
            !pool.token1OutPaused;
    }

    function getAllPoolsAvailability() external view returns (
        string[] memory poolNames,
        uint256[] memory reserves0,
        uint256[] memory reserves1,
        bool[] memory isAvailable
    ) {
        uint256 poolCount = 0;
        string[] memory supportedTokens = tokenRegistry.getSupportedTokens();
        
        // First count how many pools exist (have tokens set)
        for (uint i = 0; i < supportedTokens.length; i++) {
            for (uint j = i + 1; j < supportedTokens.length; j++) {
                bytes32 poolKey = getPoolKeybySymbol(supportedTokens[i], supportedTokens[j]);
                Pool storage pool = pools[poolKey];
                if (pool.token0 != address(0) && pool.token1 != address(0)) {
                    poolCount++;
                }
            }
        }
        
        poolNames = new string[](poolCount * 2);
        reserves0 = new uint256[](poolCount);
        reserves1 = new uint256[](poolCount);
        isAvailable = new bool[](poolCount);

        uint256 currentIndex = 0;
        for (uint i = 0; i < supportedTokens.length; i++) {
            for (uint j = i + 1; j < supportedTokens.length; j++) {
                bytes32 poolKey = getPoolKeybySymbol(supportedTokens[i], supportedTokens[j]);
                Pool storage pool = pools[poolKey];
                if (pool.token0 != address(0) && pool.token1 != address(0)) {
                    poolNames[currentIndex * 2] = supportedTokens[i];
                    poolNames[currentIndex * 2 + 1] = supportedTokens[j];
                    reserves0[currentIndex] = pool.reserve0;
                    reserves1[currentIndex] = pool.reserve1;
                    isAvailable[currentIndex] = isPoolActive(poolKey);
                    currentIndex++;
                }
            }
        }
    }

    function updatePoolTokenStatus(bytes32 poolKey) internal {
        Pool storage pool = pools[poolKey];
        if(pool.reserve0 < minimumLiquidity) {
            pool.token0OutPaused = true;
        } else {
            pool.token0OutPaused = false;
        }
        if(pool.reserve1 < minimumLiquidity) {
            pool.token1OutPaused = true;
        } else {
            pool.token1OutPaused = false;
        }
    }


    function addLiquidity(
        string memory token0Symbol,
        string memory token1Symbol,
        uint256 amount0,
        uint256 amount1
        ) external nonReentrant returns (uint256 liquidity) {
        bytes32 poolKey = getPoolKeybySymbol(token0Symbol, token1Symbol);
        Pool storage pool = pools[poolKey];
        require(pool.token0 != address(0) && pool.token1 != address(0), "Pool does not exist");
        address BRICS = tokenRegistry.getTokenAddress("BRICS");
        
        // คำนวณค่าธรรมเนียมเป็น BRICS เก็บเพิ่ม ไม่ได้หักจากจน.ที่จะฝาก
        uint256 depositFee = pool.reserve0 <= minimumLiquidity * 3 || pool.reserve1 <= minimumLiquidity * 3 
            ? feeManager.lowFee() : feeManager.baseFee();
        uint256 depositFeeBrics = (getExchangeRate(token0Symbol, "BRICS") * depositFee) / RATE_PRECISION;

        // คำนวณ liquidity 
        if (pool.totalSupply == 0) {
            liquidity = feeManager.sqrt(amount0 * amount1) ; //(- minimumLiquidity) May not need to minus idk
        } else {
            uint256 liquidity0 = (amount0 * pool.totalSupply) / pool.reserve0;
            uint256 liquidity1 = (amount1 * pool.totalSupply) / pool.reserve1;
            liquidity = feeManager.min(liquidity0, liquidity1);
        }
        
        address token0 = tokenRegistry.getTokenAddress(token0Symbol);
        address token1 = tokenRegistry.getTokenAddress(token1Symbol);
        
        // โอนเหรียญและค่าธรรมเนียม
        require(IERC20(BRICS).transferFrom(msg.sender, feeManager.feeCollector(), depositFeeBrics), "Fee failed");
        require(IERC20(token0).transferFrom(msg.sender, address(this), amount0), "Transfer0 failed");
        require(IERC20(token1).transferFrom(msg.sender, address(this), amount1), "Transfer1 failed");
        
        pool.reserve0 += amount0;
        pool.reserve1 += amount1;
        pool.totalSupply += liquidity;
        pool.balances[msg.sender] += liquidity;
        updatePoolTokenStatus(poolKey);
        emit PoolOperation(token0Symbol, token1Symbol, amount0, amount1, liquidity, "add");
    }

    function removeLiquidity(
        string memory token0Symbol,
        string memory token1Symbol,
        uint256 amount0Desired,
        uint256 amount1Desired
        ) external nonReentrant returns (uint256 amount0, uint256 amount1) {
        string memory symbol0 = token0Symbol;
        string memory symbol1 = token1Symbol;
        Pool storage pool = pools[getPoolKeybySymbol(symbol0, symbol1)];
        require(isPoolActive(getPoolKeybySymbol(symbol0, symbol1)), "Pool not available");
        address token0 = tokenRegistry.getTokenAddress(symbol0);
        address token1 = tokenRegistry.getTokenAddress(symbol1);
        address BRICS = tokenRegistry.getTokenAddress("BRICS");
        
        uint256 liquidityToRemove;
        uint256 withdrawFeeBrics;
        if (token0 == BRICS) {
            // If BRICS is token0, swap the calculation order
            uint256 liquidity1 = (amount0Desired * pool.totalSupply) / pool.reserve1;
            uint256 liquidity0 = (amount1Desired * pool.totalSupply) / pool.reserve0;
            liquidityToRemove = feeManager.min(liquidity0, liquidity1);
            require(pool.balances[msg.sender] >= liquidityToRemove, "Insufficient liquidity");
            withdrawFeeBrics = (getExchangeRate(symbol1, "BRICS") * feeManager.baseFee()) / RATE_PRECISION;
            amount0 = (liquidityToRemove * pool.reserve1) / pool.totalSupply;
            amount1 = (liquidityToRemove * pool.reserve0) / pool.totalSupply;
        
        } else {
            uint256 liquidity0 = (amount0Desired * pool.totalSupply) / pool.reserve0;
            uint256 liquidity1 = (amount1Desired * pool.totalSupply) / pool.reserve1;
            liquidityToRemove = feeManager.min(liquidity0, liquidity1);
            require(pool.balances[msg.sender] >= liquidityToRemove, "Insufficient liquidity");
            withdrawFeeBrics = (getExchangeRate(symbol0, "BRICS") * feeManager.baseFee()) / RATE_PRECISION;
            amount0 = (liquidityToRemove * pool.reserve0) / pool.totalSupply;
            amount1 = (liquidityToRemove * pool.reserve1) / pool.totalSupply;
        }
        
        pool.balances[msg.sender] -= liquidityToRemove;
        pool.totalSupply -= liquidityToRemove;
        pool.reserve0 -= amount0;
        pool.reserve1 -= amount1;
        
        require(IERC20(token0).transfer(msg.sender, amount0), "Transfer0 failed");
        require(IERC20(token1).transfer(msg.sender, amount1), "Transfer1 failed");
        //ต้อง approve ด้วย
        require(IERC20(BRICS).transferFrom(msg.sender, feeManager.feeCollector(), withdrawFeeBrics), "Fee failed");
        updatePoolTokenStatus(getPoolKeybySymbol(symbol0, symbol1));
        emit PoolOperation(token0Symbol, token1Symbol, amount0, amount1, liquidityToRemove, "remove");
    }

    //Returns user's LP tokens and equivalent token amounts
    function getUserLiquidity(
        string memory token0Symbol,
        string memory token1Symbol
        ) public view returns (
            uint256 liquidityTokens,
            uint256 token0Amount,
            uint256 token1Amount
        ){
        bytes32 poolKey = getPoolKeybySymbol(token0Symbol, token1Symbol);
        Pool storage pool = pools[poolKey];
        
        liquidityTokens = pool.balances[msg.sender];
        token0Amount = (liquidityTokens * pool.reserve0) / pool.totalSupply;
        token1Amount = (liquidityTokens * pool.reserve1) / pool.totalSupply;
        }

    function _handleSwapFees(
        Pool storage pool,
        bool isBricsIn,
        string memory symbol
        ) internal view returns (uint256, uint256, uint256) {
        return feeManager.calculateSwapFees(
            pool.reserve0,
            pool.reserve1,
            !isBricsIn,
            isBricsIn ? getExchangeRate("BRICS", symbol) : getExchangeRate(symbol, "BRICS"));
        }

    function swap(
        string memory fromSymbol,
        string memory toSymbol, 
        uint256 amountIn,
        uint256 minAmountOut
        ) public nonReentrant returns (uint256 amountOut) {
        // Validations
        require(amountIn > 0, "Invalid amount");
        bytes32 poolKey = getPoolKeybySymbol(fromSymbol, toSymbol);
        Pool storage pool = pools[poolKey];
        require(isPoolActive(poolKey), "Pool not available");

        address BRICS = tokenRegistry.getTokenAddress("BRICS");
        bool isBricsIn = tokenRegistry.getTokenAddress(fromSymbol) == BRICS;
        if(isBricsIn) {
            require(!pool.token0OutPaused, "Token out paused");
        } else {
            require(!pool.token1OutPaused, "BRICS out paused");
        }
        // Calculate fees
        (uint256 totalFeeBrics, uint256 protocolFeeBrics, uint256 lpFeeBrics) =
            _handleSwapFees(pool, isBricsIn, isBricsIn ? toSymbol : fromSymbol);

        if(isBricsIn) {
            // Swap from BRICS: หักค่าธรรมเนียมจาก input
            uint256 amountAfterFee = amountIn - totalFeeBrics;
            amountOut = (amountAfterFee * getExchangeRate(fromSymbol, toSymbol)) / RATE_PRECISION;
            
            
            pool.reserve1 += (amountIn - protocolFeeBrics); // เพิ่ม input หักเฉพาะ protocol fee
            pool.reserve0 -= amountOut;
            
        } else {
            // Swap to BRICS: หักค่าธรรมเนียมจาก output
            amountOut = (amountIn * getExchangeRate(fromSymbol, toSymbol)) / RATE_PRECISION;
            amountOut -= totalFeeBrics;
            
            pool.reserve0 += amountIn;
            pool.reserve1 -= (amountOut + protocolFeeBrics);
        }

        require(amountOut >= minAmountOut, "Output below minimum");

        // Transfers
        address fromToken = tokenRegistry.getTokenAddress(fromSymbol);
        address toToken = tokenRegistry.getTokenAddress(toSymbol);

        require(IERC20(fromToken).transferFrom(msg.sender, address(this), amountIn), "Transfer in failed");
        require(IERC20(toToken).transfer(msg.sender, amountOut), "Transfer out failed");
        require(IERC20(BRICS).transfer(feeManager.feeCollector(), protocolFeeBrics), "Protocol fee failed");
        updatePoolTokenStatus(poolKey);
        emit PoolOperation(fromSymbol, toSymbol, amountIn, amountOut, 0, "swap");
    }

    function previewSwap(
        string memory fromSymbol,
        string memory toSymbol,
        uint256 amountIn
        ) external view returns (
        uint256 amountOut,
        uint256 totalFeeBrics,
        uint256 protocolFeeBrics,
        uint256 lpFeeBrics,
        uint256 suggestedMinAmountOut
        ) {
        bytes32 poolKey = getPoolKeybySymbol(fromSymbol, toSymbol);
        Pool storage pool = pools[poolKey];
        

        address BRICS = tokenRegistry.getTokenAddress("BRICS");
        bool isBricsIn = tokenRegistry.getTokenAddress(fromSymbol) == BRICS;

        // คำนวณค่าธรรมเนียม
        (totalFeeBrics, protocolFeeBrics, lpFeeBrics) = 
            _handleSwapFees(pool, isBricsIn, isBricsIn ? toSymbol : fromSymbol);

        if(isBricsIn) {
            // แลกจาก BRICS
            uint256 amountAfterFee = amountIn - totalFeeBrics;
            amountOut = (amountAfterFee * getExchangeRate(fromSymbol, toSymbol)) / RATE_PRECISION;
        } else {
            // แลกเป็น BRICS
            amountOut = (amountIn * getExchangeRate(fromSymbol, toSymbol)) / RATE_PRECISION;
            amountOut -= totalFeeBrics;
        }

        // แนะนำ minimum amount (-2%) ป้องกันการเปลี่ยนแปลงราคาตอนแลก
        suggestedMinAmountOut = (amountOut * 98) / 100;

        return (amountOut, totalFeeBrics, protocolFeeBrics, lpFeeBrics, suggestedMinAmountOut);
    }


    function updateExchangeRate(
        string memory token0Symbol,
        string memory token1Symbol,
        uint256 newRate
    ) public {
        address token0 = tokenRegistry.getTokenAddress(token0Symbol);
        address token1 = tokenRegistry.getTokenAddress(token1Symbol);

        uint256 currentRate = exchangeRates[token0][token1];
        if (currentRate > 0) {
            uint256 rateDiff = newRate > currentRate
                ? ((newRate - currentRate) * 10000) / currentRate
                : ((currentRate - newRate) * 10000) / currentRate;
            require(rateDiff <= 1000, "Rate change too high");
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

    function updateBricsRates() public {
        address bricsAddr = tokenRegistry.getTokenAddress("BRICS");
        address cnyAddr = tokenRegistry.getTokenAddress("CNY");
        uint256 bricsValueInCNY = calculateBricsValue(RATE_PRECISION);
        
        string[] memory tokens = tokenRegistry.getSupportedTokens();
        for(uint i = 0; i < tokens.length; i++) {
            string memory symbol = tokens[i];
            if(keccak256(bytes(symbol)) != keccak256(bytes("BRICS"))) {
                address tokenAddr = tokenRegistry.getTokenAddress(symbol);
                uint256 tokenToCNY = tokenAddr == cnyAddr ? RATE_PRECISION : exchangeRates[tokenAddr][cnyAddr];
                uint256 bricsToToken = (bricsValueInCNY * RATE_PRECISION) / tokenToCNY;
                
                exchangeRates[bricsAddr][tokenAddr] = bricsToToken;
                exchangeRates[tokenAddr][bricsAddr] = (RATE_PRECISION * RATE_PRECISION) / bricsToToken;
            }
        }
    }



}
