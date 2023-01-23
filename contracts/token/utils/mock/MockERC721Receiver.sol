// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

contract MockERC721Receiver is IERC721Receiver {
  event ERC721Received(
      address operator,
      address from,
      uint256 tokenId,
      bytes data
  );

  /**
   * @dev See {IERC721Receiver-onERC721Received}.
   *
   * Always returns `IERC721Receiver.onERC721Received.selector`.
   */
  function onERC721Received(
      address operator,
      address from,
      uint256 tokenId,
      bytes calldata data
  ) public virtual override returns (bytes4) {
      emit ERC721Received(operator, from, tokenId, data);
      return this.onERC721Received.selector;
  }
}
