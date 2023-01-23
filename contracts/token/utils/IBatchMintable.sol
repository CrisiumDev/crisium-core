// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

/**
 * An interface for minting batches of tokens to recipients.
 */
interface IBatchMintable {
    function safeMint(address to, uint256 amount) external;
}
