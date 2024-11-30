// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract RUBCBDCToken is ERC20 {
    address public vault;

    event VaultCheck(address indexed vaultAddress, address indexed caller);
   
    constructor() ERC20("RUB Stablecoin", "RUB_CBDC") {
        _mint(msg.sender, 100000 * (10 ** decimals())); // need use 2 or 4 digit.
    }
   
    function decimals() public pure override returns (uint8) {
        return 2;
    }
   
}