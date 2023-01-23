// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import "./utils/BaseLootCrateToken.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/interfaces/IERC2981.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "operator-filter-registry/src/DefaultOperatorFilterer.sol";
import "../token/utils/IPFSLibrary.sol";

contract IMSpaceLootCrateToken is
    BaseLootCrateToken,
    Ownable,
    ReentrancyGuard,
    DefaultOperatorFilterer,
    IERC2981
{
    using SafeERC20 for IERC20;

    event Reserve(address indexed to, uint256 amount);
    event RoyaltyChanged(address indexed receiver, uint256 percentBips);
    event MaxSalesChanged(uint256 previousMaxSales, uint256 newMaxSales);
    event PurchaseLimitChanged(uint256 previousPurchaseLimit, uint256 newPurchaseLimit);

    uint256 private constant MAX_256 = 2**256 - 1;

    uint256 public maxSales;
    uint256 public sales;

    uint256 public purchaseLimit;
    address public immutable token;
    uint256 public immutable price;

    address public recipient;
    uint256 public resaleRoyaltyBips;

    string private _baseURIString = "";

    // Operator filterer
    bool public filterOperators = true;

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
        require(_tokens.length > 0, "Crate: no content");
        require(_tokens.length == _amounts.length, "Crate: lengths !=");
        require(_recipient != address(0), "Crate: recipient = 0");

        maxSales = _maxSales;
        purchaseLimit = _purchaseLimit;
        token = _token;
        price = _price;
        recipient = _recipient;
        resaleRoyaltyBips = 500;

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
    function purchase(address _to, uint256 _amount, uint256 _maximumCost) public nonReentrant {
        require(_amount <= purchaseLimit, "Crate: too many");
        require(sales + _amount <= maxSales, "Crate: supply");
        sales += _amount;

        uint256 purchaseCost = price * _amount;
        require(purchaseCost <= _maximumCost,  "Crate: payment");

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
        require(_isApprovedOrOwner(_msgSender(), _tokenId), "Crate: unauthorized");
        require(ERC721.ownerOf(_tokenId) == _from, "Crate: unauthorized");
        require(_to != address(0), "Crate: 0 address");

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
     * @notice Called with the sale price to determine how much royalty is owed and to whom.
     */
    function royaltyInfo(
        uint256, /*_tokenId*/
        uint256 _salePrice
    )
        external
        view
        virtual
        override
        returns (address receiver, uint256 royaltyAmount)
    {
        receiver = recipient;
        royaltyAmount = (_salePrice * resaleRoyaltyBips) / 10000;
    }

    function setRoyalty(address _recipient, uint256 _percentBips) external onlyOwner {
        require(_recipient != address(0), "Crate: recipient = 0");
        require(_percentBips <= 1000, "Crate: royalty must be <= 10%");
        recipient = _recipient;
        resaleRoyaltyBips = _percentBips;
        emit RoyaltyChanged(_recipient, _percentBips);
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

    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(IERC165, ERC721Enumerable)
        returns (bool)
    {
        return interfaceId == type(IERC165).interfaceId
            || interfaceId == type(IERC2981).interfaceId
            || ERC721Enumerable.supportsInterface(interfaceId);
    }

    // Operator Filterer

    function setFilterOperators(bool _filterOperators) public virtual onlyOwner {
        filterOperators = _filterOperators;
    }

    function setApprovalForAll(address operator, bool approved) public override(ERC721, IERC721) onlyAllowedOperatorApproval(operator) {
        super.setApprovalForAll(operator, approved);
    }

    function approve(address operator, uint256 tokenId) public override(ERC721, IERC721) onlyAllowedOperatorApproval(operator) {
        super.approve(operator, tokenId);
    }

    function transferFrom(address from, address to, uint256 tokenId) public override(ERC721, IERC721) onlyAllowedOperator(from) {
        super.transferFrom(from, to, tokenId);
    }

    function safeTransferFrom(address from, address to, uint256 tokenId) public override(ERC721, IERC721) onlyAllowedOperator(from) {
        super.safeTransferFrom(from, to, tokenId);
    }

    function safeTransferFrom(address from, address to, uint256 tokenId, bytes memory data)
        public
        override(ERC721, IERC721)
        onlyAllowedOperator(from)
    {
        super.safeTransferFrom(from, to, tokenId, data);
    }

    function _checkFilterOperator(address operator) internal view override {
        if (filterOperators) {
            super._checkFilterOperator(operator);
        }
    }
}
