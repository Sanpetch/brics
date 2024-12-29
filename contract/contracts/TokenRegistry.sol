// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";

contract TokenRegistry is Ownable {
    
    address public constant BRICS = 0x047b37Ef4d76C2366F795Fb557e3c15E0607b7d8; // 
    address public constant RUB = 0x8207D032322052AfB9Bf1463aF87fd0c0097EDDE; // 0x9876EEAf962ADfc612486C5D54BCb9D8B5e50878 for Test network
    address public constant CNY = 0xd37BaD73F63e3725d364B65717d1c18e5186296f; // 0xd37BaD73F63e3725d364B65717d1c18e5186296f for Test network
    address public constant INR = 0xe3077475D1219088cD002B75c8bB46567D7F37ae; // 0xe3077475D1219088cD002B75c8bB46567D7F37ae for Test network

    mapping(string => address) public tokenAddresses;
    mapping(string => uint256) public tokenWeights;
    //mapping(address => mapping(address => uint256)) public exchangeRates;
    string[] public supportedTokens;
    
    uint256 public constant WEIGHT_PRECISION = 100;
    //uint256 public constant RATE_CHANGE_LIMIT = 5000; // 50% max rate change
    //uint256 public constant RATE_PRECISION = 1000; // 1000 = 1
    event TokenAdded(string symbol, address addr);
    event WeightUpdated(string symbol, uint256 weight);
    //event RateUpdated(address token0, address token1, uint256 rate);
    
    constructor(address initialOwner) Ownable(initialOwner) {
        addToken("CNY", CNY,20);//CNY 20, RUB 50, INR 30
        addToken("RUB", RUB,50);
        addToken("INR",INR,30);
        addToken("BRICS",BRICS,0);
    }
    
    function addToken(string memory symbol, address tokenAddress, uint256 weight) public onlyOwner {
        require(tokenAddresses[symbol] == address(0), "Token exists");
        tokenAddresses[symbol] = tokenAddress;
        addTokenWeight(symbol, weight);
        supportedTokens.push(symbol);
        emit TokenAdded(symbol, tokenAddress);
        emit WeightUpdated(symbol, weight);
    }

    function addTokenWeight(string memory symbol, uint256 weight) private onlyOwner {
        require(weight <= WEIGHT_PRECISION, "Weight too high");
        
        uint256 currentTotal;
        for(uint i = 0; i < supportedTokens.length; i++) {
            currentTotal += tokenWeights[supportedTokens[i]];
        }
        require(currentTotal + weight <= WEIGHT_PRECISION, "Total weight exceeds 100");
        tokenWeights[symbol] = weight;
    }
    
    //Token must be added first and order must be same
    function updateWeight(string[] memory symbols, uint256[] memory weights) public onlyOwner {
        require(symbols.length == supportedTokens.length, "Must update all tokens");
        require(symbols.length == weights.length, "Length mismatch");

        // Check all basket tokens are included
        for(uint i = 0; i < supportedTokens.length; i++) {
            bool found = false;
            for(uint j = 0; j < symbols.length; j++) {
                if(keccak256(bytes(supportedTokens[i])) == keccak256(bytes(symbols[j]))) {
                    found = true;
                    break;
                }
            }
            require(found, "Missing basket token");
        }
        
        uint256 totalWeight;
        for(uint i = 0; i < weights.length; i++) {
            totalWeight += weights[i];
        }
        require(totalWeight == WEIGHT_PRECISION, "Weights must sum to 100");
        
        for(uint i = 0; i < symbols.length; i++) {
            tokenWeights[symbols[i]] = weights[i];
        }
    }
    
    
    function getTokenAddress(string memory symbol) public view returns (address) {
        require(tokenAddresses[symbol] != address(0), "Token not found");
        return tokenAddresses[symbol];
    }
    
    function getSupportedTokens() external view returns (string[] memory) {
        return supportedTokens;
    }


    function getWeights() external view returns (
        string[] memory symbols,
        uint256[] memory weights,
        uint256 totalWeight
    ) {
        symbols = supportedTokens;
        weights = new uint256[](symbols.length);
        
        for(uint i = 0; i < symbols.length; i++) {
            weights[i] = tokenWeights[symbols[i]];
            totalWeight += weights[i];
        }
    }

    function getSupportedTokensLength() public view returns (uint256) {
        return supportedTokens.length;
    }

    function getTokenAtIndex(uint256 index) external view returns (string memory) {
        return supportedTokens[index];
    }

    function getTokenWeight(string memory symbol) external view returns (uint256) {
        return tokenWeights[symbol];
    }

}