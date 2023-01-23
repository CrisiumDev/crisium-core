// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import "../../token/utils/IBatchMintable.sol";

/**
 * A "loot crate" is a collection of tokens, a specific amount from each of N
 * contracts, that are minted in response to a purchase. The randomization of
 * content is assumed to be handled by the token contract(s), which should
 * implement `IBatchMintable`.
 */
abstract contract BaseLootCrateSale {

  event Reveal(address indexed user, address indexed to, uint256 tokens);
  event SaleContentAdded(address indexed token, uint256 amount);
  event SaleContentRemoved(address indexed token, uint256 amount);

  struct SaleContent {
      address token;
      uint256 amount;
  }

  SaleContent[] private _saleContents;
  uint256 private _tokens;

  function saleContentsLength() public view returns (uint256) {
      return _saleContents.length;
  }

  function saleContents(uint256 index) public view returns (SaleContent memory) {
      return _saleContents[index];
  }

  function _reveal(address _user, address _to, uint256 _count) internal {
      for (uint256 i = 0; i < _saleContents.length; i++) {
          SaleContent storage content = _saleContents[i];
          IBatchMintable(content.token).safeMint(_to, _count * content.amount);
      }

      emit Reveal(_user, _to, _count * _tokens);
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

  /* TODO: restore if needed by a subcontract
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
  */

}
