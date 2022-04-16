// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.1;

import "./interface/IACDMToken.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
@title Platform for selling and trading tokens
@author Seydou Obedias
*/
contract ACDMPlatform is ReentrancyGuard, Ownable {
    using Counters for Counters.Counter;
    Counters.Counter private _orderIds;
    uint256 public constant saleCommissionFirstLvl = 50;
    uint256 public constant saleCommissionSecondLvl = 30;
    uint256 public constant tradeCommission = 25;

    IACDMToken public token;
    Round public roundType;
    uint256 public roundTime;
    uint256 public roundEndTime;
    uint256 public tradeETHVolume;
    uint256 public tradeACDMVolume;
    uint256 public tokenPrice;

    struct Order {
        address seller;
        uint256 amountACDM;
        uint256 amountETH;
    }

    enum Round {
        Sale,
        Trade
    }

    mapping(address => address) referrers;
    mapping(uint256 => Order) public orders;

    /**
    Emitted when new user is registered
    @param user Registered user address
    @param referrer Referrer address
    */
    event Register(address user, address referrer);

    /**
    Emitted when user bought ACDM tokens
    @param user User address
    @param amount Amount of tokens bought
    */
    event BoughtACDM(address user, uint256 amount);

    /**
    Emitted when new sale round started
    @param timestamp Start time 
    */
    event SaleRoundStarted(uint256 timestamp);

    /**
    Emitted when new trade round started
    @param timestamp Start time 
    */
    event TradeRoundStarted(uint256 timestamp);

    /**
    Emitted when new order added
    @param idOrder Order ID
    @param amountACDM Amount of ACDM tokens in order
    @param amountETH Amount of ETH in order 
    */
    event OrderAdded(uint256 idOrder, uint256 amountACDM, uint256 amountETH);

    /**
    Emitted when order removed
    @param idOrder Order ID 
    */
    event OrderRemoved(uint256 idOrder);

    /**
    Emitted when order redeemed
    @param buyer Buyer address
    @param idOrder Order ID
    @param amountACDM Amount of redeemed ACDM tokens
    */
    event OrderRedeemed(address buyer, uint256 idOrder, uint256 amountACDM);

    /**
    Constructor
    @param _token ACDM token address
    @param _roundTime Round duration in seconds 
    */
    constructor(IACDMToken _token, uint256 _roundTime) {
        token = _token;
        roundType = Round.Sale;
        roundTime = _roundTime;
        roundEndTime = block.timestamp + _roundTime;
        tradeETHVolume = 1 ether;
        tradeACDMVolume = 10**5;
        tokenPrice = tradeETHVolume / tradeACDMVolume;
    }

    /**
    Registers new users in referral program
    @param _referrer Referrer address
    */
    function register(address _referrer) public {
        require(
            referrers[msg.sender] == address(0),
            "This address already has a referrer"
        );
        require(msg.sender != _referrer, "Cannot refer yourself");
        referrers[msg.sender] = _referrer;
        emit Register(msg.sender, _referrer);
    }

    /**
    Sends earned ETH to referrals
    @param commissionValFirst Referral program first level commission value
    @param commissionValSecond Referral program second level commission value
    */
    function _payReferral(
        uint256 commissionValFirst,
        uint256 commissionValSecond
    ) private {
        if (referrers[msg.sender] != address(0)) {
            _sendETH(referrers[msg.sender], commissionValFirst);
            if (referrers[referrers[msg.sender]] != address(0)) {
                _sendETH(referrers[referrers[msg.sender]], commissionValSecond);
            }
        }
    }

    /**
    Purchases ACDM tokens from platform during sale round
    @param _amount Amount of tokens to buy
    */
    function buyACDM(uint256 _amount) public payable nonReentrant {
        require(
            roundType == Round.Sale,
            "Cannot buy ACDM tokens during trade round"
        );
        require(
            _amount <= tradeACDMVolume,
            "Cannot buy more tokens than supply"
        );
        require(msg.value >= tokenPrice * _amount, "Not enough ETH");
        token.transfer(msg.sender, _amount);
        _payReferral(
            (msg.value * saleCommissionFirstLvl) / 1000,
            (msg.value * saleCommissionSecondLvl) / 1000
        );
        tradeACDMVolume -= _amount;
        emit BoughtACDM(msg.sender, _amount);
    }

    /**
    Starts sale round after trade round end
    @notice Any user can call this function
    */
    function startSaleRound() public {
        require(roundType != Round.Sale, "Sale round is already active");
        require(
            block.timestamp > roundEndTime,
            "Wait until trade round is over"
        );
        roundType = Round.Sale;
        roundEndTime = block.timestamp + roundTime;
        token.burn(address(this), tradeACDMVolume);
        //Check trade volume to avoid price dropping to zero
        if (tradeETHVolume > 0) {
            tradeACDMVolume = tradeETHVolume / tokenPrice;
        } else {
            tradeETHVolume = 1 ether; //Start with default value
        }
        tokenPrice = (tokenPrice * 103) / 100 + 4 * 10**12 wei;
        token.mint(address(this), tradeACDMVolume);
        uint256 ordersNum = _orderIds.current();
        for (uint256 i = 0; i < ordersNum; i++) {
            token.transfer(orders[i].seller, orders[i].amountACDM);
            delete orders[i];
            _orderIds.decrement();
        }
        emit SaleRoundStarted(block.timestamp);
    }

    /**
    Starts trade round after sale round end
    @notice Any user can call this function
    */
    function startTradeRound() public {
        require(roundType != Round.Trade, "Trade round is already active");
        require(
            block.timestamp > roundEndTime || tradeACDMVolume == 0,
            "Wait until sale round is over"
        );
        roundType = Round.Trade;
        roundEndTime = block.timestamp + roundTime;
        tradeETHVolume = 0;
        emit TradeRoundStarted(block.timestamp);
    }

    /**
    Adds new order to sell ACDM tokens during trade round
    @param _amountACDM Amount of ACDM tokens to sell
    @param _amountETH Amouth of ETH to receive
    */
    function addOrder(uint256 _amountACDM, uint256 _amountETH) public {
        require(roundType == Round.Trade, "Wait until sale round is over");
        require(
            token.balanceOf(msg.sender) >= _amountACDM,
            "Not enough ACDM tokens"
        );
        token.transferFrom(msg.sender, address(this), _amountACDM);
        uint256 idOrder = _orderIds.current();
        orders[idOrder].seller = msg.sender;
        orders[idOrder].amountACDM = _amountACDM;
        orders[idOrder].amountETH = _amountETH;
        _orderIds.increment();
        emit OrderAdded(idOrder, _amountACDM, _amountETH);
    }

    /**
    Removes existing order
    @param _idOrder Order ID
    @notice Only order seller can remove it
    */
    function removeOrder(uint256 _idOrder) public {
        require(
            orders[_idOrder].seller == msg.sender,
            "You cannot remove this order"
        );
        //Soft remove to preserve orders consistency during active round
        token.transfer(orders[_idOrder].seller, orders[_idOrder].amountACDM);
        orders[_idOrder].amountACDM = 0;
        orders[_idOrder].amountETH = 0;
        emit OrderRemoved(_idOrder);
    }

    /**
    Redeems existing order for ETH
    @param _amount Amount of tokens to redeem
    @param _idOrder Order ID
    */
    function redeemOrder(uint256 _amount, uint256 _idOrder)
        public
        payable
        nonReentrant
    {
        require(orders[_idOrder].seller != address(0), "Order does not exist");
        require(
            orders[_idOrder].amountACDM >= _amount,
            "Order does not have enough tokens"
        );
        require(
            msg.value >=
                (orders[_idOrder].amountETH / orders[_idOrder].amountACDM) *
                    _amount,
            "Not enough ETH"
        );
        token.transfer(msg.sender, _amount);
        uint256 paidETH = (orders[_idOrder].amountETH /
            orders[_idOrder].amountACDM) * _amount;
        _sendETH(orders[_idOrder].seller, (paidETH * 95) / 100);
        _payReferral(
            (paidETH * tradeCommission) / 1000,
            (paidETH * tradeCommission) / 1000
        );
        tradeETHVolume += paidETH;
        orders[_idOrder].amountACDM -= _amount;
        orders[_idOrder].amountETH -= paidETH;
        emit OrderRedeemed(msg.sender, _idOrder, _amount);
    }

    /**
    Safely sends ETH
    @param _to Recipient address
    @param _amount Amount of ETH to send
    @return Transaction result
    */
    function _sendETH(address _to, uint256 _amount) private returns (bool) {
        (bool sent, ) = _to.call{value: _amount}("");
        require(sent, "Could not send ETH");
        return sent;
    }

    /**
    Withdraws ETH received durin sale round
    @param _to Recipient address
    @param _amount Amount of ETH to send
    @notice Only owner can withdraw
    */
    function withdrawETH(address payable _to, uint256 _amount)
        public
        payable
        nonReentrant
        onlyOwner
    {
        require(address(this).balance > 0, "No ETH to withdraw");
        _sendETH(_to, _amount);
    }
}
