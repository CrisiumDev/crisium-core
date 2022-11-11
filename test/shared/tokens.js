const { expectRevert, expectEvent, time } = require('@openzeppelin/test-helpers');
const MockContract = artifacts.require('MockContract');
const MockERC721Receiver = artifacts.require('MockERC721Receiver');

const { ZERO_ADDRESS } = require('@openzeppelin/test-helpers').constants;
const MAX_INT_STR = "115792089237316195423570985008687907853269984665640564039457584007913129639935";

const DEFAULT_ADMIN_ROLE = "0x00"

const MINTER_ROLE = web3.utils.soliditySha3('MINTER_ROLE');
const REVEAL_ROLE = web3.utils.soliditySha3('REVEAL_ROLE');
const ROYALTY_ROLE = web3.utils.soliditySha3('ROYALTY_ROLE');

const ROLE_PERMISSIONS = {
  deployer: [MINTER_ROLE, REVEAL_ROLE, ROYALTY_ROLE],
  minter: [MINTER_ROLE],
  reveal: [REVEAL_ROLE],
  royalty: [ROYALTY_ROLE]
}

const config = {
  hasRevealer: true,
  mint: async ({ token, to, from, count }) => {
    const options = from ? { from } : {};
    for (let i = 0; i < (count || 1); i++) {
      await token.mint(to, options);
    }
  }
}

function testUtilityConfig(tester, accountNames = ["deployer", "alice", "bob", "carol", "dave", "minter", "revealer"]) {
  it("testing utility is properly configured", async () => {
    assert.ok(!!tester.token, "token is set");
    for (const accountName of accountNames) {
      assert.ok(!!tester[accountName], `account "${accountName}" is set`);
    }
    for (const accountName in ROLE_PERMISSIONS) {
      const account = tester[accountName];
      if (accountNames.includes(accountName)) {
        for (const role of ROLE_PERMISSIONS[accountName]) {
          let test = false;
          test = test || role == MINTER_ROLE;
          test = test || role == REVEAL_ROLE && config.hasRevealer;
          test = test || role == ROYALTY_ROLE;
          if (test) assert.ok(await tester.token.hasRole(role, account), `account "${accountName}" has role ${role}`)
        }
      }
    }
  });
}

function testMint(tester, testConfig = true) {
  context('mint', () => {
    if (testConfig) testUtilityConfig(tester, ["deployer", "alice",  "bob", "carol", "minter"]);

    it('non-minters cannot mint', async () =>  {
      const { token, alice, bob, carol } = tester;

      await expectRevert(
        token.mint(alice, { from:bob }),
        "IMSpaceAccessToken: must have minter role to mint",
      );

      await expectRevert(
        token.mint(carol, { from:carol }),
        "IMSpaceAccessToken: must have minter role to mint",
      );
    });

    it('minting creates a token owned by the address provided', async () => {
      const { token, deployer, alice, bob, minter } = tester;

      await token.mint(alice, { from:deployer });

      assert.equal(await token.totalSupply(), '1');
      assert.equal(await token.balanceOf(alice), '1');
      assert.equal(await token.balanceOf(deployer), '0');

      assert.equal(await token.tokenByIndex(0), '0');
      assert.equal(await token.tokenOfOwnerByIndex(alice, 0), '0');

      await token.mint(alice, { from:minter });
      await token.mint(alice, { from:minter });
      await token.mint(alice, { from:minter });
      await token.mint(bob, { from:minter });
      await token.mint(bob, { from:minter });
      await token.mint(bob, { from:minter });
      await token.mint(bob, { from:minter });
      await token.mint(bob, { from:minter });

      assert.equal(await token.totalSupply(), '9');
      assert.equal(await token.balanceOf(alice), '4');
      assert.equal(await token.balanceOf(bob), '5');

      assert.equal(await token.tokenByIndex(0), '0');
      assert.equal(await token.tokenByIndex(1), '1');
      assert.equal(await token.tokenByIndex(2), '2');
      assert.equal(await token.tokenByIndex(3), '3');
      assert.equal(await token.tokenByIndex(4), '4');
      assert.equal(await token.tokenByIndex(5), '5');
      assert.equal(await token.tokenByIndex(6), '6');
      assert.equal(await token.tokenByIndex(7), '7');
      assert.equal(await token.tokenByIndex(8), '8');
      assert.equal(await token.tokenOfOwnerByIndex(alice, 0), '0');
      assert.equal(await token.tokenOfOwnerByIndex(alice, 1), '1');
      assert.equal(await token.tokenOfOwnerByIndex(alice, 2), '2');
      assert.equal(await token.tokenOfOwnerByIndex(alice, 3), '3');
      assert.equal(await token.tokenOfOwnerByIndex(bob, 0), '4');
      assert.equal(await token.tokenOfOwnerByIndex(bob, 1), '5');
      assert.equal(await token.tokenOfOwnerByIndex(bob, 2), '6');
      assert.equal(await token.tokenOfOwnerByIndex(bob, 3), '7');
      assert.equal(await token.tokenOfOwnerByIndex(bob, 4), '8');
    });
  });
}

function testSafeMint(tester, testConfig = true) {
  context('safeMint(address,uint256)', () => {
    if (testConfig) testUtilityConfig(tester, ["deployer", "alice",  "bob", "carol", "minter"]);

    it('non-minters cannot safeMint', async () =>  {
      const { token, alice, bob, carol } = tester;

      await expectRevert(
        token.safeMint(alice, 1, { from:bob }),
        "IBatchMintable: must have minter role to mint",
      );

      await expectRevert(
        token.safeMint(carol, 10, { from:carol }),
        "IBatchMintable: must have minter role to mint",
      );
    });

    it('minting creates tokens owned by the address provided', async () => {
      const { token, deployer, alice, bob, minter } = tester;

      await token.safeMint(alice, 5, { from:deployer });

      assert.equal(await token.totalSupply(), '5');
      assert.equal(await token.balanceOf(alice), '5');
      assert.equal(await token.balanceOf(deployer), '0');

      for (let i = 0; i < 5; i++) {
        assert.equal(await token.tokenByIndex(i), `${i}`);
        assert.equal(await token.tokenOfOwnerByIndex(alice, i), `${i}`);
      }

      await token.safeMint(bob, 4, { from:minter });
      await token.safeMint(alice, 2, { from:minter });

      assert.equal(await token.totalSupply(), '11');
      assert.equal(await token.balanceOf(alice), '7');
      assert.equal(await token.balanceOf(bob), '4');

      assert.equal(await token.tokenByIndex(0), '0');
      assert.equal(await token.tokenByIndex(1), '1');
      assert.equal(await token.tokenByIndex(2), '2');
      assert.equal(await token.tokenByIndex(3), '3');
      assert.equal(await token.tokenByIndex(4), '4');
      assert.equal(await token.tokenByIndex(5), '5');
      assert.equal(await token.tokenByIndex(6), '6');
      assert.equal(await token.tokenByIndex(7), '7');
      assert.equal(await token.tokenByIndex(8), '8');
      assert.equal(await token.tokenByIndex(9), '9');
      assert.equal(await token.tokenByIndex(10), '10');
      assert.equal(await token.tokenOfOwnerByIndex(alice, 0), '0');
      assert.equal(await token.tokenOfOwnerByIndex(alice, 1), '1');
      assert.equal(await token.tokenOfOwnerByIndex(alice, 2), '2');
      assert.equal(await token.tokenOfOwnerByIndex(alice, 3), '3');
      assert.equal(await token.tokenOfOwnerByIndex(alice, 4), '4');
      assert.equal(await token.tokenOfOwnerByIndex(alice, 5), '9');
      assert.equal(await token.tokenOfOwnerByIndex(alice, 6), '10');
      assert.equal(await token.tokenOfOwnerByIndex(bob, 0), '5');
      assert.equal(await token.tokenOfOwnerByIndex(bob, 1), '6');
      assert.equal(await token.tokenOfOwnerByIndex(bob, 2), '7');
      assert.equal(await token.tokenOfOwnerByIndex(bob, 3), '8');
    });
  });
}

function testSetBaseURI(tester, testConfig = true) {
  context('setBaseURI', () => {
    if (testConfig) testUtilityConfig(tester, ["deployer", "alice", "revealer", "minter"]);

    it('non-revealers cannot setBaseURI', async () => {
      const { token, deployer, alice, revealer, minter } = tester;

      await expectRevert(
        token.setBaseURI("ipfs://QmT1yQm5qrcCXGcvLpNj8U74VNHfTUn19Z4fpFwjWaU6HB", { from:alice }),
        "IMSpaceMissionToken: must have reveal role to set base URI"
      );

      await expectRevert(
        token.setBaseURI("ipfs://QmTi2RCFGmPFconYf12VoZGeXTVxF6UQcpawysb3tHcsGg", { from:minter }),
        "IMSpaceMissionToken: must have reveal role to set base URI"
      );
    });

    it('setBaseURI alters URI for all tokens', async () => {
      const { token, deployer, alice, bob, revealer, minter } = tester;

      await token.safeMint(alice, 10, { from:minter });

      assert.equal(await token.tokenURI(0), "");
      assert.equal(await token.tokenURI(1), "");
      assert.equal(await token.tokenURI(9), "");
      await expectRevert(token.tokenURI(10), "ERC721: invalid token ID");

      await token.setBaseURI("ipfs://QmTi2RCFGmPFconYf12VoZGeXTVxF6UQcpawysb3tHcsGg/", { from:deployer }),

      // check URIs
      assert.equal(await token.tokenURI(0), "ipfs://QmTi2RCFGmPFconYf12VoZGeXTVxF6UQcpawysb3tHcsGg/0");
      assert.equal(await token.tokenURI(1), "ipfs://QmTi2RCFGmPFconYf12VoZGeXTVxF6UQcpawysb3tHcsGg/1");
      assert.equal(await token.tokenURI(9), "ipfs://QmTi2RCFGmPFconYf12VoZGeXTVxF6UQcpawysb3tHcsGg/9");

      await expectRevert(token.tokenURI(10), "ERC721: invalid token ID");
      await expectRevert(token.tokenURI(20), "ERC721: invalid token ID");

      await token.safeMint(bob, 10, { from:deployer });

      assert.equal(await token.tokenURI(10), "ipfs://QmTi2RCFGmPFconYf12VoZGeXTVxF6UQcpawysb3tHcsGg/10");
      assert.equal(await token.tokenURI(19), "ipfs://QmTi2RCFGmPFconYf12VoZGeXTVxF6UQcpawysb3tHcsGg/19");
      await expectRevert(token.tokenURI(20), "ERC721: invalid token ID");

      await token.setBaseURI("ipfs://QmT1yQm5qrcCXGcvLpNj8U74VNHfTUn19Z4fpFwjWaU6HB/tokens/", { from:revealer });

      assert.equal(await token.tokenURI(0), "ipfs://QmT1yQm5qrcCXGcvLpNj8U74VNHfTUn19Z4fpFwjWaU6HB/tokens/0");
      assert.equal(await token.tokenURI(1), "ipfs://QmT1yQm5qrcCXGcvLpNj8U74VNHfTUn19Z4fpFwjWaU6HB/tokens/1");
      assert.equal(await token.tokenURI(9), "ipfs://QmT1yQm5qrcCXGcvLpNj8U74VNHfTUn19Z4fpFwjWaU6HB/tokens/9");
      assert.equal(await token.tokenURI(10), "ipfs://QmT1yQm5qrcCXGcvLpNj8U74VNHfTUn19Z4fpFwjWaU6HB/tokens/10");
      assert.equal(await token.tokenURI(19), "ipfs://QmT1yQm5qrcCXGcvLpNj8U74VNHfTUn19Z4fpFwjWaU6HB/tokens/19");
      await expectRevert(token.tokenURI(20), "ERC721: invalid token ID");
    });
  });
}

function testSetTokenURI(tester, testConfig = true) {
  context('setBaseURI, setTokenURI', () => {
    if (testConfig) testUtilityConfig(tester, ["deployer", "alice", "revealer", "minter"]);

    it('non-revealers cannot setBaseURI', async () => {
      const { token, deployer, alice, revealer, minter } = tester;

      await expectRevert(
        token.setBaseURI("ipfs://QmT1yQm5qrcCXGcvLpNj8U74VNHfTUn19Z4fpFwjWaU6HB/", { from:alice }),
        "IMSpaceMissionToken: must have reveal role to set base URI"
      );

      await expectRevert(
        token.setBaseURI("ipfs://QmT1yQm5qrcCXGcvLpNj8U74VNHfTUn19Z4fpFwjWaU6HB/", { from:minter }),
        "IMSpaceMissionToken: must have reveal role to set base URI"
      );
    });

    it('non-revealers cannot setTokenURI', async () => {
      const { token, deployer, alice, revealer, minter } = tester;

      await token.safeMint(alice, 10, { from:minter });

      await expectRevert(
        token.setTokenURI(0, "ipfs://QmTi2RCFGmPFconYf12VoZGeXTVxF6UQcpawysb3tHcsGg/custom/0", { from:alice }),
        "IMSpaceMissionToken: must have reveal role to set token URI"
      );

      await expectRevert(
        token.setTokenURI(9, "ipfs://QmTi2RCFGmPFconYf12VoZGeXTVxF6UQcpawysb3tHcsGg/custom/nine", { from:minter }),
        "IMSpaceMissionToken: must have reveal role to set token URI"
      );
    });

    it('cannot setTokenURI for nonexistent token', async () => {
      const { token, deployer, alice, revealer, minter } = tester;

      await expectRevert(
        token.setTokenURI(0, "ipfs://QmTi2RCFGmPFconYf12VoZGeXTVxF6UQcpawysb3tHcsGg/custom/0", { from:deployer }),
        "ERC721: invalid token ID"
      );

      await token.safeMint(alice, 10, { from:minter });

      await expectRevert(
        token.setTokenURI(10, "ipfs://QmTi2RCFGmPFconYf12VoZGeXTVxF6UQcpawysb3tHcsGg/custom/eleven", { from:revealer }),
        "ERC721: invalid token ID"
      );
    });

    it('setBaseURI alters URI for all tokens', async () => {
      const { token, deployer, alice, bob, revealer, minter } = tester;

      await token.safeMint(alice, 10, { from:minter });

      assert.equal(await token.tokenURI(0), "");
      assert.equal(await token.tokenURI(1), "");
      assert.equal(await token.tokenURI(9), "");
      await expectRevert(token.tokenURI(10), "ERC721: invalid token ID");

      await token.setBaseURI("ipfs://QmTi2RCFGmPFconYf12VoZGeXTVxF6UQcpawysb3tHcsGg/", { from:deployer }),

      // check URIs
      assert.equal(await token.tokenURI(0), "ipfs://QmTi2RCFGmPFconYf12VoZGeXTVxF6UQcpawysb3tHcsGg/0");
      assert.equal(await token.tokenURI(1), "ipfs://QmTi2RCFGmPFconYf12VoZGeXTVxF6UQcpawysb3tHcsGg/1");
      assert.equal(await token.tokenURI(9), "ipfs://QmTi2RCFGmPFconYf12VoZGeXTVxF6UQcpawysb3tHcsGg/9");

      await expectRevert(token.tokenURI(10), "ERC721: invalid token ID");
      await expectRevert(token.tokenURI(20), "ERC721: invalid token ID");

      await token.safeMint(bob, 10, { from:deployer });

      assert.equal(await token.tokenURI(10), "ipfs://QmTi2RCFGmPFconYf12VoZGeXTVxF6UQcpawysb3tHcsGg/10");
      assert.equal(await token.tokenURI(19), "ipfs://QmTi2RCFGmPFconYf12VoZGeXTVxF6UQcpawysb3tHcsGg/19");
      await expectRevert(token.tokenURI(20), "ERC721: invalid token ID");

      await token.setBaseURI("ipfs://QmT1yQm5qrcCXGcvLpNj8U74VNHfTUn19Z4fpFwjWaU6HB/tokens/", { from:revealer });

      assert.equal(await token.tokenURI(0), "ipfs://QmT1yQm5qrcCXGcvLpNj8U74VNHfTUn19Z4fpFwjWaU6HB/tokens/0");
      assert.equal(await token.tokenURI(1), "ipfs://QmT1yQm5qrcCXGcvLpNj8U74VNHfTUn19Z4fpFwjWaU6HB/tokens/1");
      assert.equal(await token.tokenURI(9), "ipfs://QmT1yQm5qrcCXGcvLpNj8U74VNHfTUn19Z4fpFwjWaU6HB/tokens/9");
      assert.equal(await token.tokenURI(10), "ipfs://QmT1yQm5qrcCXGcvLpNj8U74VNHfTUn19Z4fpFwjWaU6HB/tokens/10");
      assert.equal(await token.tokenURI(19), "ipfs://QmT1yQm5qrcCXGcvLpNj8U74VNHfTUn19Z4fpFwjWaU6HB/tokens/19");
      await expectRevert(token.tokenURI(20), "ERC721: invalid token ID");
    });

    it('setTokenURI alters URI for the specified token', async () => {
      const { token, deployer, alice, bob, revealer, minter } = tester;

      await token.safeMint(alice, 10, { from:minter });

      await token.setTokenURI(2,  "ipfs://QmT1yQm5qrcCXGcvLpNj8U74VNHfTUn19Z4fpFwjWaU6HB/tokens/two", { from:deployer });

      assert.equal(await token.tokenURI(0), "");
      assert.equal(await token.tokenURI(1), "");
      assert.equal(await token.tokenURI(2), "ipfs://QmT1yQm5qrcCXGcvLpNj8U74VNHfTUn19Z4fpFwjWaU6HB/tokens/two");
      assert.equal(await token.tokenURI(9), "");
      await expectRevert(token.tokenURI(10), "ERC721: invalid token ID");

      await token.setTokenURI(1,  "ipfs://QmT1yQm5qrcCXGcvLpNj8U74VNHfTUn19Z4fpFwjWaU6HB/tokens/one", { from:revealer });

      assert.equal(await token.tokenURI(0), "");
      assert.equal(await token.tokenURI(1), "ipfs://QmT1yQm5qrcCXGcvLpNj8U74VNHfTUn19Z4fpFwjWaU6HB/tokens/one");
      assert.equal(await token.tokenURI(2), "ipfs://QmT1yQm5qrcCXGcvLpNj8U74VNHfTUn19Z4fpFwjWaU6HB/tokens/two");
      assert.equal(await token.tokenURI(9), "");
      await expectRevert(token.tokenURI(10), "ERC721: invalid token ID");

      await token.setBaseURI("ipfs://QmTi2RCFGmPFconYf12VoZGeXTVxF6UQcpawysb3tHcsGg/", { from:revealer });

      assert.equal(await token.tokenURI(0), "ipfs://QmTi2RCFGmPFconYf12VoZGeXTVxF6UQcpawysb3tHcsGg/0");
      assert.equal(await token.tokenURI(1), "ipfs://QmT1yQm5qrcCXGcvLpNj8U74VNHfTUn19Z4fpFwjWaU6HB/tokens/one");
      assert.equal(await token.tokenURI(2), "ipfs://QmT1yQm5qrcCXGcvLpNj8U74VNHfTUn19Z4fpFwjWaU6HB/tokens/two");
      assert.equal(await token.tokenURI(9), "ipfs://QmTi2RCFGmPFconYf12VoZGeXTVxF6UQcpawysb3tHcsGg/9");
      await expectRevert(token.tokenURI(10), "ERC721: invalid token ID");

      await token.safeMint(bob, 10, { from:deployer });

      assert.equal(await token.tokenURI(10), "ipfs://QmTi2RCFGmPFconYf12VoZGeXTVxF6UQcpawysb3tHcsGg/10");
      assert.equal(await token.tokenURI(19), "ipfs://QmTi2RCFGmPFconYf12VoZGeXTVxF6UQcpawysb3tHcsGg/19");
      await expectRevert(token.tokenURI(20), "ERC721: invalid token ID");

      await token.setTokenURI(1,  "ipfs://QmT1yQm5qrcCXGcvLpNj8U74VNHfTUn19Z4fpFwjWaU6HB/revision/one", { from:revealer });
      await token.setBaseURI("ipfs://QmTi2RCFGmPFconYf12VoZGeXTVxF6UQcpawysb3tHcsGg/replacement/", { from:revealer });
      await token.setTokenURI(9,  "ipfs://QmT1yQm5qrcCXGcvLpNj8U74VNHfTUn19Z4fpFwjWaU6HB/tokens/nine", { from:revealer });

      assert.equal(await token.tokenURI(0), "ipfs://QmTi2RCFGmPFconYf12VoZGeXTVxF6UQcpawysb3tHcsGg/replacement/0");
      assert.equal(await token.tokenURI(1), "ipfs://QmT1yQm5qrcCXGcvLpNj8U74VNHfTUn19Z4fpFwjWaU6HB/revision/one");
      assert.equal(await token.tokenURI(2), "ipfs://QmT1yQm5qrcCXGcvLpNj8U74VNHfTUn19Z4fpFwjWaU6HB/tokens/two");
      assert.equal(await token.tokenURI(9), "ipfs://QmT1yQm5qrcCXGcvLpNj8U74VNHfTUn19Z4fpFwjWaU6HB/tokens/nine");
      assert.equal(await token.tokenURI(10), "ipfs://QmTi2RCFGmPFconYf12VoZGeXTVxF6UQcpawysb3tHcsGg/replacement/10");
      assert.equal(await token.tokenURI(19), "ipfs://QmTi2RCFGmPFconYf12VoZGeXTVxF6UQcpawysb3tHcsGg/replacement/19");
      await expectRevert(token.tokenURI(20), "ERC721: invalid token ID");
    });
  });
}

function testSetRoyalty(tester, testConfig = true) {
  context('setRoyalty', () => {
    if (testConfig) testUtilityConfig(tester, ["deployer", "royalty", "alice", "bob", "carol", "minter"]);

    it('non-royalty-setter cannot setRoyalty', async () => {
      const { token, deployer, alice, bob, minter, royalty } = tester;

      await expectRevert(
        token.setRoyalty(alice, 1000, { from:alice }),
        "ERC721Resale: must have royalty role to set royalty"
      );

      await expectRevert(
        token.setRoyalty(bob, 10, { from:minter }),
        "ERC721Resale: must have royalty role to set royalty"
      );
    });

    it('cannot setRoyalty to zero-address', async () => {
      const { token, deployer, alice, bob, carol, minter } = tester;

      await expectRevert(
        token.setRoyalty(ZERO_ADDRESS, 1000, { from:deployer }),
        "ERC721Resale: new receiver is the zero address"
      );

      await expectRevert(
        token.setRoyalty(ZERO_ADDRESS, 10, { from:deployer }),
        "ERC721Resale: new receiver is the zero address"
      );
    });

    it('cannot setRoyalty to > 100%', async () => {
      const { token, deployer, alice, bob, carol, minter } = tester;

      await expectRevert(
        token.setRoyalty(alice, 10001, { from:deployer }),
        "ERC721Resale: royalty percent BIPS must be <= 10000"
      );

      await expectRevert(
        token.setRoyalty(bob, 99999999999, { from:deployer }),
        "ERC721Resale: royalty percent BIPS must be <= 10000"
      );
    });

    it('setRoyalty alters royalty parameters', async () => {
      const { token, deployer, royalty, alice, bob, carol, dave } = tester;

      await token.setRoyalty(alice, 250, { from:deployer });
      assert.equal(await token.royaltyReceiver(), alice);
      assert.equal(await token.royaltyPercentBips(), '250');

      await token.setRoyalty(bob, 1000, { from:royalty });
      assert.equal(await token.royaltyReceiver(), bob);
      assert.equal(await token.royaltyPercentBips(), '1000');

      await token.grantRole(ROYALTY_ROLE, carol, { from:deployer });
      assert.equal(await token.royaltyReceiver(), bob);
      assert.equal(await token.royaltyPercentBips(), '1000');

      await token.setRoyalty(dave, 150, { from:carol });
      assert.equal(await token.royaltyReceiver(), dave);
      assert.equal(await token.royaltyPercentBips(), '150');
    });

    it('setRoyalty emits RoyaltyChanged event', async () => {
      const { token, deployer, royalty, alice, bob } = tester;

      let res = await token.setRoyalty(alice, 250, { from:deployer });
      await expectEvent.inTransaction(res.tx, token, 'RoyaltyChanged', {
        receiver: alice,
        percentBips: '250'
      });

      res = await token.setRoyalty(bob, 1000, { from:royalty });
      await expectEvent.inTransaction(res.tx, token, 'RoyaltyChanged', {
        receiver: bob,
        percentBips: '1000'
      });
    });
  });
}

function testRoyaltyInfo(tester, testConfig = true) {
  context('royaltyInfo', () => {
    if (testConfig) testUtilityConfig(tester, ["deployer", "alice", "bob", "minter"]);

    it('royaltyInfo reports expected values', async () => {
      const { token, deployer, alice, bob } = tester;
      let res;

      res = await token.royaltyInfo(0, 10000);
      assert.equal(res.receiver, deployer);
      assert.equal(res.royaltyAmount, '0');

      res = await token.royaltyInfo(1, 30000);
      assert.equal(res.receiver, deployer);
      assert.equal(res.royaltyAmount, '0');

      res = await token.royaltyInfo(0, 200000);
      assert.equal(res.receiver, deployer);
      assert.equal(res.royaltyAmount, '0');

      res = await token.royaltyInfo(1, 100);
      assert.equal(res.receiver, deployer);
      assert.equal(res.royaltyAmount, '0');
    });

    it('royaltyInfo reports expected values after setRoyalty', async () => {
      const { token, deployer, alice, bob } = tester;
      let res;

      // set 4%
      await token.setRoyalty(alice, 400, { from:deployer });
      res = await token.royaltyInfo(0, 100);
      assert.equal(res.receiver, alice);
      assert.equal(res.royaltyAmount, '4');

      res = await token.royaltyInfo(1, 20000);
      assert.equal(res.receiver, alice);
      assert.equal(res.royaltyAmount, '800');

      // set 10%
      await token.setRoyalty(bob, 1000, { from:deployer });
      res = await token.royaltyInfo(0, 100);
      assert.equal(res.receiver, bob);
      assert.equal(res.royaltyAmount, '10');

      res = await token.royaltyInfo(1, 20000);
      assert.equal(res.receiver, bob);
      assert.equal(res.royaltyAmount, '2000');
    });
  });
}

function testTransferFrom(tester, testConfig = true) {
  context('transferFrom', () => {
    if (testConfig) testUtilityConfig(tester, ["deployer", "alice", "bob", "carol", "dave", "minter"]);

    it('strangers cannot transferFrom tokens', async () => {
      const { token, deployer, alice, bob, carol, dave, minter } = tester;

      await config.mint({ token, to:alice, from:deployer, count:2 });
      await config.mint({ token, to:bob, from:minter, count:2 });

      await expectRevert(
        token.transferFrom(alice, dave, 0, { from:bob }),
        "ERC721: caller is not token owner or approved",
      );

      await expectRevert(
        token.transferFrom(alice, dave, 1, { from:minter }),
        "ERC721: caller is not token owner or approved",
      );

      await token.approve(minter, 2, { from:bob });
      await token.approve(alice, 3, { from:bob });

      await expectRevert(
        token.transferFrom(bob, dave, 2, { from:alice }),
        "ERC721: caller is not token owner or approved",
      );

      await expectRevert(
        token.transferFrom(bob, dave, 3, { from:deployer }),
        "ERC721: caller is not token owner or approved",
      );
    });

    it('cannot transferFrom tokens from wrong address', async () => {
      const { token, deployer, alice, bob, carol, dave, minter } = tester;

      await config.mint({ token, to:alice, from:deployer });
      await config.mint({ token, to:bob, from:minter });

      await token.setApprovalForAll(bob, true, { from:alice });
      await token.setApprovalForAll(bob, true, { from:carol });
      await expectRevert(
        token.transferFrom(alice, dave, 1, { from:bob }),
        "ERC721: transfer from incorrect owner",
      );

      await expectRevert(
        token.transferFrom(bob, dave, 0, { from:bob }),
        "ERC721: transfer from incorrect owner",
      );

      await expectRevert(
        token.transferFrom(carol, dave, 1, { from:bob }),
        "ERC721: transfer from incorrect owner",
      );
    });

    it('transferFrom transfers tokens from wallet', async () => {
      const { token, deployer, alice, bob, carol, dave, minter } = tester;

      await config.mint({ token, to:alice, from:deployer, count:4 });
      await config.mint({ token, to:bob, from:minter, count:5 });
      await config.mint({ token, to:carol, from:minter, count:6 });

      // alice: transfer own tokens to dave
      await token.transferFrom(alice, dave, 0, { from:alice });
      await token.transferFrom(alice, dave, 2, { from:alice });

      // bob: transferred by dave, who has blanket approval
      await token.setApprovalForAll(dave, true, { from:bob });
      await token.transferFrom(bob, dave, 5, { from:dave });
      await token.transferFrom(bob, dave, 7, { from:dave });

      // carol: transferred to alice by various people with specific token approval
      await token.approve(alice, 9, { from:carol });
      await token.approve(bob, 12, { from:carol });
      await token.transferFrom(carol, alice, 9, { from:alice });
      await token.transferFrom(carol, alice, 12, { from:bob });

      // new token IDs
      // alice 1, 3, 9, 12
      // bob 4, 6, 8
      // carol 10, 11, 13, 14
      // dave 0, 2, 5, 7

      // balances
      assert.equal(await token.totalSupply(), '15');
      assert.equal(await token.balanceOf(alice), '4');
      assert.equal(await token.balanceOf(bob), '3');
      assert.equal(await token.balanceOf(carol), '4');
      assert.equal(await token.balanceOf(dave), '4');

      // owners
      assert.equal(await token.ownerOf(0), dave);
      assert.equal(await token.ownerOf(1), alice);
      assert.equal(await token.ownerOf(2), dave);
      assert.equal(await token.ownerOf(3), alice);
      assert.equal(await token.ownerOf(4), bob);
      assert.equal(await token.ownerOf(5), dave);
      assert.equal(await token.ownerOf(6), bob);
      assert.equal(await token.ownerOf(7), dave);
      assert.equal(await token.ownerOf(8), bob);
      assert.equal(await token.ownerOf(9), alice);
      assert.equal(await token.ownerOf(10), carol);
      assert.equal(await token.ownerOf(11), carol);
      assert.equal(await token.ownerOf(12), alice);
      assert.equal(await token.ownerOf(13), carol);
      assert.equal(await token.ownerOf(14), carol);

      // enumeration
      assert.equal(await token.tokenOfOwnerByIndex(alice, 0), '3');
      assert.equal(await token.tokenOfOwnerByIndex(alice, 1), '1');
      assert.equal(await token.tokenOfOwnerByIndex(alice, 2), '9');
      assert.equal(await token.tokenOfOwnerByIndex(alice, 3), '12');

      assert.equal(await token.tokenOfOwnerByIndex(bob, 0), '4');
      assert.equal(await token.tokenOfOwnerByIndex(bob, 1), '8');
      assert.equal(await token.tokenOfOwnerByIndex(bob, 2), '6');

      assert.equal(await token.tokenOfOwnerByIndex(carol, 0), '14');
      assert.equal(await token.tokenOfOwnerByIndex(carol, 1), '10');
      assert.equal(await token.tokenOfOwnerByIndex(carol, 2), '11');
      assert.equal(await token.tokenOfOwnerByIndex(carol, 3), '13');

      assert.equal(await token.tokenOfOwnerByIndex(dave, 0), '0');
      assert.equal(await token.tokenOfOwnerByIndex(dave, 1), '2');
      assert.equal(await token.tokenOfOwnerByIndex(dave, 2), '5');
      assert.equal(await token.tokenOfOwnerByIndex(dave, 3), '7');
    });
  });
}

function testSafeTransferFrom(tester, testConfig = true) {
  context('safeTransferFrom', () => {
    if (testConfig) testUtilityConfig(tester, ["deployer", "alice", "bob", "carol", "dave", "minter"]);

    it('strangers cannot safeTransferFrom tokens', async () => {
      const { token, deployer, alice, bob, carol, dave, minter } = tester;

      await config.mint({ token, to:alice, from:deployer, count:2 });
      await config.mint({ token, to:bob, from:minter, count:2 });

      await expectRevert(
        token.safeTransferFrom(alice, dave, 0, { from:bob }),
        "ERC721: caller is not token owner or approved",
      );

      await expectRevert(
        token.safeTransferFrom(alice, dave, 1, { from:minter }),
        "ERC721: caller is not token owner or approved",
      );

      await token.approve(minter, 2, { from:bob });
      await token.approve(alice, 3, { from:bob });

      await expectRevert(
        token.safeTransferFrom(bob, dave, 2, { from:alice }),
        "ERC721: caller is not token owner or approved",
      );

      await expectRevert(
        token.safeTransferFrom(bob, dave, 3, { from:deployer }),
        "ERC721: caller is not token owner or approved",
      );
    });

    it('cannot safeTransferFrom tokens from wrong address', async () => {
      const { token, deployer, alice, bob, carol, dave, minter } = tester;

      await config.mint({ token, to:alice, from:deployer });
      await config.mint({ token, to:bob, from:minter });

      await token.setApprovalForAll(bob, true, { from:alice });
      await token.setApprovalForAll(bob, true, { from:carol });
      await expectRevert(
        token.safeTransferFrom(alice, dave, 1, { from:bob }),
        "ERC721: transfer from incorrect owner",
      );

      await expectRevert(
        token.safeTransferFrom(bob, dave, 0, { from:bob }),
        "ERC721: transfer from incorrect owner",
      );

      await expectRevert(
        token.safeTransferFrom(carol, dave, 1, { from:bob }),
        "ERC721: transfer from incorrect owner",
      );
    });

    it('safeTransferFrom transfers tokens from wallet', async () => {
      const { token, deployer, alice, bob, carol, dave, minter } = tester;

      await config.mint({ token, to:alice, from:deployer, count:4 });
      await config.mint({ token, to:bob, from:minter, count:5 });
      await config.mint({ token, to:carol, from:minter, count:6 });

      // alice: transfer own tokens to dave
      await token.safeTransferFrom(alice, dave, 0, { from:alice });
      await token.safeTransferFrom(alice, dave, 2, { from:alice });

      // bob: transferred by dave, who has blanket approval
      await token.setApprovalForAll(dave, true, { from:bob });
      await token.safeTransferFrom(bob, dave, 5, { from:dave });
      await token.safeTransferFrom(bob, dave, 7, { from:dave });

      // carol: transferred to alice by various people with specific token approval
      await token.approve(alice, 9, { from:carol });
      await token.approve(bob, 12, { from:carol });
      await token.safeTransferFrom(carol, alice, 9, { from:alice });
      await token.safeTransferFrom(carol, alice, 12, { from:bob });

      // new token IDs
      // alice 1, 3, 9, 12
      // bob 4, 6, 8
      // carol 10, 11, 13, 14
      // dave 0, 2, 5, 7

      // balances
      assert.equal(await token.totalSupply(), '15');
      assert.equal(await token.balanceOf(alice), '4');
      assert.equal(await token.balanceOf(bob), '3');
      assert.equal(await token.balanceOf(carol), '4');
      assert.equal(await token.balanceOf(dave), '4');

      // owners
      assert.equal(await token.ownerOf(0), dave);
      assert.equal(await token.ownerOf(1), alice);
      assert.equal(await token.ownerOf(2), dave);
      assert.equal(await token.ownerOf(3), alice);
      assert.equal(await token.ownerOf(4), bob);
      assert.equal(await token.ownerOf(5), dave);
      assert.equal(await token.ownerOf(6), bob);
      assert.equal(await token.ownerOf(7), dave);
      assert.equal(await token.ownerOf(8), bob);
      assert.equal(await token.ownerOf(9), alice);
      assert.equal(await token.ownerOf(10), carol);
      assert.equal(await token.ownerOf(11), carol);
      assert.equal(await token.ownerOf(12), alice);
      assert.equal(await token.ownerOf(13), carol);
      assert.equal(await token.ownerOf(14), carol);

      // enumeration
      assert.equal(await token.tokenOfOwnerByIndex(alice, 0), '3');
      assert.equal(await token.tokenOfOwnerByIndex(alice, 1), '1');
      assert.equal(await token.tokenOfOwnerByIndex(alice, 2), '9');
      assert.equal(await token.tokenOfOwnerByIndex(alice, 3), '12');

      assert.equal(await token.tokenOfOwnerByIndex(bob, 0), '4');
      assert.equal(await token.tokenOfOwnerByIndex(bob, 1), '8');
      assert.equal(await token.tokenOfOwnerByIndex(bob, 2), '6');

      assert.equal(await token.tokenOfOwnerByIndex(carol, 0), '14');
      assert.equal(await token.tokenOfOwnerByIndex(carol, 1), '10');
      assert.equal(await token.tokenOfOwnerByIndex(carol, 2), '11');
      assert.equal(await token.tokenOfOwnerByIndex(carol, 3), '13');

      assert.equal(await token.tokenOfOwnerByIndex(dave, 0), '0');
      assert.equal(await token.tokenOfOwnerByIndex(dave, 1), '2');
      assert.equal(await token.tokenOfOwnerByIndex(dave, 2), '5');
      assert.equal(await token.tokenOfOwnerByIndex(dave, 3), '7');
    });

    it('safeTransferFrom reverts transfers to non-receiver contract', async () => {
      const { token, deployer, alice, bob, carol, dave, minter } = tester;

      const receiver = await MockContract.new();

      await config.mint({ token, to:alice, from:deployer });
      await config.mint({ token, to:bob, from:minter });
      await config.mint({ token, to:carol, from:minter });

      // alice: transfer own tokens to dave
      await expectRevert(
        token.safeTransferFrom(alice, receiver.address, 0, { from:alice }),
        "ERC721: transfer to non ERC721Receiver implementer"
      );

      // bob: transferred by dave, who has blanket approval
      await token.setApprovalForAll(dave, true, { from:bob });
      await expectRevert(
        token.safeTransferFrom(bob, receiver.address, 1, { from:dave }),
        "ERC721: transfer to non ERC721Receiver implementer"
      );

      // carol: transferred to alice by various people with specific token approval
      await token.approve(alice, 2, { from:carol });
      await expectRevert(
        token.safeTransferFrom(carol, receiver.address, 2, { from:alice }),
        "ERC721: transfer to non ERC721Receiver implementer"
      );
    });

    it('safeTransferFrom allows transfers to receiver contract', async () => {
      const { token, deployer, alice, bob, carol, dave, minter } = tester;

      const receiver = await MockERC721Receiver.new();

      await config.mint({ token, to:alice, from:deployer });
      await config.mint({ token, to:bob, from:minter });
      await config.mint({ token, to:carol, from:minter });

      // alice: transfer own tokens to dave
      let res = await token.methods["safeTransferFrom(address,address,uint256,bytes)"](alice, receiver.address, 0, "0x77", { from:alice });
      await expectEvent.inTransaction(res.tx, receiver, 'ERC721Received', {
        operator: alice,
        from: alice,
        tokenId: '0',
        data: '0x77'
      });

      // bob: transferred by dave, who has blanket approval
      await token.setApprovalForAll(dave, true, { from:bob });
      res = await token.methods["safeTransferFrom(address,address,uint256,bytes)"](bob, receiver.address, 1, "0xdeadbeef", { from:dave });
      await expectEvent.inTransaction(res.tx, receiver, 'ERC721Received', {
        operator: dave,
        from: bob,
        tokenId: '1',
        data: '0xdeadbeef'
      });
    });
  });
}

async function tryTransfer(tester, { from, to, as, tokenId, permitted, approved, receiver, safe }) {
  const { token } = tester;

  // verify inputs
  if (approved == null) approved = true;
  if (permitted == null) permitted = true;
  if (safe == null) safe = false;
  if (as == null) as = from;
  assert.ok(!!from, `testing utility: "from" must be defined`);
  assert.ok(!!to, `testing utility: "to" must be  defined`);
  assert.ok(tokenId != null, `testing utility: "tokenId" must be defined`);
  assert.ok(!safe || receiver != null, `testing utility: "safe" transfers must specify "receiver" as true or false`);

  // test that "from" owns the token
  assert.equal(await token.ownerOf(tokenId), from);

  // record balances
  let balances = {}
  balances[from] = Number((await token.balanceOf(from)).toString());
  balances[to] = Number((await token.balanceOf(to)).toString());

  balances[from]--;
  balances[to]++;

  const txPromise = safe
    ? token.safeTransferFrom(from, to, tokenId, { from:as })
    : token.transferFrom(from, to, tokenId, { from:as });

  if (permitted && approved && (!safe || receiver)) {
    // success case
    await txPromise;

    assert.equal(await token.ownerOf(tokenId), to);
    assert.equal(await token.balanceOf(from), `${balances[from]}`);
    assert.equal(await token.balanceOf(to), `${balances[to]}`);
  } else if (!permitted) {
    await expectRevert.unspecified(txPromise);
  } else if (!approved) {
    await expectRevert(txPromise, "ERC721: caller is not token owner or approved");
  } else if (!receiver) {
    await expectRevert(txPromise, "ERC721: transfer to non ERC721Receiver implementer");
  }
}

module.exports = exports = {
  // full testing operations
  testUtilityConfig,
  testMint,
  testSafeMint,
  testSetBaseURI,
  testSetTokenURI,
  testSetRoyalty,
  testRoyaltyInfo,
  testTransferFrom,
  testSafeTransferFrom,

  // operations that assert expected outcomes; call within a test
  tryTransfer,

  // configuration
  config
}
