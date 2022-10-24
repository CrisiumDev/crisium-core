// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import "./utils/BaseLootCrateSale.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

abstract contract IMSpaceLootCrateSale is BaseLootCrateSale, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    event RecipientChanged(address indexed previousRecipient, address indexed newRecipient);
    event ProceedsClaimed(address indexed recipient, uint256 amount);

    uint256 public immutable totalSupply;
    uint256 public supply;

    uint256 public immutable purchaseLimit;
    address public immutable token;
    uint256 public immutable price;

    address public recipient;

    constructor(
        uint256 _supply,
        uint256 _purchaseLimit,
        address _token,
        uint256 _price,
        address _recipient,
        address[] memory _tokens,
        uint256[] memory _amounts
    ) {
        require(_tokens.length > 0, "IMSpaceLootCrateSale: must specify contents of length >= 1");
        require(_tokens.length == _amounts.length, "IMSpaceLootCrateSale: array parameters must have same length");

        totalSupply = _supply;
        supply = _supply;
        purchaseLimit = _purchaseLimit;
        token = _token;
        price = _price;
        recipient = _recipient;

        for (uint256 i = 0; i < _tokens.length; i++) {
            _addContent(_tokens[i], _amounts[i]);
        }
    }

    function purchase(address _to, uint256 _amount, uint256 _maximumCost) external nonReentrant {
        require(supply >= _amount, "IMSpaceLootCrateSale: insufficient supply");
        supply -= _amount;

        uint256 purchaseCost = price * _amount;
        require(purchaseCost <= _maximumCost,  "IMSpaceLootCrateSale: insufficient payment");

        // transfer coins
        address purchaseRecipient = recipient == address(0) ? address(this) : recipient;

        // TODO use a safe transfer wrapper
        IERC20(token).safeTransferFrom(msg.sender, purchaseRecipient, purchaseCost);

        // reveal purchased tokens
        _reveal(msg.sender, _to, _amount);
    }

    function setRecipient(address _recipient) external onlyOwner {
        address oldRecipient = _recipient;
        recipient = _recipient;
        emit RecipientChanged(oldRecipient, recipient);
    }

    function claimAllProceeds(address _to) external onlyOwner {
        uint256 amount = IERC20(token).balanceOf(address(this));
        IERC20(token).safeTransfer(_to, amount);
        emit ProceedsClaimed(_to, amount);
    }

    function claimProceeds(address _to, uint256 _amount) external onlyOwner {
        IERC20(token).safeTransfer(_to, _amount);
        emit ProceedsClaimed(_to, _amount);
    }

}
