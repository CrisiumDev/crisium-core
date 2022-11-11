const MockIMSpaceMissionToken = artifacts.require('MockIMSpaceMissionToken');
const { expectRevert, time } = require('@openzeppelin/test-helpers');
const tokens = require('./shared/tokens.js');

const { BigNumber } = require('ethers');

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

contract('MockIMSpaceMissionToken', (accounts) => {
  const MINTER_ROLE = web3.utils.soliditySha3('MINTER_ROLE');
  const REVEAL_ROLE = web3.utils.soliditySha3('REVEAL_ROLE');
  const ROYALTY_ROLE = web3.utils.soliditySha3('ROYALTY_ROLE');

  const accountNames = ["deployer", "alice", "bob", "carol", "dave", "minter", "revealer", "royalty", "royaltyReceiver"];
  for (let i = 0; i < accountNames.length; i++) {
    this[accountNames[i]] = accounts[i];
  }

  context('standard token setup', () => {
    beforeEach(async () => {
      const { deployer, minter, revealer, royalty } = this;

      this.token = await MockIMSpaceMissionToken.new("MockIMSpaceMissionToken", "MP", 1000, 15, { from: deployer });
      await this.token.grantRole(MINTER_ROLE, minter);
      await this.token.grantRole(REVEAL_ROLE, revealer);
      await this.token.grantRole(ROYALTY_ROLE, royalty);

      // config
      tokens.config.revealer = true;
      tokens.config.mint = async ({ token, to, from, count }) => {
        const options = from ? { from } : {};
        await token.safeMint(to, (count || 1), options);
      };
    });

    it('should have correct name and symbol and decimal', async () => {
      const name = await this.token.name();
      const symbol = await this.token.symbol();
      assert.equal(name.valueOf(), 'MockIMSpaceMissionToken');
      assert.equal(symbol.valueOf(), 'MP');
    });

    it('should have appropriate starting values', async () => {
      const { token, deployer, alice, royaltyManager, royaltyReceiver } = this;

      assert.equal(await token.totalSupply(), '0');
      assert.equal(await token.balanceOf(this.deployer), '0')
      assert.equal(await token.balanceOf(this.alice), '0');
      assert.equal(await token.royaltyReceiver(), deployer);
      assert.equal(await token.royaltyPercentBips(), '0');

      assert.equal(await token.revealStartingIndexBlock(), '0');
      assert.equal(await token.revealStartingIndex(), '0');
      assert.equal(await token.REVEAL_TIMESTAMP(), '15');
      assert.equal(await token.MAX_SUPPLY(), '1000');
      assert.equal(await token.PROVENANCE_HASH(), '');
    });

    tokens.testSafeMint(this);
    tokens.testSetRoyalty(this);
    tokens.testRoyaltyInfo(this);
    tokens.testSetTokenURI(this);
    tokens.testTransferFrom(this);
    tokens.testSafeTransferFrom(this);

    context('provenance hash', () => {
      it("non-revealer can't set provenance hash", async () => {
        const { token, alice, bob, carol, minter } = this;

        await expectRevert(
          token.setProvenanceHash("0x1234", { from:bob }),
          "IMSpaceMissionToken: must have reveal role to set provenance hash",
        );

        await expectRevert(
          token.setProvenanceHash("0xdeadbeef", { from:minter }),
          "IMSpaceMissionToken: must have reveal role to set provenance hash",
        );
      });

      it("revealer can set provenance hash", async () => {
        const { token, deployer, revealer } = this;

        await token.setProvenanceHash("0x1234", { from:deployer });
        assert.equal(await token.PROVENANCE_HASH(), '0x1234');

        await token.setProvenanceHash("0xdeadbeef", { from:deployer });
        assert.equal(await token.PROVENANCE_HASH(), '0xdeadbeef');
      });
    });

    context('reveal timestamp', () => {
      it("non-revealer can't set reveal timestamp", async () => {
        const { token, alice, bob, carol, minter } = this;

        await expectRevert(
          token.setRevealTimestamp(5003, { from:bob }),
          "IMSpaceMissionToken: must have reveal role to set reveal timestamp",
        );

        await expectRevert(
          token.setRevealTimestamp(16293, { from:minter }),
          "IMSpaceMissionToken: must have reveal role to set reveal timestamp",
        );
      });

      it("revealer can set timestamp", async () => {
        const { token, deployer, revealer } = this;

        await token.setRevealTimestamp(5003, { from:deployer });
        assert.equal(await token.REVEAL_TIMESTAMP(), '5003');

        await token.setRevealTimestamp(16293, { from:deployer });
        assert.equal(await token.REVEAL_TIMESTAMP(), '16293');
      });
    });
  });

  context('supply limited', () => {
    let revealTime = 0;
    beforeEach(async () => {
      const { deployer, minter, revealer } = this;

      revealTime = Number(await time.latest()) + 30;
      this.token = await MockIMSpaceMissionToken.new("MockIMSpaceMissionToken", "MP", 10, revealTime, { from: deployer });
      await this.token.grantRole(MINTER_ROLE, minter);
      await this.token.grantRole(REVEAL_ROLE, revealer);
    });

    it('minting does not affect revealStartingIndexBlock before reveal time', async () => {
      const { token, minter, alice, bob } = this;

      assert.equal(await token.revealStartingIndexBlock(), '0');
      await token.safeMint(alice, 5, { from:minter });
      assert.equal(await token.revealStartingIndexBlock(), '0');
    });

    it('minting sets revealStartingIndexBlock when MAX_SUPPLY is reached', async () => {
      const { token, deployer, minter, alice, bob } = this;

      assert.equal(await token.revealStartingIndexBlock(), '0');
      await token.safeMint(alice, 5, { from:minter });
      assert.equal(await token.revealStartingIndexBlock(), '0');
      await token.safeMint(bob, 4, { from:deployer });
      assert.equal(await token.revealStartingIndexBlock(), '0');
      await token.safeMint(bob, 1, { from:deployer });

      const blockNumber = await web3.eth.getBlockNumber();
      assert.equal(await token.revealStartingIndexBlock(), `${blockNumber}`);
    });

    it('minting sets revealStartingIndexBlock when reveal time is passed', async () => {
      const { token, deployer, minter, alice, bob } = this;

      assert.equal(await token.revealStartingIndexBlock(), '0');
      await token.safeMint(alice, 5, { from:minter });
      assert.equal(await token.revealStartingIndexBlock(), '0');

      await time.increaseTo(revealTime);

      await token.safeMint(bob, 1, { from:deployer });
      const blockNumber = await web3.eth.getBlockNumber();
      assert.equal(await token.revealStartingIndexBlock(), `${blockNumber}`);
    });

    it('emergencySetStartingIndexBlock reverts for non-revealer', async () => {
      const { token, deployer, minter, alice, bob } = this;

      await expectRevert(
        token.emergencySetStartingIndexBlock({ from:alice }),
        "IMSpaceMissionToken: must have reveal role to set starting index block"
      );

      await expectRevert(
        token.emergencySetStartingIndexBlock({ from:minter }),
        "IMSpaceMissionToken: must have reveal role to set starting index block"
      );
    });

    it('emergencySetStartingIndexBlock sets revealStartingIndexBlock', async () => {
      const { token, deployer, minter, alice, bob, revealer } = this;

      await token.emergencySetStartingIndexBlock({ from:revealer });
      let blockNumber = await web3.eth.getBlockNumber();
      assert.equal(await token.revealStartingIndexBlock(), `${blockNumber}`);

      await token.emergencySetStartingIndexBlock({ from:deployer });
      blockNumber = await web3.eth.getBlockNumber();
      assert.equal(await token.revealStartingIndexBlock(), `${blockNumber}`);
    });

    it('setStartingIndex works as expected', async () => {
      const { token, deployer, minter, alice, bob, revealer } = this;

      await expectRevert(
        token.setStartingIndex(),
        "IMSpaceMissionToken: starting index block must be set"
      );

      await token.emergencySetStartingIndexBlock({ from:revealer });
      let blockNumber = await web3.eth.getBlockNumber();
      assert.equal(await token.revealStartingIndexBlock(), `${blockNumber}`);

      await token.setStartingIndex();
      const index = await token.revealStartingIndex();
      const block = await web3.eth.getBlock(blockNumber);
      let indexCalc = bn(block.hash).mod(bn(10)).toNumber();
      if (!indexCalc) indexCalc = 1;
      assert.equal(index, `${indexCalc}`);

      await expectRevert(
        token.emergencySetStartingIndexBlock({ from:revealer }),
        "IMSpaceMissionToken: starting index is already set"
      );

      await expectRevert(
        token.setStartingIndex(),
        "IMSpaceMissionToken: starting index is already set"
      );
    });
  });
});
