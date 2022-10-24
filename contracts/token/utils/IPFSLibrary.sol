// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

library IPFSLibrary {
    function uriSeemsValid(string memory uri) internal pure returns (bool valid) {
        // check for an IPFS URI. Can't verify real data is available at the
        // endpoint or (for future compatibility) impose hash format
        // requirements beyond schema and length chec;s.
        bytes memory prefix = bytes("ipfs://");
        bytes memory uriBytes = bytes(uri);
        valid = uriBytes.length >= 53;
        for (uint256 i = 0; i < prefix.length && valid; i++) {
            if (prefix[i] != uriBytes[i]) valid = false;
        }
    }
}
