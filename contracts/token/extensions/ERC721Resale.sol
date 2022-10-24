// SPDX-License-Identifier: MIT
// OpenZeppelin Contracts (last updated v4.6.0) (token/ERC721/extensions/draft-ERC721Votes.sol)

pragma solidity 0.8.10;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/interfaces/IERC2981.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

/**
 * @dev Extension of ERC721 to support royalty configuration and Ownable, used
 * for project configuration on marketplaces.
 */
abstract contract ERC721Resale is ERC721, Ownable, IERC2981 {

    event RoyaltyChanged(address indexed receiver, uint256 percentBips);
    event RoyaltyMaxChanged(uint256 percentBipsMax);

    // Royalty Receiver
    address public royaltyReceiver;
    uint256 public royaltyPercentBips; // eg 15% royalty would be 1500 bips
    uint256 private _royaltyPercentBipsMax;

    constructor() {
        _setRoyaltyMax(10000);
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
        require(receiver != address(0), "ERC721Resale: receiver is the zero address");
        royaltyAmount = (_salePrice * royaltyPercentBips) / 10000; // 10,000 is 100% in bips
    }

    function _setRoyalty(address receiver, uint256 percentBips) internal virtual {
        require(percentBips <= 10000, "ERC721Resale: royalty percent BIPS must be <= 10000");
        require(percentBips <= _royaltyPercentBipsMax, "ERC721Resale: royalty percent BIPS must be <= maximum");
        require(receiver != address(0), "ERC721Resale: new receiver is the zero address");
        royaltyReceiver = receiver;
        royaltyPercentBips = percentBips;
        emit RoyaltyChanged(receiver, percentBips);
    }

    function _setRoyaltyMax(uint256 maxPercentBips) internal virtual {
        require(maxPercentBips <= 10000, "ERC721Resale: max royalty percent BIPS must be <= 10000");
        _royaltyPercentBipsMax = maxPercentBips;
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
        override(ERC721, IERC165)
        returns (bool)
    {
        return interfaceId == type(IERC2981).interfaceId || super.supportsInterface(interfaceId);
    }
}
