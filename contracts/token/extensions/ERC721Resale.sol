// SPDX-License-Identifier: MIT
// OpenZeppelin Contracts (last updated v4.6.0) (token/ERC721/extensions/draft-ERC721Votes.sol)

pragma solidity 0.8.10;

import "@openzeppelin/contracts/interfaces/IERC2981.sol";

/**
 * @dev Extension of ERC721 to support royalty configuration and Ownable, used
 * for project configuration on marketplaces.
 */
abstract contract ERC721Resale is IERC2981 {

    event RoyaltyChanged(address indexed receiver, uint256 percentBips);
    event RoyaltyMaxChanged(uint256 percentBipsMax);

    // Royalty Receiver
    address public royaltyReceiver;
    uint256 public royaltyPercentBips; // eg 15% royalty would be 1500 bips
    uint256 public royaltyPercentBipsMax;

    constructor() {
        _setRoyaltyMax(1000);   // 10%
        _setRoyalty(msg.sender, 0);
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
        receiver = address(royaltyReceiver);
        require(receiver != address(0), "ERC721Resale: receiver");
        royaltyAmount = (_salePrice * royaltyPercentBips) / 10000; // 10,000 is 100% in bips
    }

    function _setRoyalty(address receiver, uint256 percentBips) internal virtual {
        require(percentBips <= 10000, "ERC721Resale: royalty percent BIPS must be <= 10000");
        require(percentBips <= royaltyPercentBipsMax, "ERC721Resale: royalty percent BIPS must be <= maximum");
        require(receiver != address(0), "ERC721Resale: new receiver is the zero address");
        royaltyReceiver = receiver;
        royaltyPercentBips = percentBips;
        emit RoyaltyChanged(receiver, percentBips);
    }

    function _setRoyaltyMax(uint256 maxPercentBips) internal virtual {
        require(maxPercentBips <= 10000, "ERC721Resale: max royalty percent BIPS must be <= 10000");
        royaltyPercentBipsMax = maxPercentBips;
        emit RoyaltyMaxChanged(maxPercentBips);
        if (royaltyPercentBips > maxPercentBips) {
            royaltyPercentBips = maxPercentBips;
            emit RoyaltyChanged(royaltyReceiver, royaltyPercentBips);
        }
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override
        returns (bool)
    {
        return interfaceId == type(IERC2981).interfaceId || interfaceId == type(IERC165).interfaceId;
    }
}
