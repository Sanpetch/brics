// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract FeeManager {
    address public feeCollector;

    uint256 public baseFee;
    uint256 public lowFee; 
    uint256 public protocolFee;   
    uint256 public constant FEE_DENOMINATOR = 10000;
    uint256 public minimumLiquidity;
    uint256 public constant RATE_PRECISION = 10000;// 10000=1

    event BaseFeeUpdated(uint256 newValue);
    event LowFeeUpdated(uint256 newValue);
    event ProtocolFeeUpdated(uint256 newValue);

    event MinimumLiquidityUpdated(uint256 oldValue, uint256 newValue);
    event FeeCollectorUpdated(address newCollector);
    event WithdrawFeeUpdated(uint256 newValue);

    constructor (){
        feeCollector = 0xAc2Edb624621f81E5f03E67c2B74a35563951bd6; //Admin wallet
        minimumLiquidity = 1000 * RATE_PRECISION; // 1000.0000 เหรียญ
        baseFee = 2000;         // total 0.2%
        lowFee = 1000;          // 0.1%
        protocolFee = 25;    // 25% of total fee(0.2) goes to protocol and 75% to LP for swapping
       
        
    }

    function setFeeCollector(address _feeCollector) external {
        require(_feeCollector != address(0), "Invalid address");
        feeCollector = _feeCollector;
        emit FeeCollectorUpdated(_feeCollector);
    }

    function setBaseFee(uint256 _baseFee) external   {
        require(_baseFee <= 100000, "Fee too high");
        require(_baseFee >= lowFee, "Must be >= lowFee");
        baseFee = _baseFee;
        emit BaseFeeUpdated(_baseFee);
    }

    function setLowFee(uint256 _lowFee) external   {
        require(_lowFee < baseFee, "Fee too high");
        baseFee = _lowFee;
        emit BaseFeeUpdated(_lowFee);
    }


    function setProtocolFee(uint256 _protocolFee) external   {
        require(_protocolFee<= 10000, "Fee too high");
        protocolFee = _protocolFee;
        emit ProtocolFeeUpdated(_protocolFee);
    }

    function setMinimumLiquidity(uint256 _minimumLiquidity) external {
       require(_minimumLiquidity > 0, "Invalid minimum");
       uint256 oldValue = minimumLiquidity;
       minimumLiquidity = _minimumLiquidity;
       emit MinimumLiquidityUpdated(oldValue, _minimumLiquidity);
   }

    function calculateTokenFee(
        uint256 reserve0,
        uint256 reserve1
    ) external view returns (uint256 token0Fee, uint256 token1Fee) {
        token0Fee = reserve0 <= minimumLiquidity ? lowFee : 
                   reserve0 >= minimumLiquidity * 3 ? baseFee : lowFee;
                   
        token1Fee = reserve1 <= minimumLiquidity ? lowFee :
                   reserve1 >= minimumLiquidity * 3 ? baseFee : lowFee;
    }


    function calculateSwapFees(
        uint256 reserve0,
        uint256 reserve1,
        bool isToken0,
        uint256 bricsRate
    ) external view returns (
        uint256 totalFeeBrics,
        uint256 protocolFeeBrics,
        uint256 lpFeeBrics
    ) {
        uint256 totalFee = isToken0
            ? (reserve0 <= minimumLiquidity * 3 ? lowFee : baseFee)
            : (reserve1 <= minimumLiquidity * 3 ? lowFee : baseFee);
            
        totalFeeBrics = (bricsRate * totalFee) / RATE_PRECISION;
        protocolFeeBrics = (totalFeeBrics * protocolFee) / FEE_DENOMINATOR;
        lpFeeBrics = totalFeeBrics - protocolFeeBrics;
    }

    function sqrt(uint256 x) public pure returns (uint256) {
        if (x == 0) return 0;
        if (x <= 3) return 1;
        
        uint256 z = (x + 1) / 2;
        uint256 y = x;
        
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
        return y;
    }

    function min(uint256 x, uint256 y) external pure returns (uint256) {
        return x < y ? x : y;
    }
}