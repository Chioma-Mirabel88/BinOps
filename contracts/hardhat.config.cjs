const path = require("node:path");

require("dotenv").config({
  path: path.resolve(__dirname, "../.env"),
});

require("@nomicfoundation/hardhat-ethers");

const networks = {
  hardhat: { chainId: 31337 },
  localhost: {
    url: "http://127.0.0.1:8545",
    chainId: 31337,
  },
};

const sepoliaRpcUrl = process.env.SEPOLIA_RPC_URL;
const sepoliaPrivateKey = process.env.SEPOLIA_PRIVATE_KEY;

if (sepoliaRpcUrl || sepoliaPrivateKey) {
  if (!sepoliaRpcUrl || !sepoliaPrivateKey) {
    throw new Error(
      "Both SEPOLIA_RPC_URL and SEPOLIA_PRIVATE_KEY must be configured."
    );
  }

  if (!/^0x[a-fA-F0-9]{64}$/.test(sepoliaPrivateKey)) {
    throw new Error("SEPOLIA_PRIVATE_KEY has an invalid format.");
  }

  networks.sepolia = {
    url: sepoliaRpcUrl,
    chainId: 11155111,
    accounts: [sepoliaPrivateKey],
  };
}

module.exports = {
  solidity: "0.8.28",
  networks,
};
