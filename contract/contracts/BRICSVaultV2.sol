// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/token/ERC20/extensions/ERC4626.sol";
import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/token/ERC20/IERC20.sol";

interface IERC20Mintable is IERC20 {
    function mint(address to, uint256 amount) external;
}

contract BRICSVaultV2 is ERC4626 {
    struct VaultInfo {
        IERC20 asset;
        uint256 exchangeRate; // Rate in CNY * 1000 for precision
    }

    mapping(string => VaultInfo) public vaults;
    mapping(address => mapping(string => uint256)) public userDeposits; // Tracks deposits by user and token symbol
    mapping(string => uint256) public currencyWeights; // Weight of each currency in BRICS
    address public vaultWalletAddress;
    uint256 public collateralRatio = 150; // 150%
    uint256 public constant FEE_RATE = 1; // 0.01% (1/10000)
    // เก็บค่าธรรมเนียมใน Vault กลาง
    mapping(string => uint256) public feeReserves;

    mapping(string => uint256) public totalDeposits;


    //address public constant CNY = 0xd37BaD73F63e3725d364B65717d1c18e5186296f; use for real.
    address public constant CNY = 0xe2899bddFD890e320e643044c6b95B9B0b84157A;
    address public constant RUB = 0x9876EEAf962ADfc612486C5D54BCb9D8B5e50878; // Used on Test network.
    address public constant INR = 0xe3077475D1219088cD002B75c8bB46567D7F37ae; // Used on Test network.

    // 0 
    constructor(IERC20 _asset) ERC4626(_asset) ERC20("BRICS", "vBRICS") {
        vaultWalletAddress = msg.sender;

        vaults["CNY"] = VaultInfo({
            asset: IERC20(CNY), 
            exchangeRate: 1000  // 1 CNY = 1 CNY (scaled by 1000)
        });

        vaults["RUB"] = VaultInfo({
            asset: IERC20(RUB), 
            exchangeRate: 69   // 1 RUB = 0.069 CNY
        });

        vaults["INR"] = VaultInfo({
            asset: IERC20(INR), 
            exchangeRate: 12  // 1 INR = 0.012 CNY
        });

        vaults["BRICS"] = VaultInfo({
            asset: IERC20(_asset), 
            exchangeRate: 1  
        });
        

        currencyWeights["CNY"] = 20;
        currencyWeights["RUB"] = 50;
        currencyWeights["INR"] = 30;
    }

    // 1 _exchangeRate for CNY
    /*
    vault.addTokenVault("CNY", CNY_ERC20_Address, 1000); // 1 CNY = 1 CNY
    vault.addTokenVault("RUB", RUB_ERC20_Address, 69);   // 1 RUB = 0.069 CNY
    vault.addTokenVault("INR", INR_ERC20_Address, 12);   // 1 INR = 0.012 CNY
    */
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
   
    // 1.1 Set the exchange rate for a specific token
    function setExchangeRate(string memory symbol, uint256 rate) external {
        require(msg.sender == vaultWalletAddress, "Only admin can set exchange rate");
        require(rate > 0, "Rate must be greater than 0");
        require(address(vaults[symbol].asset) != address(0), "Token not supported");

        vaults[symbol].exchangeRate = rate; // 0.069
    }

    function getExchangeRate(string memory symbol) external view returns (uint256) {
        require(address(vaults[symbol].asset) != address(0), "Currency not supported");
        return vaults[symbol].exchangeRate;
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
        require(vaults[symbol].exchangeRate > 0, "Invalid exchange rate");
        require(currencyWeights[symbol] > 0, "Weight not set for token");

        // ตรวจสอบการอนุมัติ
        uint256 allowance = vaults[symbol].asset.allowance(msg.sender, address(this));
        require(allowance >= amount, "Insufficient allowance, approve first");

        // Transfer collateral to the contract
        vaults[symbol].asset.transferFrom(msg.sender, address(this), amount);

        // Update user deposits
        userDeposits[msg.sender][symbol] += amount;

        // อัปเดตยอดรวมของโทเค็นที่ถูกฝาก
        totalDeposits[symbol] += amount;

        // Calculate the value in CNY and apply the weight
        uint256 cnyValue = (amount * vaults[symbol].exchangeRate) / 1000;

        // คำนวณค่าธรรมเนียม 0.01%
        uint256 fee = (cnyValue * FEE_RATE) / 10000;

        // Apply the collateral ratio to determine the BRICS to mint
        uint256 bricsToMint = cnyValue  - fee;
        require(bricsToMint > 0, "Not enough collateral to mint BRICS");

        // เก็บค่าธรรมเนียมไว้ใน Vault กลาง
        feeReserves[symbol] += fee;
        // Mint BRICS tokens
        //_mint(msg.sender, bricsToMint);

        // Mint BRICS ให้ผู้ใช้ (หลังหักค่าธรรมเนียม)
        IERC20Mintable(address(vaults["BRICS"].asset)).mint(msg.sender, bricsToMint);

        // Mint ค่าธรรมเนียม BRICS ให้เจ้าของสัญญา
        IERC20Mintable(address(vaults["BRICS"].asset)).mint(vaultWalletAddress, fee);
    }

    function previewDeposit(string memory symbol, uint256 amount) public view returns (uint256 bricsToMint) {
        require(address(vaults[symbol].asset) != address(0), "Unsupported token");
        require(vaults[symbol].exchangeRate > 0, "Invalid exchange rate");
        require(currencyWeights[symbol] > 0, "Weight not set for token");

        // Calculate the value in CNY and apply the weight
        uint256 cnyValue = (amount * vaults[symbol].exchangeRate) / 1000;

        bricsToMint = cnyValue;
    }

    // View user-specific deposits.  20241226 used.
    function getUserDeposit(address user, string memory symbol) public view returns (uint256) {
        return userDeposits[user][symbol];
    }

    function getTotalDeposits(string memory symbol) public view returns (uint256) {
        require(address(vaults[symbol].asset) != address(0), "Unsupported token");
        return totalDeposits[symbol];
    }


    // Calculate the value of 1 BRICS in CNY
    function calculateBRICSValueInCNY() public view returns (uint256) {
        /*
        uint256 valueInCNY = (currencyWeights["CNY"] * 1000) +
                             (currencyWeights["RUB"] * vaults["RUB"].exchangeRate) / 1000 +
                             (currencyWeights["BRL"] * vaults["BRL"].exchangeRate) / 1000;
        */
        uint256 valueInCNY = (currencyWeights["CNY"]) +
                             (currencyWeights["RUB"] * vaults["RUB"].exchangeRate) +
                             (currencyWeights["BRL"] * vaults["BRL"].exchangeRate);
        return valueInCNY;
    }


    // Redeem BRICS tokens for collateral
    /*
    function redeemBRICS(uint256 bricsAmount, string[] memory symbols) public {
        uint256 requiredCNYValue = (bricsAmount * collateralRatio * calculateBRICSValueInCNY()) / 100;

        uint256 remainingCNYValue = requiredCNYValue;

        for (uint256 i = 0; i < symbols.length; i++) {
            string memory symbol = symbols[i];
            VaultInfo memory vault = vaults[symbol];
            require(address(vault.asset) != address(0), "Unsupported token");

            uint256 availableCNYValue = (vault.asset.balanceOf(address(this)) * vault.exchangeRate) / 1000;

            uint256 toRedeem = availableCNYValue > remainingCNYValue
                ? (remainingCNYValue * 1000) / vault.exchangeRate
                : vault.asset.balanceOf(address(this));

            vault.asset.transfer(msg.sender, toRedeem);
            remainingCNYValue -= (toRedeem * vault.exchangeRate) / 1000;

            if (remainingCNYValue == 0) break;
        }

        require(remainingCNYValue == 0, "Insufficient collateral to redeem");

        // Burn BRICS tokens
        _burn(msg.sender, bricsAmount);
    }
    */

    

    // Redeem BRICS tokens for a specific collateral
    function redeem(uint256 bricsAmount, string memory symbol) public {
        require(bricsAmount > 0, "Redeem amount must be greater than zero");
        require(address(vaults[symbol].asset) != address(0), "Unsupported token");

        VaultInfo storage vault = vaults[symbol];
        uint256 value_BRICS_in_CNY = calculateBRICSValueInCNY();
        uint256 requiredCNYValue = (bricsAmount * collateralRatio * value_BRICS_in_CNY) / 100;

        // Calculate the amount of the specific collateral to redeem
        uint256 collateralAmount = (requiredCNYValue * 1000) / vault.exchangeRate;

        // Ensure the contract has enough collateral to redeem
        uint256 contractBalance = vault.asset.balanceOf(address(this));
        require(contractBalance >= collateralAmount, "Insufficient collateral in vault");

        // Transfer the collateral to the user
        vault.asset.transfer(msg.sender, collateralAmount);

        // Burn BRICS tokens
        _burn(msg.sender, bricsAmount);
    }

    // Preview the amount of collateral for redeeming BRICS tokens
    function previewRedeem(uint256 bricsAmount, string memory symbol) public view returns (uint256 collateralAmount) {
        require(bricsAmount > 0, "Redeem amount must be greater than zero");
        require(address(vaults[symbol].asset) != address(0), "Unsupported token");

        uint256 value_BRICS_in_CNY = calculateBRICSValueInCNY();
        uint256 requiredCNYValue = (bricsAmount * collateralRatio * value_BRICS_in_CNY) / 100;

        // Calculate the amount of the specific collateral
        VaultInfo storage vault = vaults[symbol];
        collateralAmount = (requiredCNYValue * 1000) / vault.exchangeRate;
    }


    // Withdraw a specific collateral token
    function withdraw(string memory symbol, uint256 amount) public {
        require(amount > 0, "Withdrawal amount must be greater than zero");
        require(address(vaults[symbol].asset) != address(0), "Unsupported token");
        require(userDeposits[msg.sender][symbol] >= amount, "Insufficient deposited amount");

        // Reduce the user's deposit balance
        userDeposits[msg.sender][symbol] -= amount;

        // Transfer the token back to the user
        vaults[symbol].asset.transfer(msg.sender, amount);
    }


    // Preview the maximum amount of collateral the user can withdraw
    function previewWithdraw(string memory symbol, address user) public view returns (uint256 maxWithdrawAmount) {
        require(address(vaults[symbol].asset) != address(0), "Unsupported token");
        maxWithdrawAmount = userDeposits[user][symbol];
    }

}

// Concrete implementation for ERC4626
contract ConcreteVault is ERC4626 {
    constructor(IERC20 _asset, string memory name, string memory symbol)
        ERC4626(_asset)
        ERC20(name, symbol)
    {}
}
