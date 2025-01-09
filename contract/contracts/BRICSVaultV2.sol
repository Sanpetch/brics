// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/token/ERC20/extensions/ERC4626.sol";
import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/token/ERC20/IERC20.sol";

interface IERC20Mintable is IERC20 {
    function mint(address to, uint256 amount) external;
    function burn(address from, uint256 amount) external;
}

contract BRICSVaultV2 is ERC4626 {
    struct VaultInfo {
        IERC20 asset;
        uint256 exchangeRate; // Scaled by 100 (2 decimal places)
        uint256 exchangeRateCNY; // Scaled by 100 (2 decimal places)
    }
    mapping(string => VaultInfo) public vaults;
    mapping(address => mapping(string => uint256)) public userDeposits; // Tracks deposits by user and token symbol
    mapping(string => uint256) public currencyWeights; // Weight of each currency in BRICS
    mapping(address => uint256) public userMintedBRICS; // Tracks total BRICS minted by each user
    mapping(string => uint256) public totalDeposits;

    uint256 public collateralRatio = 150;   // 150% กำหนดอัตราส่วนขั้นต่ำของ หลักประกัน ที่ผู้ใช้ต้องใส่เมื่อ Mint BRICS
    uint256 public liquidationRatio = 120;  // 120% กำหนดอัตราส่วนที่ต่ำที่สุดก่อนที่ระบบจะบังคับ Liquidation เพื่อป้องกันความเสี่ยง
    uint256 public totalMintedBRICS; // เก็บจำนวน BRICS ที่ถูก Mint ทั้งหมด
    address public vaultWalletAddress; // treasury
    //address public constant CNY = 0xd37BaD73F63e3725d364B65717d1c18e5186296f; // Used on Test network.
    address public constant CNY = 0x2b7fE14E8ee02AE8033437d458e28c644D4458Fe; // Repalce for test(local)
    address public constant RUB = 0x9876EEAf962ADfc612486C5D54BCb9D8B5e50878; // Used on Test network.
    address public constant INR = 0xe3077475D1219088cD002B75c8bB46567D7F37ae; // Used on Test network.

    constructor(IERC20 _asset) ERC4626(_asset) ERC20("BRICS", "vBRICS") {
        vaultWalletAddress = msg.sender;
        totalMintedBRICS = 0;

        vaults["CNY"] = VaultInfo({
            asset: IERC20(CNY), 
            exchangeRate: 2623,  // 1 BRICS = 0.2623 CNY
            exchangeRateCNY: 2623  // 1 BRICS = 0.2623 CNY
        });

        vaults["RUB"] = VaultInfo({
            asset: IERC20(RUB), 
            exchangeRate: 3590,   // 1 BRICS = 3.597 RUB
            exchangeRateCNY: 73  // 1 RUB = 0.073 CNY
        });

        vaults["INR"] = VaultInfo({
            asset: IERC20(INR), 
            exchangeRate: 3050 ,   // 1 BRICS = 3.05 INR
            exchangeRateCNY: 86   // 1 INR   = 0.086 CNY
        });

        vaults["BRICS"] = VaultInfo({
            asset: IERC20(_asset), 
            exchangeRate: 1, 
            exchangeRateCNY: 1  
        });

        currencyWeights["CNY"] = 20;
        currencyWeights["RUB"] = 50;
        currencyWeights["INR"] = 30;
    }

    event MintBRICS(address indexed user, string symbol, uint256 amount, uint256 bricsMinted);
    event RedeemBRICS(address indexed user, string symbol, uint256 bricsAmount, uint256 collateralReturned);
    event Liquidate(address indexed user, string symbol, uint256 tokensLiquidated);


    modifier onlyAdmin() {
        require(msg.sender == vaultWalletAddress, "Only admin can perform this action");
        _;
    }

    function setCollateralRatio(uint256 _ratio) external onlyAdmin {
        require(_ratio >= 100, "Collateral ratio must be at least 100%");
        collateralRatio = _ratio;
    }

    function setLiquidationRatio(uint256 _ratio) external onlyAdmin {
        require(_ratio >= 100, "Liquidation ratio must be at least 100%");
        liquidationRatio = _ratio;
    }

    function setExchangeRate(string memory symbol, uint256 rate) external onlyAdmin {
        require(rate > 0, "Rate must be greater than 0");
        require(address(vaults[symbol].asset) != address(0), "Token not supported");

        vaults[symbol].exchangeRate = rate;
    }

    function setExchangeRateCNY(string memory symbol, uint256 rateCNY) external onlyAdmin {
        require(rateCNY > 0, "Rate must be greater than 0");
        require(address(vaults[symbol].asset) != address(0), "Token not supported");

        vaults[symbol].exchangeRateCNY = rateCNY;
    }

    function getCollateralRatio() public view returns (uint256 currentCollateralRatio) {
        currentCollateralRatio = collateralRatio;
    }
    function getExchangeRate(string memory symbol) external view returns (uint256) {
        require(address(vaults[symbol].asset) != address(0), "Currency not supported");
        return vaults[symbol].exchangeRate;
    }

    
    /*  comment for limit bytes
    function addTokenVault(string memory symbol, IERC20 _asset, uint256 _exchangeRate) external {
        require(msg.sender == vaultWalletAddress, "Only admin can add token");
        require(address(vaults[symbol].asset) == address(0), "Token already added");
        require(_exchangeRate > 0, "Exchange rate must be greater than 0");

        require(
            keccak256(bytes(symbol)) == keccak256(bytes("CNY")) ||
            keccak256(bytes(symbol)) == keccak256(bytes("RUB")) ||
            keccak256(bytes(symbol)) == keccak256(bytes("INR")),
            "Unsupported currency"
        );

        vaults[symbol] = VaultInfo({
            asset: _asset,
            exchangeRate: _exchangeRate // 0.069 
        });
    }
    */
   
    // 1.1
    /* comment for limit bytes
    function setupCurrencyWeights(string[] memory symbols, uint256[] memory weights) external {
        require(msg.sender == vaultWalletAddress, "Only admin can setup weights");
        require(symbols.length == 3, "Must provide exactly 3 currencies");
        require(weights.length == 3, "Must provide exactly 3 weights");

        uint256 totalWeight = 0;

        for (uint256 i = 0; i < 3; i++) {
            string memory symbol = symbols[i];
            uint256 weight = weights[i];

            require(weight > 0 && weight <= 100, "Weight must be between 1 and 100");
            require(
                keccak256(bytes(symbol)) == keccak256(bytes("CNY")) ||
                keccak256(bytes(symbol)) == keccak256(bytes("RUB")) ||
                keccak256(bytes(symbol)) == keccak256(bytes("INR")),
                "Unsupported currency"
            );

            currencyWeights[symbol] = weight;
            totalWeight += weight;
        }

        require(totalWeight == 100, "Total weight must equal 100%");
    }

    function getTotalWeights() public view returns (uint256 cnyWeight, uint256 rubWeight, uint256 inrWeight) {
        cnyWeight = currencyWeights["CNY"];
        rubWeight = currencyWeights["RUB"];
        inrWeight = currencyWeights["INR"];
    }
    */
    // 3.     Deposit collateral and mint BRICS tokens
    /*
    20241226 used.
    */
    function depositCollateral(string memory symbol, uint256 amount) public {
        require(address(vaults[symbol].asset) != address(0), "Unsupported token");
        require(amount > 0, "Amount must be greater than 0");

        // ตรวจสอบการอนุมัติ
        uint256 allowance = vaults[symbol].asset.allowance(msg.sender, address(this));
        require(allowance >= amount, "Insufficient allowance, approve first");

        uint256 collateralValue = (amount * 10000) / vaults[symbol].exchangeRate;
        uint256 maxMintableBRICS = (collateralValue * 10000) / collateralRatio;
        require(maxMintableBRICS > 0, "Not enough collateral to mint BRICS");

        // Transfer collateral to the contract
        vaults[symbol].asset.transferFrom(msg.sender, address(this), amount);

        userDeposits[msg.sender][symbol] += amount;

        totalDeposits[symbol] += amount;

        _mint(msg.sender, maxMintableBRICS); // for redeem.

        IERC20Mintable(address(vaults["BRICS"].asset)).mint(msg.sender, maxMintableBRICS);

        userMintedBRICS[msg.sender] += maxMintableBRICS;
        totalMintedBRICS += maxMintableBRICS;
    }

    function previewDepositCollateral(string memory symbol, uint256 amount) public view returns (uint256 maxMintableBRICS) {
        require(address(vaults[symbol].asset) != address(0), "Unsupported token");
        require(amount > 0, "Amount must be greater than 0");

        VaultInfo storage vault = vaults[symbol];
        uint256 exchangeRate = vault.exchangeRate;

        uint256 collateralValue = (amount * 10000) / exchangeRate;
        maxMintableBRICS = (collateralValue * 10000) / collateralRatio;
    }

    function getUserDeposit(address user, string memory symbol) public view returns (uint256) {
        return userDeposits[user][symbol];
    }

    function getTotalDeposits(string memory symbol) public view returns (uint256) {
        require(address(vaults[symbol].asset) != address(0), "Unsupported token");
        return totalDeposits[symbol];
    }

    function getContractBalance(string memory symbol) public view returns (uint256) {
        require(address(vaults[symbol].asset) != address(0), "Unsupported token");
        return vaults[symbol].asset.balanceOf(address(this));
    }

    function getAllowance(string memory symbol, address owner, address spender) public view returns (uint256) {
        require(address(vaults[symbol].asset) != address(0), "Unsupported token");
        return vaults[symbol].asset.allowance(owner, spender);
    }

    function getTotalMintedBRICS() external view returns (uint256) {
        return totalMintedBRICS;
    }

    function redeemCollateral(string memory symbol, uint256 bricsAmount) public {
        require(bricsAmount > 0, "Redeem amount must be greater than zero");
        require(address(vaults[symbol].asset) != address(0), "Unsupported token");

        VaultInfo storage vault = vaults[symbol];
        uint256 exchangeRate = vault.exchangeRate;

        // Calculate the collateral amount to return
        uint256 collateralAmount = (bricsAmount * exchangeRate) / 10000;
        require(userDeposits[msg.sender][symbol] >= collateralAmount, "Insufficient collateral balance");

        // Transfer collateral back to the user
        vault.asset.transfer(msg.sender, collateralAmount);

        // Update user deposits
        userDeposits[msg.sender][symbol] -= collateralAmount;

        // Burn vBRICS tokens from the user
        _burn(msg.sender, bricsAmount);

        // Burn BRICS tokens from the user
        IERC20Mintable(address(vaults["BRICS"].asset)).burn(msg.sender, bricsAmount);

        // อัปเดตจำนวน BRICS ที่ผู้ใช้ Mint และลดค่าจาก totalMintedBRICS
        userMintedBRICS[msg.sender] -= bricsAmount;
        totalMintedBRICS -= bricsAmount;
    }

    function previewRedeem(string memory symbol, uint256 bricsAmount) public view returns (uint256 collateralAmount) {
        require(bricsAmount > 0, "Redeem amount must be greater than zero");
        require(address(vaults[symbol].asset) != address(0), "Unsupported token");

        VaultInfo storage vault = vaults[symbol];
        uint256 exchangeRate = vault.exchangeRate;

        collateralAmount = (bricsAmount * exchangeRate) / 10000;
    }

    function getEffectiveRatio(address user, string memory symbol) public view returns (uint256) {
        uint256 userDepositBalance = userDeposits[user][symbol];
        uint256 userBRICSMinted = userMintedBRICS[user];
        uint256 exchangeRate = vaults[symbol].exchangeRate;

        uint256 collateralValue = (userDepositBalance * 10000) / exchangeRate;
        return (collateralValue * 10000) / userBRICSMinted;
    }

    function liquidate(address user, string memory symbol) external onlyAdmin {
        require(address(vaults[symbol].asset) != address(0), "Unsupported token");

        uint256 userDepositBalance = userDeposits[user][symbol];
        require(userDepositBalance > 0, "No collateral to liquidate");

        uint256 bricsMinted = userMintedBRICS[user];
        uint256 exchangeRate = vaults[symbol].exchangeRate;

        // คำนวณมูลค่าหลักประกันจริงตาม Exchange Rate ปัจจุบัน
        uint256 actualCollateralValue = (userDepositBalance * 10000) / exchangeRate;

        // คำนวณมูลค่าหลักประกันที่ต้องมี
        uint256 requiredCollateralValue = (bricsMinted * liquidationRatio) / 100;

        require(actualCollateralValue < requiredCollateralValue, "No deficit to liquidate");

        // คำนวณส่วนที่ขาดของหลักประกัน
        uint256 deficitCollateralValue = requiredCollateralValue - actualCollateralValue;

        // คำนวณจำนวนโทเค็นที่ต้อง Liquidate
        uint256 tokensToLiquidate = (deficitCollateralValue * exchangeRate) / 10000;

        require(tokensToLiquidate <= userDepositBalance, "Not enough collateral to liquidate");

        // โอนหลักประกันที่ต้อง Liquidate ไปยัง vaultWalletAddress
        vaults[symbol].asset.transfer(vaultWalletAddress, tokensToLiquidate);

        // อัปเดตยอดเงินฝากของผู้ใช้
        userDeposits[user][symbol] -= tokensToLiquidate;
        totalDeposits[symbol] -= tokensToLiquidate;
    }

    function previewLiquidate(address user, string memory symbol) public view returns (uint256 bricsMinted, uint256 actualCollateralValue, uint256 requiredCollateralValue, uint256 deficitCollateralValue,  uint256 tokensToLiquidate) {
         require(address(vaults[symbol].asset) != address(0), "Unsupported token");

        uint256 userDepositBalance = userDeposits[user][symbol];
        require(userDepositBalance > 0, "No collateral to liquidate");

        bricsMinted = userMintedBRICS[user];
        uint256 exchangeRate = vaults[symbol].exchangeRate;

        // คำนวณมูลค่าหลักประกันจริงตาม Exchange Rate ปัจจุบัน
         actualCollateralValue = (userDepositBalance * 10000) / exchangeRate;

        // คำนวณมูลค่าหลักประกันที่ต้องมี
        requiredCollateralValue = (bricsMinted * liquidationRatio) / 100;
        
        deficitCollateralValue  = 0;
        if (actualCollateralValue >= requiredCollateralValue) {
            tokensToLiquidate = 0; // ไม่มีส่วนที่ขาด
        } else {
            // คำนวณส่วนที่ขาดของหลักประกัน
            deficitCollateralValue = requiredCollateralValue - actualCollateralValue;

            // คำนวณจำนวนโทเค็นที่ต้อง Liquidate
            tokensToLiquidate = (deficitCollateralValue * exchangeRate) / 10000;
        }
    }
}

// Concrete implementation for ERC4626
contract ConcreteVault is ERC4626 {
    constructor(IERC20 _asset, string memory name, string memory symbol)
        ERC4626(_asset)
        ERC20(name, symbol)
    {}
}
