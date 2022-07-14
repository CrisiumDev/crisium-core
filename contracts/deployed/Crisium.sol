// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";

contract Crisium is ERC20Votes {
  constructor(
      string memory name_,
      string memory symbol_,
      address supplyHolder_,
      uint256 supply_
  ) ERC20(name_, symbol_) ERC20Permit(name_) {
      _mint(supplyHolder_, supply_);
  }
}
