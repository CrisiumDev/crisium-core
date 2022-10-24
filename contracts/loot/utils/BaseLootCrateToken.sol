// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import "../../token/utils/IBatchMintable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";

/**
 * A "loot crate" is a collection of tokens, a specific amount from each of N
 * contracts, that are minted in response to a purchase. The randomization of
 * content is assumed to be handled by the token contract(s), which should
 * implement `IBatchMintable`.
 */
abstract contract BaseLootCrateToken is ERC721Enumerable, IERC721Receiver {

  using Counters for Counters.Counter;

  event Purchase(address indexed user, address indexed to, uint256 indexed tokenId, uint256 tokens);
  event Reveal(address indexed user, address indexed to, uint256 indexed tokenId, uint256 tokens);
  event SaleContentAdded(address indexed token, uint256 amount);
  event SaleContentRemoved(address indexed token, uint256 amount);

  struct SaleContent {
      address token;
      uint256 amount;
  }

  struct CrateContent {
      address token;
      uint256 tokenId;
  }

  SaleContent[] private _saleContents;
  uint256 private _tokens;

  Counters.Counter private _tokenIdTracker;
  bool private _minting;

  mapping(uint256 => CrateContent[]) private _crateContents;

  function saleContentsLength() public view returns (uint256) {
      return _saleContents.length;
  }

  function saleContents(uint256 index) public view returns (SaleContent memory) {
      return _saleContents[index];
  }

  function crateContentsLength(uint256 tokenId) public view returns (uint256) {
      return _crateContents[tokenId].length;
  }

  function crateContents(uint256 tokenId, uint256 index) public view returns (CrateContent memory) {
      return _crateContents[tokenId][index];
  }

  function _mint(address _user, address _to, uint256 _count) internal {
      _minting = true;

      for (uint256 i = 0; i < _count; i++) {
          uint256 tokenId =  _tokenIdTracker.current();
          _mint(_to, tokenId);

          for (uint256 j = 0; j < _saleContents.length; j++) {
              SaleContent storage content = _saleContents[j];
              IBatchMintable(content.token).safeMint(address(this), content.amount);
          }

          _tokenIdTracker.increment();

          emit Purchase(_user, _to, tokenId, _tokens);
      }

      _minting = false;
  }

  function _reveal(address _user, address _to, uint256 _tokenId) internal {
      require(_exists(_tokenId), "BaseLootCrateToken: nonexistent token");

      uint256 count = _crateContents[_tokenId].length;
      for (uint256 i = 0; i < count; i++) {
          CrateContent storage content = _crateContents[_tokenId][i];
          ERC721(content.token).transferFrom(address(this), _to, content.tokenId);
      }
      _burn(_tokenId);
      emit Reveal(_user, _to, _tokenId, count);
  }

  function _addContent(address _token, uint256 _amount) internal returns (uint256) {
      _saleContents.push(SaleContent({
          token: _token,
          amount: _amount
      }));
      _tokens += _amount;
      emit SaleContentAdded(_token, _amount);
      return _saleContents.length - 1;
  }

  function _removeContent(uint256 _index, bool _shift) internal returns (SaleContent memory content) {
      content = _saleContents[_index];
      _tokens -= content.amount;
      if (_shift) {
        for (uint256 i = _index; i < _saleContents.length - 1; i++) {
            _saleContents[i].token = _saleContents[i + 1].token;
            _saleContents[i].amount = _saleContents[i + 1].amount;
        }
      } else {
        uint256 last = _saleContents.length - 1;
          _saleContents[_index].token = _saleContents[last].token;
          _saleContents[_index].amount = _saleContents[last].amount;
      }

      _saleContents.pop();
      emit SaleContentRemoved(content.token, content.amount);
  }

  function onERC721Received(
      address,
      address,
      uint256 tokenId,
      bytes memory
  ) public virtual override returns (bytes4) {
      require(_minting, "BaseLootCrateToken: not minting");

      _crateContents[_tokenIdTracker.current()].push(CrateContent({
          token: _msgSender(),
          tokenId: tokenId
      }));

      return this.onERC721Received.selector;
  }

}
