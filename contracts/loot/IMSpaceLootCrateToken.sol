// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import "./utils/BaseLootCrateToken.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/draft-IERC20Permit.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "../token/utils/IPFSLibrary.sol";

contract IMSpaceLootCrateToken is BaseLootCrateToken, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    event Reserve(address indexed to, uint256 amount);
    event RecipientChanged(address indexed previousRecipient, address indexed newRecipient);
    event ProceedsClaimed(address indexed recipient, uint256 amount);
    event MaxSalesChanged(uint256 previousMaxSales, uint256 newMaxSales);
    event PurchaseLimitChanged(uint256 previousPurchaseLimit, uint256 newPurchaseLimit);

    uint256 private constant MAX_256 = 2**256 - 1;

    uint256 public maxSales;
    uint256 public sales;

    uint256 public purchaseLimit;
    address public immutable token;
    uint256 public immutable price;

    address public recipient;

    string private _baseURIString = "";

    constructor(
        string memory _name,
        string memory _symbol,
        uint256 _maxSales,
        uint256 _purchaseLimit,
        address _token,
        uint256 _price,
        address _recipient,
        address[] memory _tokens,
        uint256[] memory _amounts
    ) ERC721(_name, _symbol) {
        require(_tokens.length > 0, "IMSpaceLootCrateToken: must specify contents of length >= 1");
        require(_tokens.length == _amounts.length, "IMSpaceLootCrateToken: array parameters must have same length");

        maxSales = _maxSales;
        purchaseLimit = _purchaseLimit;
        token = _token;
        price = _price;
        recipient = _recipient;

        for (uint256 i = 0; i < _tokens.length; i++) {
            _addContent(_tokens[i], _amounts[i]);
        }
    }

    function setBaseURI(string calldata uri) external onlyOwner {
        require(IPFSLibrary.uriSeemsValid(uri), "ERC721Metadata: IPFS URI required");
        _setBaseURI(uri);
    }

    function _setBaseURI(string memory uri) internal {
        _baseURIString = uri;
    }

    function _baseURI() internal view virtual override returns (string memory) {
        return _baseURIString;
    }

    /**
     * @dev Mints `_amount` loot crates into `_to`'s wallet, which can be later
     * revealed to receive mission tokens. Only the contract owner may reserve
     * crates.
     */
    function reserve(address _to, uint256 _amount) external onlyOwner {
        _mint(msg.sender, _to, _amount);
        emit Reserve(_to, _amount);
    }

    /**
     * @dev Mints `_amount` loot crates into `_to`'s wallet, which can be later
     * revealed to receive mission tokens. Requires a payment of `token`, equal
     * to the current `price` * `_amount`. `_maximumCost` is the amount the caller
     * is willing to pay. The token transfer (by this contract) should already
     * be approved by the caller.
     */
    function purchase(address _to, uint256 _amount, uint256 _maximumCost) external {
        _purchase(_to, _amount, _maximumCost);
    }

    /**
     * @dev Mints `_amount` loot crates into `_to`'s wallet, which can be later
     * revealed to receive mission tokens. Requires a payment of `token`, equal
     * to the current `price` * `_amount`. `_maximumCost` is the amount the caller
     * is willing to pay. The token transfer (by this contract) will be approved
     * using the provided permit, for either `_maximumCost` or `256**2 - 1`
     * (if `approveMax`).
     */
    function purchaseWithPermit(
        address _to, uint256 _amount, uint256 _maximumCost,
        bool approveMax, uint256 deadline, uint8 v, bytes32 r, bytes32 s
    ) external {
        uint256 value = approveMax ? MAX_256 : _maximumCost;
        IERC20Permit(token).permit(msg.sender, address(this), value, deadline, v, r, s);
        _purchase(_to, _amount, _maximumCost);
    }

    /**
     * @dev Mints `_amount` loot crates into `_to`'s wallet, which can be later
     * revealed to receive mission tokens. Requires a payment of `token`, equal
     * to the current `price` * `_amount`. `_maximumCost` is the amount the caller
     * is willing to pay. The token transfer (by this contract) should already
     * be approved by the caller.
     */
    function _purchase(address _to, uint256 _amount, uint256 _maximumCost) internal nonReentrant {
        require(_amount <= purchaseLimit, "IMSpaceLootCrateToken: amount exceeds purchase limit");
        require(sales + _amount <= maxSales, "IMSpaceLootCrateToken: insufficient supply");
        sales += _amount;

        uint256 purchaseCost = price * _amount;
        require(purchaseCost <= _maximumCost,  "IMSpaceLootCrateToken: insufficient payment");

        // transfer coins
        address purchaseRecipient = recipient == address(0) ? address(this) : recipient;
        IERC20(token).safeTransferFrom(msg.sender, purchaseRecipient, purchaseCost);

        // create loot crates
        _mint(msg.sender, _to, _amount);
    }

    /**
     * @dev Burns the crate token `_tokenId`, transferring its contents to `_to`.
     * The crate must be in `_from`'s wallet and the caller authorized to access
     * it -- either the owner or `approve`d.
     */
    function revealFrom(address _from, address _to, uint256 _tokenId) external {
        require(_isApprovedOrOwner(_msgSender(), _tokenId), "IMSpaceLootCrateToken: reveal caller is not owner nor approved");
        require(ERC721.ownerOf(_tokenId) == _from, "IMSpaceLootCrateToken: reveal from incorrect owner");
        require(_to != address(0), "IMSpaceLootCrateToken: reveal to the zero address");

        // reveal contents (destroys loot crate)
        _reveal(_from, _to, _tokenId);
    }

    /**
     * @dev Burns the crate tokens `_tokenIds`, transferring their contents to
     * the owners of those crates. Only the  contract owner may make this call.
     * If already-revealed or non-existent tokenIds are included, they are skipped,
     * and the remainaing tokens revealed.
     */
    function forceReveal(uint256[] calldata _tokenIds) external onlyOwner {
        for (uint256 i = 0; i < _tokenIds.length; i++) {
            uint256 tokenId = _tokenIds[i];
            if (_exists(tokenId)) {
                address owner = ERC721.ownerOf(tokenId);
                _reveal(owner, owner, tokenId);
            }
        }
    }

    /**
     * Set the recipient address for purchase costs. If set to the zero-address,
     * purchase costs will be stored in this contract until claimed.  Only the
     * contract owner may make this call.
     */
    function setRecipient(address _recipient) external onlyOwner {
        address oldRecipient = recipient;
        recipient = _recipient;
        emit RecipientChanged(oldRecipient, recipient);
    }

    /**
     * Claim all sale proceeds currently held by this contract, transferring them
     * to `_to`. Only the contract owner may make this call.
     */
    function claimAllProceeds(address _to) external onlyOwner {
        uint256 amount = IERC20(token).balanceOf(address(this));
        IERC20(token).safeTransfer(_to, amount);
        emit ProceedsClaimed(_to, amount);
    }

    /**
     * Claim `_amount` sale proceeds currently held by this contract, transferring them
     * to `_to`. Only the contract owner may make this call.
     */
    function claimProceeds(address _to, uint256 _amount) external onlyOwner {
        IERC20(token).safeTransfer(_to, _amount);
        emit ProceedsClaimed(_to, _amount);
    }

    /**
     * Sets `maxSales`, the total number of loot crates that may be purchased,
     * to the value specified -- or number of total sales made so far, whichever is lower.
     */
    function setMaxSales(uint256 _sales) external onlyOwner {
        uint256 previousMaxSales = maxSales;
        maxSales = _sales < sales ? sales : _sales;
        emit MaxSalesChanged(previousMaxSales, maxSales);
    }

    /**
     * Sets `purchaseLimit`, the maximum number of loot crates that may be purchased
     * in a single transaction.
     */
    function setPurchaseLimit(uint256 _purchaseLimit) external onlyOwner {
        uint256 previousPurchaseLimit = _purchaseLimit;
        purchaseLimit = _purchaseLimit;
        emit PurchaseLimitChanged(previousPurchaseLimit, purchaseLimit);
    }

}
