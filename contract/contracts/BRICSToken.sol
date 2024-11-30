// SPDX-License-Identifier: MIT
//  Stablecoin BRICS (ERC20 Token):
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract BRICSToken is ERC20 {
    address public vault;

    event VaultCheck(address indexed vaultAddress, address indexed caller);
   
    constructor() ERC20("BRICS Stablecoin", "BRICS") {
         _mint(msg.sender, 100000 * (10 ** decimals())); // need use 2 or 4 digit.
         
        // vault = msg.sender; // Vault Address ถูกตั้งในตอน Deploy
        // Vault address จะถูกตั้งภายหลังจากการ Deplosy
    }
    
    modifier onlyVault() {
        emit VaultCheck(vault, msg.sender);  // Log vault and msg.sender
        require(msg.sender == vault, "Only Vault can mint or burn tokens");
        _;
    }

    function setVault(address _vault) external {
        require(vault == address(0), "Vault already set"); // กำหนดได้ครั้งเดียว
        vault = _vault;
    }

    function mint(address to, uint256 amount) external onlyVault {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external onlyVault {
         emit VaultCheck(vault, msg.sender);  // Log Address ที่เรียก
        _burn(from, amount);
    }

   // Override decimals function
    function decimals() public view virtual override returns (uint8) {
        return 2; // เปลี่ยนเป็น 2 ทศนิยม (หรือจำนวนที่ต้องการ)
        // หากตั้ง Decimals เป็น 2, การโอน 100 BRICS จะหมายถึง 1.00 BRICS
    }
}
