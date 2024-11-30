// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";

/// @dev ERC4626 vault with entry/exit fees expressed in https://en.wikipedia.org/wiki/Basis_point[basis point (bp)].
abstract contract Vaylt is ERC4626 {
    using Math for uint256;

    uint256 private constant _BASIS_POINT_SCALE = 1e4;

    // === Overrides ===
    address payable public vaultOwner;
    uint256 entryFeeBasisPoints;

    constructor(IERC20 _asset) ERC4626(_asset) ERC20("Vault Ocean Token", "vOCT") {
        vaultOwner = payable(msg.sender);

        
    }

}