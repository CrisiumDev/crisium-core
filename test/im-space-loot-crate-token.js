const IMSpaceLootCrateToken = artifacts.require('IMSpaceLootCrateToken');
const MockIMSpaceMissionToken = artifacts.require('MockIMSpaceMissionToken');
const MockIMSpaceAccessToken = artifacts.require('MockIMSpaceAccessToken');
const MockERC20 = artifacts.require('MockERC20');
const { expectRevert, time } = require('@openzeppelin/test-helpers');
const tokens = require('./shared/tokens.js');

const { BigNumber } = require('ethers');

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const MAX_UINT = "115792089237316195423570985008687907853269984665640564039457584007913129639935";

const bn = (val) => {
    if (typeof val === 'object' && val !== null && 'valueOf' in val) {
        return bn(val.valueOf().toString());
    }
    if (typeof val === 'string' && val.includes(',')) {
        vals = val.split(',');
        arr = [];
        for (const v of vals) {
          arr.push(bn(v));
        }
        return arr;
    }
    return BigNumber.from(val);
}

const e = (val, pow) => {
  return bn(val).mul(bn(10).pow(bn(pow)));
}

contract('IMSpaceLootCrateToken', (accounts) => {
  const MINTER_ROLE = web3.utils.soliditySha3('MINTER_ROLE');

  const accountNames = ["deployer", "alice", "bob", "carol", "dave", "minter", "revealer", "royalty"];
  for (let i = 0; i < accountNames.length; i++) {
    this[accountNames[i]] = accounts[i];
  }

  beforeEach(async () => {
    const { deployer, minter } = this;

    const currentTime = Number(await time.latest());
    this.prizes = [
      await MockIMSpaceMissionToken.new("MockIMSpaceMissionToken", "MP", 500, currentTime + 30, { from:deployer }),
      await MockIMSpaceMissionToken.new("MockIMSpaceMissionToken2", "MP2", 100, currentTime + 30, { from:deployer }),
      await MockIMSpaceAccessToken.new("MockIMSpaceAccessToken", "MPA", "http://tokenUri/", { from:deployer })
    ];
    for (const prize of this.prizes) {
      await prize.grantRole(MINTER_ROLE, minter);
    }

    this.paymentToken = await MockERC20.new("MockERC20", "ERC20", 0, { from:deployer });
  });

  context('contract basics', () => {
    beforeEach(async () => {
      const { deployer, minter, royalty, revealer, token, prizes } = this;

      this.token = this.crate = await IMSpaceLootCrateToken.new(
        "IMSpaceLootCrateToken", "LC", 100,
        10, this.paymentToken.address, 25, ZERO_ADDRESS,
        this.prizes.map(a => a.address), [2, 1, 1],
        { from:deployer }
      );

      for (const token of this.prizes) {
        await token.grantRole(MINTER_ROLE, this.crate.address);
      }

      // config
      tokens.config.mint = async ({ token, to, from, count }) => {
        // ignore "from"; only owner may mint
        const owner = await token.owner();
        await token.reserve(to, count || 1, { from:owner });
      };
    });

    it('should have correct name and symbol and decimal', async () => {
      const name = await this.crate.name();
      const symbol = await this.crate.symbol();
      assert.equal(name.valueOf(), 'IMSpaceLootCrateToken');
      assert.equal(symbol.valueOf(), 'LC');
    });

    it('should have appropriate starting values', async () => {
      const { token, prizes, deployer, alice } = this;

      assert.equal(await token.totalSupply(), '0');
      assert.equal(await token.balanceOf(this.deployer), '0')
      assert.equal(await token.balanceOf(this.alice), '0');
      assert.equal(await token.owner(), deployer);

      assert.equal(await token.maxSales(), '100');
      assert.equal(await token.sales(), '0');

      assert.equal(await token.purchaseLimit(), '10');
      assert.equal(await token.token(),  this.paymentToken.address);
      assert.equal(await token.price(), '25');

      assert.equal(await token.recipient(), ZERO_ADDRESS);

      assert.equal(await token.saleContentsLength(), '3');
      let contents = await token.saleContents(0);
      assert.equal(contents["token"], prizes[0].address);
      assert.equal(contents["amount"], '2');

      contents = await token.saleContents(1);
      assert.equal(contents["token"], prizes[1].address);
      assert.equal(contents["amount"], '1');

      contents = await token.saleContents(2);
      assert.equal(contents["token"], prizes[2].address);
      assert.equal(contents["amount"], '1');
    });

    tokens.testTransferFrom(this, false);
    tokens.testSafeTransferFrom(this, false);

    it('non-revealers cannot setBaseURI', async () => {
      const { crate, deployer, alice, revealer, minter } = this;

      await expectRevert(
        crate.setBaseURI("http://my-site.com/", { from:alice }),
        "Ownable: caller is not the owner"
      );

      await expectRevert(
        crate.setBaseURI("http://my-site.com/", { from:minter }),
        "Ownable: caller is not the owner"
      );
    });

    it('setBaseURI alters URI for all tokens', async () => {
      const { crate, deployer, alice, bob, revealer, minter } = this;

      await crate.reserve(alice, 4, { from:deployer });

      assert.equal(await crate.tokenURI(0), "");
      assert.equal(await crate.tokenURI(1), "");
      assert.equal(await crate.tokenURI(3), "");
      await expectRevert(crate.tokenURI(4), "ERC721Metadata: URI query for nonexistent token");

      await crate.setBaseURI("http://my-site.com/base/", { from:deployer }),

      // check URIs
      assert.equal(await crate.tokenURI(0), "http://my-site.com/base/0");
      assert.equal(await crate.tokenURI(1), "http://my-site.com/base/1");
      assert.equal(await crate.tokenURI(3), "http://my-site.com/base/3");

      await expectRevert(crate.tokenURI(4), "ERC721Metadata: URI query for nonexistent token");
      await expectRevert(crate.tokenURI(8), "ERC721Metadata: URI query for nonexistent token");

      await crate.reserve(bob, 4, { from:deployer });

      assert.equal(await crate.tokenURI(4), "http://my-site.com/base/4");
      assert.equal(await crate.tokenURI(7), "http://my-site.com/base/7");
      await expectRevert(crate.tokenURI(8), "ERC721Metadata: URI query for nonexistent token");

      await crate.transferOwnership(revealer, { from:deployer });
      await crate.setBaseURI("http://my-site.com/second/", { from:revealer });

      assert.equal(await crate.tokenURI(0), "http://my-site.com/second/0");
      assert.equal(await crate.tokenURI(1), "http://my-site.com/second/1");
      assert.equal(await crate.tokenURI(3), "http://my-site.com/second/3");
      assert.equal(await crate.tokenURI(4), "http://my-site.com/second/4");
      assert.equal(await crate.tokenURI(7), "http://my-site.com/second/7");
      await expectRevert(crate.tokenURI(8), "ERC721Metadata: URI query for nonexistent token");
    });
  });

  context('reserve', () => {
    beforeEach(async () => {
      const { deployer, minter, revealer, token, prizes } = this;

      this.token = this.crate = await IMSpaceLootCrateToken.new(
        "IMSpaceLootCrateToken", "LC", 100,
        10, this.paymentToken.address, 25, ZERO_ADDRESS,
        this.prizes.map(a => a.address), [3, 2, 1],
        { from:deployer }
      );

      for (const token of this.prizes) {
        await token.grantRole(MINTER_ROLE, this.crate.address);
      }
    });

    it('reserve cannot be called by non-owner', async () => {
      const { crate, deployer, minter, alice, bob } = this;

      await expectRevert(
        crate.reserve(alice, 2, { from:minter }),
        "Ownable: caller is not the owner"
      );

      await expectRevert(
        crate.reserve(alice, 2, { from:alice }),
        "Ownable: caller is not the owner"
      );

      await crate.transferOwnership(minter, { from:deployer });

      await expectRevert(
        crate.reserve(alice, 2, { from:deployer }),
        "Ownable: caller is not the owner"
      );
    });

    it('reserve creates the specified tokens', async () => {
      const { crate, deployer, minter, alice, bob } = this;

      await crate.reserve(alice, 2, { from:deployer });
      assert.equal(await crate.totalSupply(), '2');
      assert.equal(await crate.balanceOf(alice), '2');
      assert.equal(await crate.balanceOf(bob), '0');
      assert.equal(await crate.ownerOf(0), alice);
      assert.equal(await crate.ownerOf(1), alice);

      await crate.transferOwnership(minter, { from:deployer });
      await crate.reserve(bob, 1, { from:minter });

      assert.equal(await crate.totalSupply(), '3');
      assert.equal(await crate.balanceOf(alice), '2');
      assert.equal(await crate.balanceOf(bob), '1');
      assert.equal(await crate.ownerOf(0), alice);
      assert.equal(await crate.ownerOf(1), alice);
      assert.equal(await crate.ownerOf(2), bob);
    });

    it('reserve accumulates crate contents of "prize" tokens', async () => {
      const { crate, prizes, deployer, minter, alice, bob } = this;

      await crate.reserve(alice, 2, { from:deployer });

      assert.equal(await prizes[0].totalSupply(), '6');
      assert.equal(await prizes[0].balanceOf(crate.address), '6');
      assert.equal(await prizes[1].totalSupply(), '4');
      assert.equal(await prizes[1].balanceOf(crate.address), '4');
      assert.equal(await prizes[2].totalSupply(), '2');
      assert.equal(await prizes[2].balanceOf(crate.address), '2');

      await crate.transferOwnership(minter, { from:deployer });
      await crate.reserve(bob, 1, { from:minter });

      assert.equal(await prizes[0].totalSupply(), '9');
      assert.equal(await prizes[0].balanceOf(crate.address), '9');
      assert.equal(await prizes[1].totalSupply(), '6');
      assert.equal(await prizes[1].balanceOf(crate.address), '6');
      assert.equal(await prizes[2].totalSupply(), '3');
      assert.equal(await prizes[2].balanceOf(crate.address), '3');
    });

    it('reserve updates crateContents values', async () => {
      const { crate, prizes, deployer, minter, alice, bob } = this;

      const assertCrateContents = async (tokenId, index) => {
        let contentToken, contentTokenId;
        if (index <= 2) {
          contentToken = prizes[0].address;
          contentTokenId = tokenId * 3 + index;
        } else if (index <= 4) {
          contentToken = prizes[1].address;
          contentTokenId = tokenId * 2 + index - 3;
        } else {
          contentToken = prizes[2].address;
          contentTokenId = tokenId;
        }

        let contents = await crate.crateContents(tokenId, index);
        assert.equal(contents.token, contentToken);
        assert.equal(contents.tokenId, `${contentTokenId}`);
      };

      await crate.reserve(alice, 2, { from:deployer });

      assert.equal(await crate.crateContentsLength(0), '6');
      assert.equal(await crate.crateContentsLength(1), '6');

      for (let i = 0; i < 2; i++) {
        for (let j = 0; j < 6; j++) {
          await assertCrateContents(i, j);
        }
      }

      await crate.transferOwnership(minter, { from:deployer });
      await crate.reserve(bob, 1, { from:minter });

      assert.equal(await crate.crateContentsLength(0), '6');
      assert.equal(await crate.crateContentsLength(1), '6');
      assert.equal(await crate.crateContentsLength(2), '6');

      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 6; j++) {
          await assertCrateContents(i, j);
        }
      }
    });
  });

  context('purchase', () => {
    const balance = 10000000;
    beforeEach(async () => {
      const { deployer, minter, revealer, token, paymentToken, prizes, alice, bob, carol } = this;

      this.token = this.crate = await IMSpaceLootCrateToken.new(
        "IMSpaceLootCrateToken", "LC", 100,
        10, paymentToken.address, 25, ZERO_ADDRESS,
        this.prizes.map(a => a.address), [3, 2, 1],
        { from:deployer }
      );

      for (const token of this.prizes) {
        await token.grantRole(MINTER_ROLE, this.crate.address);
      }

      for (const user of [deployer, minter, alice, bob, carol]) {
        await paymentToken.mint(user, balance);
      }
    });

    it('purchase reverts for exceeding single-tx purchase limit', async () => {
      const { crate, paymentToken, deployer, minter, alice, bob } = this;

      await paymentToken.approve(crate.address, balance, { from:alice });
      await expectRevert(
        crate.purchase(alice, 11, balance, { from:alice }),
        "IMSpaceLootCrateToken: amount exceeds purchase limit"
      );

      await paymentToken.approve(crate.address, MAX_UINT, { from:deployer });
      await expectRevert(
        crate.purchase(bob, 100, balance, { from:deployer }),
        "IMSpaceLootCrateToken: amount exceeds purchase limit"
      );
    });

    it('purchase reverts for insufficient supply', async () => {
      const { crate, paymentToken, deployer, minter, alice, bob } = this;

      await crate.setMaxSales(3, { from:deployer });
      await paymentToken.approve(crate.address, balance, { from:alice });
      await expectRevert(
        crate.purchase(alice, 4, balance, { from:alice }),
        "IMSpaceLootCrateToken: insufficient supply"
      );

      await crate.setMaxSales(7, { from:deployer });
      await paymentToken.approve(crate.address, MAX_UINT, { from:deployer });
      await expectRevert(
        crate.purchase(bob, 10, balance, { from:deployer }),
        "IMSpaceLootCrateToken: insufficient supply"
      );
    });

    it('purchase reverts for insufficient maximum cost', async () => {
      const { crate, paymentToken, deployer, minter, alice, bob } = this;

      await paymentToken.approve(crate.address, balance, { from:alice });
      await expectRevert(
        crate.purchase(alice, 2, 49, { from:alice }),
        "IMSpaceLootCrateToken: insufficient payment"
      );

      await paymentToken.approve(crate.address, MAX_UINT, { from:deployer });
      await expectRevert(
        crate.purchase(bob, 10, 249, { from:deployer }),
        "IMSpaceLootCrateToken: insufficient payment"
      );
    });

    it('purchase reverts for insufficient balance or approval', async () => {
      const { crate, paymentToken, deployer, minter, alice, bob } = this;

      await paymentToken.approve(crate.address, 40, { from:alice });
      await expectRevert.unspecified(
        crate.purchase(alice, 2, 50, { from:alice })
      );

      await paymentToken.approve(crate.address, MAX_UINT, { from:deployer });
      await paymentToken.transfer(bob, balance - 40, { from:deployer });
      await expectRevert.unspecified(
        crate.purchase(bob, 2, 50, { from:deployer })
      );
    });

    it("purchase transfers payment tokens from purchaser to receiver (or contract if none)", async () => {
      const { crate, paymentToken, deployer, minter, alice, bob, carol } = this;

      await paymentToken.approve(crate.address, MAX_UINT, { from:alice });
      await crate.purchase(alice, 2, 50, { from:alice });
      assert.equal(await paymentToken.balanceOf(alice), `${balance - 50}`);
      assert.equal(await paymentToken.balanceOf(crate.address), `50`);

      await paymentToken.approve(crate.address, 100, { from:deployer });
      await crate.purchase(bob, 4, 150, { from:deployer });
      assert.equal(await paymentToken.balanceOf(deployer), `${balance - 100}`);
      assert.equal(await paymentToken.balanceOf(crate.address), `150`);

      await crate.setRecipient(carol, { from:deployer });
      await crate.purchase(alice, 3, 75, { from:alice });
      assert.equal(await paymentToken.balanceOf(alice), `${balance - 125}`);
      assert.equal(await paymentToken.balanceOf(crate.address), `150`);
      assert.equal(await paymentToken.balanceOf(carol), `${balance + 75}`);

      await crate.setRecipient(ZERO_ADDRESS, { from:deployer });
      await crate.purchase(alice, 5, 125, { from:alice });
      assert.equal(await paymentToken.balanceOf(alice), `${balance - 250}`);
      assert.equal(await paymentToken.balanceOf(crate.address), `275`);
      assert.equal(await paymentToken.balanceOf(carol), `${balance + 75}`);
    });

    it('purchase accumulates crate contents of "prize" tokens', async () => {
      const { crate, paymentToken, prizes, deployer, minter, alice, bob } = this;

      await paymentToken.approve(crate.address, MAX_UINT, { from:alice });
      await crate.purchase(alice, 2, MAX_UINT, { from:alice });

      assert.equal(await prizes[0].totalSupply(), '6');
      assert.equal(await prizes[0].balanceOf(crate.address), '6');
      assert.equal(await prizes[1].totalSupply(), '4');
      assert.equal(await prizes[1].balanceOf(crate.address), '4');
      assert.equal(await prizes[2].totalSupply(), '2');
      assert.equal(await prizes[2].balanceOf(crate.address), '2');

      await paymentToken.approve(crate.address, MAX_UINT, { from:minter });
      await crate.transferOwnership(minter, { from:deployer });
      await crate.purchase(bob, 1, MAX_UINT, { from:minter });

      assert.equal(await prizes[0].totalSupply(), '9');
      assert.equal(await prizes[0].balanceOf(crate.address), '9');
      assert.equal(await prizes[1].totalSupply(), '6');
      assert.equal(await prizes[1].balanceOf(crate.address), '6');
      assert.equal(await prizes[2].totalSupply(), '3');
      assert.equal(await prizes[2].balanceOf(crate.address), '3');
    });

    it('reserve updates crateContents values', async () => {
      const { crate, paymentToken, prizes, deployer, minter, alice, bob } = this;

      const assertCrateContents = async (tokenId, index) => {
        let contentToken, contentTokenId;
        if (index <= 2) {
          contentToken = prizes[0].address;
          contentTokenId = tokenId * 3 + index;
        } else if (index <= 4) {
          contentToken = prizes[1].address;
          contentTokenId = tokenId * 2 + index - 3;
        } else {
          contentToken = prizes[2].address;
          contentTokenId = tokenId;
        }

        let contents = await crate.crateContents(tokenId, index);
        assert.equal(contents.token, contentToken);
        assert.equal(contents.tokenId, `${contentTokenId}`);
      };

      await paymentToken.approve(crate.address, MAX_UINT, { from:deployer });
      await crate.purchase(alice, 2, MAX_UINT, { from:deployer });

      assert.equal(await crate.crateContentsLength(0), '6');
      assert.equal(await crate.crateContentsLength(1), '6');

      for (let i = 0; i < 2; i++) {
        for (let j = 0; j < 6; j++) {
          await assertCrateContents(i, j);
        }
      }

      await paymentToken.approve(crate.address, MAX_UINT, { from:bob });
      await crate.purchase(bob, 1, MAX_UINT, { from:bob });

      assert.equal(await crate.crateContentsLength(0), '6');
      assert.equal(await crate.crateContentsLength(1), '6');
      assert.equal(await crate.crateContentsLength(2), '6');

      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 6; j++) {
          await assertCrateContents(i, j);
        }
      }
    });

    it('purchase reverts for insufficient supply after successful purchases', async () => {
      const { crate, paymentToken, deployer, minter, alice, bob } = this;

      await crate.setMaxSales(5, { from:deployer });

      await paymentToken.approve(crate.address, MAX_UINT, { from:deployer });
      await crate.purchase(alice, 3, MAX_UINT, { from:deployer });
      await expectRevert(
        crate.purchase(alice, 3, MAX_UINT, { from:deployer }),
        "IMSpaceLootCrateToken: insufficient supply"
      );
    });
  });

  context('revealFrom', () => {
    beforeEach(async () => {
      const { deployer, minter, revealer, token, prizes, alice, bob } = this;

      this.token = this.crate = await IMSpaceLootCrateToken.new(
        "IMSpaceLootCrateToken", "LC", 100,
        10, this.paymentToken.address, 25, ZERO_ADDRESS,
        this.prizes.map(a => a.address), [3, 2, 1],
        { from:deployer }
      );

      for (const token of this.prizes) {
        await token.grantRole(MINTER_ROLE, this.crate.address);
      }

      await this.token.reserve(alice, 2, { from:deployer });
      await this.token.reserve(bob, 1, { from:deployer });
    });

    it('revealFrom reverts for unknown and unauthorized token', async () => {
      const { crate, deployer, minter, alice, bob } = this;

      await expectRevert(
        crate.revealFrom(alice, alice, 0, { from:deployer }),
        "IMSpaceLootCrateToken: reveal caller is not owner nor approved"
      );

      await expectRevert(
        crate.revealFrom(alice, bob, 1, { from:bob }),
        "IMSpaceLootCrateToken: reveal caller is not owner nor approved"
      );

      await expectRevert(
        crate.revealFrom(bob, alice, 2, { from:deployer }),
        "IMSpaceLootCrateToken: reveal caller is not owner nor approved"
      );
    });

    it('revealFrom reverts for incorrect owner', async () => {
      const { crate, deployer, minter, alice, bob } = this;

      await expectRevert(
        crate.revealFrom(bob, alice, 0, { from:alice }),
        "IMSpaceLootCrateToken: reveal from incorrect owner"
      );

      await expectRevert(
        crate.revealFrom(alice, bob, 2, { from:bob }),
        "IMSpaceLootCrateToken: reveal from incorrect owner"
      );

      await crate.setApprovalForAll(deployer, true, { from:alice });
      await crate.setApprovalForAll(deployer, true, { from:bob });

      await expectRevert(
        crate.revealFrom(bob, bob, 0, { from:deployer }),
        "IMSpaceLootCrateToken: reveal from incorrect owner"
      );

      await expectRevert(
        crate.revealFrom(alice, alice, 2, { from:deployer }),
        "IMSpaceLootCrateToken: reveal from incorrect owner"
      );
    });

    it('revealFrom reverts for zero-address destination', async () => {
      const { crate, deployer, minter, alice, bob } = this;

      await expectRevert(
        crate.revealFrom(alice, ZERO_ADDRESS, 0, { from:alice }),
        "IMSpaceLootCrateToken: reveal to the zero address"
      );

      await crate.setApprovalForAll(deployer, true, { from:bob });
      await expectRevert(
        crate.revealFrom(bob, ZERO_ADDRESS, 2, { from:deployer }),
        "IMSpaceLootCrateToken: reveal to the zero address"
      );
    });

    it('revealFrom destroys the original token, releasing associated prizes to recipient', async () => {
      const { crate, prizes, deployer, minter, alice, bob, carol, dave } = this;

      const assertPrizesAwarded = async (owner, tokenId) => {
        for (let i = 0; i < 3; i++) {
          assert.equal(await prizes[0].ownerOf(tokenId * 3 + i), owner);
        }
        for (let i = 0; i < 2; i++) {
          assert.equal(await prizes[1].ownerOf(tokenId * 2 + i), owner);
        }
        assert.equal(await prizes[2].ownerOf(tokenId), owner);
      };

      // all owned by the crate
      await assertPrizesAwarded(crate.address, 0);
      await assertPrizesAwarded(crate.address, 1);
      await assertPrizesAwarded(crate.address, 2);
      assert.equal(await crate.ownerOf(0), alice);
      assert.equal(await crate.ownerOf(1), alice);
      assert.equal(await crate.ownerOf(2), bob);

      // reveal crate 1 to current crate owner
      await crate.revealFrom(alice, alice, 1, { from:alice });
      await assertPrizesAwarded(crate.address, 0);
      await assertPrizesAwarded(alice, 1);
      await assertPrizesAwarded(crate.address, 2);
      assert.equal(await crate.ownerOf(0), alice);
      await expectRevert.unspecified(crate.ownerOf(1));
      assert.equal(await crate.ownerOf(2), bob);

      // reveal crate 2 to other recipient
      await crate.revealFrom(bob, carol, 2, { from:bob });
      await assertPrizesAwarded(crate.address, 0);
      await assertPrizesAwarded(alice, 1);
      await assertPrizesAwarded(carol, 2);
      assert.equal(await crate.ownerOf(0), alice);
      await expectRevert.unspecified(crate.ownerOf(1));
      await expectRevert.unspecified(crate.ownerOf(2));

      // reveal crate 0 from another user's wallet
      await crate.setApprovalForAll(dave, true, { from:alice });
      await crate.revealFrom(alice, deployer, 0, { from:dave });
      await assertPrizesAwarded(deployer, 0);
      await assertPrizesAwarded(alice, 1);
      await assertPrizesAwarded(carol, 2);
      await expectRevert.unspecified(crate.ownerOf(0));
      await expectRevert.unspecified(crate.ownerOf(1));
      await expectRevert.unspecified(crate.ownerOf(2));
    });
  });

  context('forceReveal', () => {
    beforeEach(async () => {
      const { deployer, minter, revealer, token, prizes, alice, bob } = this;

      this.token = this.crate = await IMSpaceLootCrateToken.new(
        "IMSpaceLootCrateToken", "LC", 100,
        10, this.paymentToken.address, 25, ZERO_ADDRESS,
        this.prizes.map(a => a.address), [3, 2, 1],
        { from:deployer }
      );

      for (const token of this.prizes) {
        await token.grantRole(MINTER_ROLE, this.crate.address);
      }

      await this.token.reserve(alice, 2, { from:deployer });
      await this.token.reserve(bob, 1, { from:deployer });
    });

    it('forceReveal reverts for non-contract-owner', async () => {
      const { crate, deployer, minter, alice, bob, carol } = this;

      await expectRevert(
        crate.forceReveal([0], { from:bob }),
        "Ownable: caller is not the owner"
      );

      await expectRevert(
        crate.forceReveal([0], { from:alice }),
        "Ownable: caller is not the owner"
      );

      await crate.setApprovalForAll(carol, { from:bob });
      await expectRevert(
        crate.forceReveal([2], { from:carol }),
        "Ownable: caller is not the owner"
      );

      await crate.transferOwnership(carol, { from:deployer });
      await expectRevert(
        crate.forceReveal([0], { from:deployer }),
        "Ownable: caller is not the owner"
      );
    });

    it('forceReveal destroys the original token, releasing associated prizes to owner', async () => {
      const { crate, prizes, deployer, minter, alice, bob, carol, dave } = this;

      const assertPrizesAwarded = async (owner, tokenId) => {
        for (let i = 0; i < 3; i++) {
          assert.equal(await prizes[0].ownerOf(tokenId * 3 + i), owner);
        }
        for (let i = 0; i < 2; i++) {
          assert.equal(await prizes[1].ownerOf(tokenId * 2 + i), owner);
        }
        assert.equal(await prizes[2].ownerOf(tokenId), owner);
      };

      // all owned by the crate
      await assertPrizesAwarded(crate.address, 0);
      await assertPrizesAwarded(crate.address, 1);
      await assertPrizesAwarded(crate.address, 2);
      assert.equal(await crate.ownerOf(0), alice);
      assert.equal(await crate.ownerOf(1), alice);
      assert.equal(await crate.ownerOf(2), bob);

      // reveal crate 1 to current crate owner
      await crate.forceReveal([1], { from:deployer });
      await assertPrizesAwarded(crate.address, 0);
      await assertPrizesAwarded(alice, 1);
      await assertPrizesAwarded(crate.address, 2);
      assert.equal(await crate.ownerOf(0), alice);
      await expectRevert.unspecified(crate.ownerOf(1));
      assert.equal(await crate.ownerOf(2), bob);

      // reveal crate 2 to current crate owner
      await crate.forceReveal([2], { from:deployer });
      await assertPrizesAwarded(crate.address, 0);
      await assertPrizesAwarded(alice, 1);
      await assertPrizesAwarded(bob, 2);
      assert.equal(await crate.ownerOf(0), alice);
      await expectRevert.unspecified(crate.ownerOf(1));
      await expectRevert.unspecified(crate.ownerOf(2));

      // reveal crate 0 as another owner
      await crate.transferOwnership(carol, { from:deployer });
      await crate.forceReveal([0], { from:carol });
      await assertPrizesAwarded(alice, 0);
      await assertPrizesAwarded(alice, 1);
      await assertPrizesAwarded(bob, 2);
      await expectRevert.unspecified(crate.ownerOf(0));
      await expectRevert.unspecified(crate.ownerOf(1));
      await expectRevert.unspecified(crate.ownerOf(2));
    });

    it('forceReveal destroys the original tokens, releasing associated prizes to owner', async () => {
      const { crate, prizes, deployer, minter, alice, bob, carol, dave } = this;

      const assertPrizesAwarded = async (owner, tokenId) => {
        for (let i = 0; i < 3; i++) {
          assert.equal(await prizes[0].ownerOf(tokenId * 3 + i), owner);
        }
        for (let i = 0; i < 2; i++) {
          assert.equal(await prizes[1].ownerOf(tokenId * 2 + i), owner);
        }
        assert.equal(await prizes[2].ownerOf(tokenId), owner);
      };

      await crate.forceReveal([0, 2, 1], { from:deployer });
      await assertPrizesAwarded(alice, 0);
      await assertPrizesAwarded(alice, 1);
      await assertPrizesAwarded(bob, 2);
      await expectRevert.unspecified(crate.ownerOf(0));
      await expectRevert.unspecified(crate.ownerOf(1));
      await expectRevert.unspecified(crate.ownerOf(2));
    });

    it('forceReveal is robust to non-existent tokenIds', async () => {
      const { crate, prizes, deployer, minter, alice, bob, carol, dave } = this;

      const assertPrizesAwarded = async (owner, tokenId) => {
        for (let i = 0; i < 3; i++) {
          assert.equal(await prizes[0].ownerOf(tokenId * 3 + i), owner);
        }
        for (let i = 0; i < 2; i++) {
          assert.equal(await prizes[1].ownerOf(tokenId * 2 + i), owner);
        }
        assert.equal(await prizes[2].ownerOf(tokenId), owner);
      };

      await crate.forceReveal([1, 1, 1], { from:deployer });
      await assertPrizesAwarded(crate.address, 0);
      await assertPrizesAwarded(alice, 1);
      await assertPrizesAwarded(crate.address, 2);
      assert.equal(await crate.ownerOf(0), alice);
      await expectRevert.unspecified(crate.ownerOf(1));
      assert.equal(await crate.ownerOf(2), bob);

      await crate.forceReveal([1, 2, 3], { from:deployer });
      await assertPrizesAwarded(crate.address, 0);
      await assertPrizesAwarded(alice, 1);
      await assertPrizesAwarded(bob, 2);
      assert.equal(await crate.ownerOf(0), alice);
      await expectRevert.unspecified(crate.ownerOf(1));
      await expectRevert.unspecified(crate.ownerOf(2));

      await crate.transferOwnership(carol, { from:deployer });
      await crate.forceReveal([1, 2, 3], { from:carol });
      await assertPrizesAwarded(crate.address, 0);
      await assertPrizesAwarded(alice, 1);
      await assertPrizesAwarded(bob, 2);
      assert.equal(await crate.ownerOf(0), alice);
      await expectRevert.unspecified(crate.ownerOf(1));
      await expectRevert.unspecified(crate.ownerOf(2));

      await crate.forceReveal([0, 1, 2, 3], { from:carol });
      await assertPrizesAwarded(alice, 0);
      await assertPrizesAwarded(alice, 1);
      await assertPrizesAwarded(bob, 2);
      await expectRevert.unspecified(crate.ownerOf(0));
      await expectRevert.unspecified(crate.ownerOf(1));
      await expectRevert.unspecified(crate.ownerOf(2));
    });
  });
});
