// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

//import "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
// After import from  @openzeppelin then can't deploy.

import "./BRICSToken.sol"; // BRICS
import "./BRLCBDCToken.sol"; // BRL
import "./RUBCBDCToken.sol"; // RUB
import "./INRCBDCToken.sol"; // INR
import "./CNYCBDCToken.sol"; // CNY
import "./ZARCBDCToken.sol"; // ZAR
import "./USDCBDCToken.sol"; // USD

contract BRICSVault {
    address public adminAddress;  // Admin, Address ที่จะได้รับค่าธรรมเนียม + อื่นๆ
    //address payable public vaultOwner;

    BRICSToken public bricsToken;
    BRLCBDCToken public brlToken;
    RUBCBDCToken public rubToken;
    INRCBDCToken public inrToken;
    CNYCBDCToken public cnyToken;
    ZARCBDCToken public zarToken;
    USDCBDCToken public usdToken;

    uint256 public stabilityFeeRate = 50; // 0.5% (คิดในหน่วย 0.01%) > stabilityFeeRate จะถูกเก็บในรูปของ 0.01% เพื่อให้สามารถรองรับค่าธรรมเนียมต่ำกว่า 1% ได้
    uint256 public inventiveFee = 25; // 0.25% (คิดในหน่วย 0.01%)

    mapping(string => ERC20) public cbdcTokens; // Mapping ของสกุลเงิน CBDC
    mapping(string => uint256) public exchangeRates; // อัตราแลกเปลี่ยนของ CBDC เป็น USD * 1000 for precision
    mapping(string => uint256) public goldExchangeRates; // อัตราแลกเปลี่ยน CBDC เป็นทองคำ (กรัม)
    mapping(address => mapping(string => uint256)) public collateralBalance; // User -> CBDC Symbol -> Balance

    uint256 public collateralRatio = 150; // 150% Collateral Requirement

    constructor(address _BRICS_Address, 
                address _BRL_Address,
                address _RUB_Address,
                address _INR_Address,
                address _CNY_Address,
                address _ZAR_Address,
                address _USD_Address
    ) {
        bricsToken =  BRICSToken(_BRICS_Address);
        brlToken   =  BRLCBDCToken(_BRL_Address);
        rubToken   =  RUBCBDCToken(_RUB_Address);
        inrToken   =  INRCBDCToken(_INR_Address);
        cnyToken   =  CNYCBDCToken(_CNY_Address);
        zarToken   =  ZARCBDCToken(_ZAR_Address);
        usdToken   =  USDCBDCToken(_USD_Address);

        cbdcTokens["BRL"] = brlToken;
        cbdcTokens["RUB"] = rubToken;
        cbdcTokens["INR"] = inrToken;
        cbdcTokens["CNY"] = cnyToken;
        cbdcTokens["ZAR"] = zarToken;
        cbdcTokens["USD"] = usdToken;

        adminAddress = msg.sender; // กำหนด Admin เป็นผู้ Deploy Contract
        //vaultOwner = payable(msg.sender);
       
       //อัตราแลกเปลี่ยนเริ่มต้น
        exchangeRates["CNY"] = 140;  // 1 CNY = 0.14 USD
        exchangeRates["RUB"] = 10;   // 1 RUB = 0.01 USD
        exchangeRates["INR"] = 12;   // 1 INR = 0.012 USD
        exchangeRates["BRL"] = 200;  // 1 BRL = 0.20 USD
        exchangeRates["ZAR"] = 50;   // 1 ZAR = 0.05 USD
        exchangeRates["USD"] = 1000; // 1 USD = 1.00 USD
    }


     // ฟังก์ชันตั้งค่าอัตราแลกเปลี่ยน
    function setGoldExchangeRate(string memory symbol, uint256 rate) public {
        require(msg.sender == adminAddress, "Only fee Admin can update the fee rate");
        require(rate > 0, "Rate must be greater than 0");
        require(exchangeRates[symbol] > 0, "Unsupported CBDC");

        // อัตราแลกเปลี่ยน CBDC -> กรัมทองคำ
        goldExchangeRates[symbol] = rate;
        //goldExchangeRates["CNY"] = 430; // 1 กรัมทองคำ = 430 CNY
        //goldExchangeRates["RUB"] = 4800; // 1 กรัมทองคำ = 4800 RUB
        //goldExchangeRates["INR"] = 5000; // 1 กรัมทองคำ = 5000 INR
    }

    // ฟังก์ชันตั้งค่าอัตราแลกเปลี่ยน
    function setExchangeRate(string memory symbol, uint256 rate) public {
        require(msg.sender == adminAddress, "Only fee Admin can update the fee rate");
        require(rate > 0, "Rate must be greater than 0");
        require(exchangeRates[symbol] > 0, "Unsupported CBDC");
        exchangeRates[symbol] = rate;
    }

    // ฟังก์ชันตรวจสอบ Admin
    function getAdmin() public view returns (address) {
        return adminAddress;
    }

    // ตั้งค่า Stability Fee
    function setStabilityFeeRate(uint256 newRate) public {
        require(msg.sender == adminAddress, "Only fee Admin can update the fee rate");
        require(newRate <= 10000, "Fee rate must not exceed 100%"); // ป้องกันค่าที่เกินขอบเขต
        stabilityFeeRate = newRate;
    }

    // Deposit collateral and mint BRICS token
    function depositCollateral(string[] memory symbols, uint256[] memory amounts) public {
        require(symbols.length == amounts.length, "Mismatched symbols and amounts");

        uint256 totalUsdValue = 0;

        for (uint256 i = 0; i < symbols.length; i++) {
            string memory symbol = symbols[i];
            uint256 amount = amounts[i];

            require(exchangeRates[symbol] > 0, "Unsupported CBDC");
            require(cbdcTokens[symbol] != ERC20(address(0)), "Unsupported CBDC token");

            // ตรวจสอบ Allowance
            uint256 allowance = cbdcTokens[symbol].allowance(msg.sender, address(this));
            require(allowance >= amount, "Insufficient allowance for token");

            // โอน CBDC เข้าสู่ Vault
            cbdcTokens[symbol].transferFrom(msg.sender, address(this), amount);

            // คำนวณมูลค่าใน USD
            uint256 usdValue = (amount * exchangeRates[symbol]) / 1000;
            totalUsdValue += usdValue;

            // บันทึก Collateral ของผู้ใช้
            collateralBalance[msg.sender][symbol] += amount;
        }

        // คำนวณ BRICS Token ที่จะออก
        uint256 bricsToMint = (totalUsdValue * 100) / collateralRatio;
        require(bricsToMint > 0, "Not enough collateral value to mint BRICS");

        // Mint BRICS Token
        bricsToken.mint(msg.sender, bricsToMint);
    }

    /*
    function liquidate(address user) public {
        uint256 userCollateralValue = userCollateral[user];
        uint256 userBricsBalance = bricsToken.balanceOf(user);

        uint256 collateralRatio = (userCollateralValue * 100) / userBricsBalance;
        require(collateralRatio < 150, "User collateral ratio is safe");

        // คำนวณจำนวน BRICS ที่ต้อง Liquidate
        uint256 bricsToLiquidate = (userBricsBalance * (150 - collateralRatio)) / 150;

        // ขาย RUB เพื่อคืน BRICS
        uint256 rubToSell = (bricsToLiquidate * 1000) / exchangeRates["RUB"];
        rubToken.transferFrom(address(this), adminAddress, rubToSell);

        // Burn BRICS ที่ถูก Liquidate
        bricsToken.burn(user, bricsToLiquidate);

        // อัปเดต Collateral
        userCollateral[user] -= rubToSell * exchangeRates["RUB"] / 1000;
    }


    function checkCollateralRatio(address user) public view returns (uint256 collateralRatio) {
        uint256 userCollateralValue = userCollateral[user];
        uint256 userBricsBalance = bricsToken.balanceOf(user);

        if (userBricsBalance == 0) return 0;
        return (userCollateralValue * 100) / userBricsBalance;
    }
    */
   
    /**
     * @dev Withdraw/redeem common workflow.
    function _withdraw(
        address caller,
        address receiver,
        address owner,
        uint256 assets,
        uint256 shares
    ) internal virtual {
        if (caller != owner) {
            _spendAllowance(owner, caller, shares);
        }

        // If _asset is ERC-777, `transfer` can trigger a reentrancy AFTER the transfer happens through the
        // `tokensReceived` hook. On the other hand, the `tokensToSend` hook, that is triggered before the transfer,
        // calls the vault, which is assumed not malicious.
        //
        // Conclusion: we need to do the transfer after the burn so that any reentrancy would happen after the
        // shares are burned and after the assets are transferred, which is a valid state.
        _burn(owner, shares);
        SafeERC20.safeTransfer(_asset, receiver, assets);

        emit Withdraw(caller, receiver, owner, assets, shares);
    }

    function redeem(uint256 shares, address receiver, address owner) public virtual returns (uint256) {
        uint256 maxShares = maxRedeem(owner);
        if (shares > maxShares) {
            revert ERC4626ExceededMaxRedeem(owner, shares, maxShares);
        }

        uint256 assets = previewRedeem(shares);
        _withdraw(_msgSender(), receiver, owner, assets, shares);

        return assets;
    }
    */



    // Redeem BRICS token and return collateral
    function redeemBRICS(uint256 bricsAmount) public {
        uint256 requiredUsdValue = (bricsAmount * collateralRatio) / 100;

        uint256 totalCollateralValue = getUserCollateralValue(msg.sender);
        require(totalCollateralValue >= requiredUsdValue, "Insufficient collateral to redeem");

        // Burn BRICS token
        bricsToken.burn(msg.sender, bricsAmount);

        // คืน Collateral ตามสัดส่วน
        string[6] memory supportedSymbols = ["CNY", "RUB", "INR", "BRL", "ZAR", "USD"];
        uint256 remainingUsdValue = requiredUsdValue;
        uint256 usdValue = 0;
        uint256 toReturn = 0;
        for (uint256 i = 0; i < supportedSymbols.length; i++) {
            string memory symbol = supportedSymbols[i];
            uint256 userBalance = collateralBalance[msg.sender][symbol];
            
            if (userBalance > 0) {
                usdValue = (userBalance * exchangeRates[symbol]) / 1000;
                toReturn = (remainingUsdValue * userBalance) / totalCollateralValue;

                if (toReturn > userBalance) {
                    toReturn = userBalance;
                }

                remainingUsdValue -= (toReturn * exchangeRates[symbol]) / 1000;

                collateralBalance[msg.sender][symbol] -= toReturn;

                // โอนคืนให้ผู้ใช้
                cbdcTokens[symbol].transfer(msg.sender, toReturn);

                if (remainingUsdValue == 0) break;
            }
        }

        require(remainingUsdValue == 0, "Failed to return full collateral");
    }

    function redeemBRICSV1(uint256 bricsAmount) public {
        uint256 requiredCollateral = (bricsAmount * collateralRatio) / 100;
        require(getUserCollateralValue(msg.sender) >= requiredCollateral, "Insufficient collateral to redeem");
 
        // คำนวณ Stability Fee
        uint256 stabilityFee = (bricsAmount * stabilityFeeRate) / 10000;
        uint256 totalBricsToBurn = bricsAmount + stabilityFee;
 
        // ตรวจสอบยอดคงเหลือของ BRICS Token
        require(bricsToken.balanceOf(msg.sender) >= totalBricsToBurn, "Insufficient BRICS balance");
 
        // Burn BRICS Token และส่ง Stability Fee ให้กับ feeRecipient
        //bricsToken.transferFrom(msg.sender, feeRecipient, stabilityFee); // เก็บ Stability Fee
        bricsToken.burn(msg.sender, bricsAmount); // Burn เฉพาะจำนวน BRICS จริงที่ต้องการแลกเปลี่ยน
 
        // คืน Collateral กลับไปยัง collateralBalance ของผู้ใช้
        uint256 collateralToReturn = requiredCollateral;
        string[6] memory cbdcSymbols = ["CNY", "RUB", "INR", "BRL", "ZAR", "USD"];
 
        for (uint256 i = 0; i < cbdcSymbols.length; i++) {
            string memory cbdcSymbol = cbdcSymbols[i];
            uint256 userBalance = collateralBalance[msg.sender][cbdcSymbol];
            if (userBalance > 0) {
                uint256 withdrawAmount = (userBalance * collateralToReturn) / getUserCollateralValue(msg.sender);
                if (withdrawAmount > userBalance) {
                    withdrawAmount = userBalance;
                }
 
                collateralBalance[msg.sender][cbdcSymbol] -= withdrawAmount;
                collateralToReturn -= withdrawAmount;
 
                if (collateralToReturn == 0) break;
            }
        }
 
        require(collateralToReturn == 0, "Failed to fully return collateral");
    }



    // Utility: คำนวณมูลค่าหลักประกัน
    
    // Calculate total collateral value in USD for a user
    function getUserCollateralValue(address user) public view returns (uint256 totalUsdValue) {
        string[6] memory supportedSymbols = ["CNY", "RUB", "INR", "BRL", "ZAR", "USD"];
        for (uint256 i = 0; i < supportedSymbols.length; i++) {
            string memory symbol = supportedSymbols[i];
            uint256 userBalance = collateralBalance[user][symbol];
            if (userBalance > 0) {
                totalUsdValue += (userBalance * exchangeRates[symbol]) / 1000;
            }
        }
    }

    // ตรวจสอบ Collateral ของผู้ใช้
    function getUserCollateral(address user, string memory symbol) public view returns (uint256) {
        return collateralBalance[user][symbol];
    }

    // ตรวจสอบ มูลค่า USD ของ Collateral ทั้งหมดของผู้ใช้:
    function getUserCollateralInUsd(address user) public view returns (uint256) {
        return getUserCollateralValue(user);
    }


    // ตรวจสอบ Allowance
    function checkAllowance(address token, address owner, uint256 amount) internal view {
        require(ERC20(token).allowance(owner, address(this)) >= amount, "Insufficient allowance");
    }

    function getAllowance(address token, address owner) public view returns (uint256) {
        return ERC20(token).allowance(owner, address(this));
    }

    // โอนโทเคน
    function transferTokens(address token, address from, address to, uint256 amount) internal {
        checkAllowance(token, from, amount);
        ERC20(token).transferFrom(from, to, amount);
    }

    // ตรวจสอบ อัตราแลกเปลี่ยนของแต่ละสกุลเงิน
    function getExchangeRate(string memory symbol) public view returns (uint256) {
        return exchangeRates[symbol];
    }



    function getBalance(address user, string memory tokenSymbol) public view returns (uint256) {
        return collateralBalance[user][tokenSymbol];
    }

   
    function getBRICSBalance(address user) public view returns (uint256) {
        return bricsToken.balanceOf(user);
    }
    /*
        This contract may be abstract, it may not implement an abstract parent's methods completely or it may not invoke an inherited contract's constructor correctly.
    */
    // Return the asset (BRICS token) that the Vault is managing
   
 
  
}