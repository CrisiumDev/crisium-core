const MockIMSpaceAccessToken = artifacts.require('MockIMSpaceAccessToken');
const tokens = require('./shared/tokens.js');

contract('MockIMSpaceAccessToken', (accounts) => {
  const MINTER_ROLE = web3.utils.soliditySha3('MINTER_ROLE');
  const ROYALTY_ROLE = web3.utils.soliditySha3('ROYALTY_ROLE');

  const accountNames = ["deployer", "alice", "bob", "carol", "dave", "minter", "royalty"];
  for (let i = 0; i < accountNames.length; i++) {
    this[accountNames[i]] = accounts[i];
  }

  beforeEach(async () => {
    const { deployer, minter, royalty } = this;

    this.token = await MockIMSpaceAccessToken.new("MockIMSpaceAccessToken", "MP", "http://imspace.com/token/", { from: deployer });
    await this.token.grantRole(MINTER_ROLE, minter);
    await this.token.grantRole(ROYALTY_ROLE, royalty);

    // config
    tokens.config.hasRevealer = false;
    tokens.config.mint = async ({ token, to, from, count }) => {
      const options = from ? { from } : {};
      await token.safeMint(to, (count || 1), options);
    };
  });

  it('should have correct name and symbol and decimal', async () => {
    const name = await this.token.name();
    const symbol = await this.token.symbol();
    assert.equal(name.valueOf(), 'MockIMSpaceAccessToken');
    assert.equal(symbol.valueOf(), 'MP');
  });

  it('should have appropriate starting values', async () => {
    const { token, deployer, alice, royaltyManager, royaltyReceiver } = this;

    assert.equal(await token.totalSupply(), '0');
    assert.equal(await token.balanceOf(this.deployer), '0')
    assert.equal(await token.balanceOf(this.alice), '0');
    assert.equal(await token.owner(), deployer);
    assert.equal(await token.royaltyReceiver(), this.deployer);
    assert.equal(await token.royaltyPercentBips(), '0');
  });

  tokens.testSafeMint(this);
  tokens.testSetRoyalty(this);
  tokens.testRoyaltyInfo(this);
  tokens.testTransferFrom(this);
  tokens.testSafeTransferFrom(this);
});
