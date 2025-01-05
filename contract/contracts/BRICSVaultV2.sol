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
    }

    mapping(string => VaultInfo) public vaults;
    mapping(address => mapping(string => uint256)) public userDeposits; // Tracks deposits by user and token symbol
    mapping(string => uint256) public currencyWeights; // Weight of each currency in BRICS
    mapping(string => uint256) public totalDeposits;

    uint256 public collateralRatio = 120; // 120%
    address public vaultWalletAddress;
    //address public constant CNY = 0xd37BaD73F63e3725d364B65717d1c18e5186296f; // Used on Test network.
    address public constant CNY = 0x928C0221CA29E42d1b3f820c8B3C43e5A3bF65Ef; // Repalce for test(local)
    address public constant RUB = 0x9876EEAf962ADfc612486C5D54BCb9D8B5e50878; // Used on Test network.
    address public constant INR = 0xe3077475D1219088cD002B75c8bB46567D7F37ae; // Used on Test network.

    // 0 
    constructor(IERC20 _asset) ERC4626(_asset) ERC20("BRICS", "vBRICS") {
        vaultWalletAddress = msg.sender;

        vaults["CNY"] = VaultInfo({
            asset: IERC20(CNY), 
            exchangeRate: 26  // 1 BRICS = 0.26 CNY
        });

        vaults["RUB"] = VaultInfo({
            asset: IERC20(RUB), 
            exchangeRate: 377   // 1 BRICS = 3.77 RUB
        });

        vaults["INR"] = VaultInfo({
            asset: IERC20(INR), 
            exchangeRate: 302  // 1 BRICS = 3.02 INR
        });

        vaults["BRICS"] = VaultInfo({
            asset: IERC20(_asset), 
            exchangeRate: 1  
        });

        currencyWeights["CNY"] = 20;
        currencyWeights["RUB"] = 50;
        currencyWeights["INR"] = 30;
    }

    modifier onlyAdmin() {
        require(msg.sender == vaultWalletAddress, "Only admin can perform this action");
        _;
    }

    // Set collateral ratio (only admin)
    function setCollateralRatio(uint256 _ratio) external onlyAdmin {
        require(_ratio >= 100, "Collateral ratio must be at least 100%");
        collateralRatio = _ratio;
    }

    function getCollateralRatio() public view returns (uint256 currentCollateralRatio) {
        currentCollateralRatio = collateralRatio;
    }

    // Set exchange rate (only admin)
    function setExchangeRate(string memory symbol, uint256 rate) external onlyAdmin {
        require(rate > 0, "Rate must be greater than 0");
        require(address(vaults[symbol].asset) != address(0), "Token not supported");

        vaults[symbol].exchangeRate = rate;
    }

    function getExchangeRate(string memory symbol) external view returns (uint256) {
        require(address(vaults[symbol].asset) != address(0), "Currency not supported");
        return vaults[symbol].exchangeRate;
    }

    function addTokenVault(string memory symbol, IERC20 _asset, uint256 _exchangeRate) external {
        require(msg.sender == vaultWalletAddress, "Only admin can add token");
        require(address(vaults[symbol].asset) == address(0), "Token already added");
        require(_exchangeRate > 0, "Exchange rate must be greater than 0");

        //Only
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
   
    
   
    // 1.1
    /*
        uint256;
        weights[0] = 20;
        weights[1] = 50;
        weights[2] = 30;
        
        ["CNY","RUB","INR"]
        [20,50,30]
    */
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


    // Must be equal 100%
    function getTotalWeights() public view returns (uint256 cnyWeight, uint256 rubWeight, uint256 inrWeight) {
        cnyWeight = currencyWeights["CNY"];
        rubWeight = currencyWeights["RUB"];
        inrWeight = currencyWeights["INR"];
    }

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

        // Transfer collateral to the contract
        vaults[symbol].asset.transferFrom(msg.sender, address(this), amount);

        // Update user deposits
        userDeposits[msg.sender][symbol] += amount;

        // อัปเดตยอดรวมของโทเค็นที่ถูกฝาก
        totalDeposits[symbol] += amount;

        // Calculate the maximum mintable amount of BRICS
        uint256 collateralValue = (amount * 100) / vaults[symbol].exchangeRate;
        uint256 maxMintableBRICS = (collateralValue * 100) / collateralRatio;

        require(maxMintableBRICS > 0, "Not enough collateral to mint BRICS");

        // Mint vBRICS tokens
        _mint(msg.sender, maxMintableBRICS); // for redeem.

        // Mint BRICS ให้ผู้ใช้ (หลังหักค่าธรรมเนียม)
        IERC20Mintable(address(vaults["BRICS"].asset)).mint(msg.sender, maxMintableBRICS);
    }

    function previewDepositCollateral(string memory symbol, uint256 amount) public view returns (uint256 maxMintableBRICS) {
        require(address(vaults[symbol].asset) != address(0), "Unsupported token");
        require(amount > 0, "Amount must be greater than 0");

        VaultInfo storage vault = vaults[symbol];
        uint256 exchangeRate = vault.exchangeRate;

        // Calculate the maximum mintable amount of BRICS
        uint256 collateralValue = (amount * 100) / exchangeRate;
        maxMintableBRICS = (collateralValue * 100) / collateralRatio;
    }

    // View user-specific deposits.  20241226 used.
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

    function redeemCollateral(string memory symbol, uint256 bricsAmount) public {
        require(bricsAmount > 0, "Redeem amount must be greater than zero");
        require(address(vaults[symbol].asset) != address(0), "Unsupported token");

        VaultInfo storage vault = vaults[symbol];
        uint256 exchangeRate = vault.exchangeRate;

        // Calculate the collateral amount to return
        uint256 collateralAmount = (bricsAmount * exchangeRate) / 100;
        require(userDeposits[msg.sender][symbol] >= collateralAmount, "Insufficient collateral balance");


        // Transfer collateral back to the user
        vault.asset.transfer(msg.sender, collateralAmount);

        // Update user deposits
        userDeposits[msg.sender][symbol] -= collateralAmount;

        // Burn vBRICS tokens from the user
        _burn(msg.sender, bricsAmount);

        // Burn BRICS tokens from the user
        IERC20Mintable(address(vaults["BRICS"].asset)).burn(msg.sender, bricsAmount);
    }

    // Preview the amount of collateral for redeeming BRICS tokens
    function previewRedeem(string memory symbol, uint256 bricsAmount) public view returns (uint256 collateralAmount) {
        require(bricsAmount > 0, "Redeem amount must be greater than zero");
        require(address(vaults[symbol].asset) != address(0), "Unsupported token");

        VaultInfo storage vault = vaults[symbol];
        uint256 exchangeRate = vault.exchangeRate;

        // Calculate the collateral amount to return
        collateralAmount = (bricsAmount * exchangeRate) / 100;
    }



    // ตรวจสอบ Effective Ratio และบังคับถอนหากต่ำกว่า 100%
    function checkAndForceWithdraw(address user, string memory symbol) public onlyAdmin {
        require(address(vaults[symbol].asset) != address(0), "Unsupported token");
        
        uint256 userDepositBalance = userDeposits[user][symbol];
        require(userDepositBalance > 0, "No collateral to check");

        VaultInfo storage vault = vaults[symbol];
        uint256 exchangeRate = vault.exchangeRate;

        // คำนวณ Effective Ratio ของผู้ใช้
        uint256 collateralValue = (userDepositBalance * 100) / exchangeRate;
        uint256 effectiveRatio = (collateralValue * 100) / collateralRatio;

        if (effectiveRatio < 100) {
            forcedWithdraw(user, symbol);
        }
    }
        
    // ฟังก์ชันบังคับถอน (Forced Withdraw) เมื่อ Effective Ratio ต่ำกว่า 100%
    function forcedWithdraw(address user, string memory symbol) public onlyAdmin {
        require(address(vaults[symbol].asset) != address(0), "Unsupported token");
        
        uint256 userDepositBalance = userDeposits[user][symbol];
        require(userDepositBalance > 0, "No collateral to withdraw");

        VaultInfo storage vault = vaults[symbol];
        uint256 exchangeRate = vault.exchangeRate;

        // คำนวณจำนวน BRICS ที่ต้อง Burn
        uint256 bricsAmount = (userDepositBalance * 100) / exchangeRate;

        // Burn BRICS จากผู้ใช้
        _burn(user, bricsAmount);
        IERC20Mintable(address(vaults["BRICS"].asset)).burn(user, bricsAmount);

        // โอนหลักประกันคืนให้ผู้ใช้
        vault.asset.transfer(user, userDepositBalance);

        // อัปเดตยอดเงินฝากของผู้ใช้
        userDeposits[user][symbol] = 0;
    }

    // Preview forced withdraw: คำนวณจำนวนหลักประกันและ BRICS ที่ต้อง Burn
    function previewForcedWithdraw(address user, string memory symbol) public view returns (uint256 collateralAmount, uint256 bricsAmount) {
        require(address(vaults[symbol].asset) != address(0), "Unsupported token");

        uint256 userDepositBalance = userDeposits[user][symbol];
        require(userDepositBalance > 0, "No collateral to withdraw");

        VaultInfo storage vault = vaults[symbol];
        uint256 exchangeRate = vault.exchangeRate;

        // คำนวณจำนวน BRICS ที่ต้อง Burn
        bricsAmount = (userDepositBalance * 100) / exchangeRate;

        // จำนวนหลักประกันทั้งหมดที่จะคืนให้ผู้ใช้
        collateralAmount = userDepositBalance;
    }
}

// Concrete implementation for ERC4626
contract ConcreteVault is ERC4626 {
    constructor(IERC20 _asset, string memory name, string memory symbol)
        ERC4626(_asset)
        ERC20(name, symbol)
    {}
}
