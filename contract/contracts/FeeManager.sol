// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract FeeManager {
    address public feeCollector;

    uint256 public baseFee;
    uint256 public lowFee; 
    uint256 public protocolFee;
    uint256 public depositFee;
    uint256 public withdrawFee;
    uint256 public lowDepositFee;
    uint256 public constant FEE_DENOMINATOR = 10000;
    uint256 public minimumLiquidity = 1000;
    uint256 public constant RATE_PRECISION = 1000;// 1000=1

    event BaseFeeUpdated(uint256 newValue);
    event LowFeeUpdated(uint256 newValue);
    event ProtocolFeeUpdated(uint256 newValue);
    event DepositFeeUpdated(uint256 newValue);
    event LowDepositFeeUpdated(uint256 newValue);
    event MinimumLiquidityUpdated(uint256 oldValue, uint256 newValue);
    event FeeCollectorUpdated(address newCollector);
    event WithdrawFeeUpdated(uint256 newValue);

    constructor (){
        baseFee = 200;         // total 0.2%
        lowFee = 50;          // 0.05%
        protocolFee = 25;    // 25% of fee(0.2) goes to protocol
        depositFee = 100;      // 0.1% for deposits
        lowDepositFee = 25;    // 0.025% when liquidity low
        withdrawFee = 0; // No fee for withdrawals
    }

    function setFeeCollector(address _feeCollector) external {
        require(_feeCollector != address(0), "Invalid address");
        feeCollector = _feeCollector;
        emit FeeCollectorUpdated(_feeCollector);
    }

    function setBaseFee(uint256 _baseFee) external   {
        require(_baseFee <= 1000, "Fee too high");
        require(_baseFee >= lowFee, "Must be >= lowFee");
        baseFee = _baseFee;
        emit BaseFeeUpdated(_baseFee);
    }

    function setLowFee(uint256 _lowFee) external   {
        require(_lowFee <= baseFee, "Must be <= baseFee");
        lowFee = _lowFee;
        emit LowFeeUpdated(_lowFee);
    }

    function setProtocolFee(uint256 _protocolFee) external   {
        require(_protocolFee<= 100, "Fee too high");
        protocolFee = _protocolFee;
        emit ProtocolFeeUpdated(_protocolFee);
    }

    function setDepositFee(uint256 _depositFee) external   {
        require(_depositFee <= 500, "Fee too high"); 
        require(_depositFee >= lowDepositFee, "Must be >= lowDepositFee");
        depositFee = _depositFee;
        emit DepositFeeUpdated(_depositFee);
    }

    function setWithdrawFee(uint256 _withdrawFee) external   {
        require(_withdrawFee <= 500, "Fee too high"); 
        withdrawFee = _withdrawFee;
        emit WithdrawFeeUpdated(_withdrawFee);
    }

    function setLowDepositFee(uint256 _lowDepositFee) external   {
        require(_lowDepositFee <= depositFee, "Must be <= depositFee");
        lowDepositFee = _lowDepositFee;
        emit LowDepositFeeUpdated(_lowDepositFee);
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


    function getProtocolFee(uint256 fee) public view returns (uint256) {
        return (fee * protocolFee) / 100;
    }

    function calculateSwapFees(
        uint256 reserve0,
        uint256 reserve1,
        bool isToken0,
        uint256 bricsRate
    ) external view returns (uint256 feeBrics, uint256 protocolFeeBrics) {
        uint256 fee = isToken0
            ? (reserve0 <= minimumLiquidity * 3 ? lowFee : baseFee)
            : (reserve1 <= minimumLiquidity * 3 ? lowFee : baseFee);
            
        feeBrics = (bricsRate * fee) / RATE_PRECISION;
        protocolFeeBrics = (bricsRate * getProtocolFee(fee)) / RATE_PRECISION;
    }


    function sqrt(uint256 y) external  pure returns (uint256 z) {
        if (y > 3) {
            z = y;
            uint256 x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }

    function min(uint256 x, uint256 y) external pure returns (uint256) {
        return x < y ? x : y;
    }


}