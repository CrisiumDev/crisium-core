# crisium-core
Smart contracts for Crisium project

## Crisium

Crisium is an ERC-20 token with fixed supply. The entire supply is minted at deployment time and held by a storage contract (not included) for staged release.

## Founders Key

The Founders Key is an ERC-721 token granting the holders specific future privileges; e.g. access to features on future smart contracts, airdrops, etc. All Founders Keys are equivalent in available features.

## Mission Components

Mission Components are ERC-721 tokens that may be staked in combination to receive rewards (staking contract not included). Component details and staking value are fairly distributed using a pregenerated release list and associated provenance record. Token URIs are set in stages until all tokens are revealed or a prespecified end date is reached, at which point the full provenance record will be publicly revealed.

## Mission Loot Crate

Mission Components are purchased in blind-box crates, themselves ERC-721 tokens, which can be purchased and traded before their contents are revealed. Opening a crate destroys the token and transfers its contents to a recipient (likely the crate owner). After this an off-chain system will set the associated component URIs on the newly revealed tokens.
