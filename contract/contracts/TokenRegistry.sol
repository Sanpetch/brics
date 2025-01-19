// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract TokenRegistry {

    mapping(string => address) public tokenAddresses;
    mapping(string => uint256) public tokenWeights;
    string[] public supportedTokens;
    
    uint256 public constant WEIGHT_PRECISION = 100;

    event TokenAdded(string symbol, address addr);
    event WeightUpdated(string symbol, uint256 weight);
 
    constructor() {
        addToken("CNY", 0xd37BaD73F63e3725d364B65717d1c18e5186296f,20);//CNY 20, RUB 50, INR 30  0xFb3C40a2F3a57a7DB3D8Cfa050a0fDa7Aed8399F
        addToken("RUB", 0x9876EEAf962ADfc612486C5D54BCb9D8B5e50878,50);
        addToken("INR",0xe3077475D1219088cD002B75c8bB46567D7F37ae,30);
        addToken("BRICS",0xa65bb3Ef188f5dA6aABf0A9890e1E63D77a3eC53,0);// 0x2a5b1793dE8e791a5e8279387bbddAdCE8bb9C5C
    }
    
    function addToken(string memory symbol, address tokenAddress, uint256 weight) public  {
        require(tokenAddresses[symbol] == address(0), "Token exists");
        tokenAddresses[symbol] = tokenAddress;
        addTokenWeight(symbol, weight);
        supportedTokens.push(symbol);
        emit TokenAdded(symbol, tokenAddress);
        emit WeightUpdated(symbol, weight);
    }

    function updateTokenAddress(string memory symbol, address newAddress) external {
        require(tokenAddresses[symbol] != address(0), "Token not found");
        require(newAddress != address(0), "Invalid address");
        
        tokenAddresses[symbol] = newAddress;
        emit TokenAdded(symbol, newAddress);
        }

    function addTokenWeight(string memory symbol, uint256 weight) private  {
        require(weight <= WEIGHT_PRECISION, "Weight too high");
        
        uint256 currentTotal;
        for(uint i = 0; i < supportedTokens.length; i++) {
            currentTotal += tokenWeights[supportedTokens[i]];
        }
        require(currentTotal + weight <= WEIGHT_PRECISION, "Total weight exceeds 100");
        tokenWeights[symbol] = weight;
    }
    
    //Token must be added first and order must be same
    function updateWeight(string[] memory symbols, uint256[] memory weights) public  {
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