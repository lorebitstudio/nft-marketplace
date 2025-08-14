require("@nomicfoundation/hardhat-toolbox");
require("@nomicfoundation/hardhat-verify");
require("hardhat-gas-reporter");
require("hardhat-tracer");
require("dotenv").config();

const IS_MAINNET = process.env.IS_MAINNET === "true";

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.28",
  settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: false,
      evmVersion: "cancun"
  },
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      chainId: 31337,
      timeout: 120000, // 120 seconds
      forking: {
        url: IS_MAINNET ? process.env.BASE_MAINNET_PROV : process.env.BASE_TESTNET_PROV,
        blockNumber: 28417915,
      },
      mining: {
        auto: true,
        interval: [3000, 5000],
      },
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
      timeout: 120000, // 120 seconds
      forking: {
        url: IS_MAINNET ? process.env.BASE_MAINNET_PROV : process.env.BASE_TESTNET_PROV,
        //blockNumber: 28417376,
      },
      mining: {
        auto: true,
        interval: [3000, 5000],
      },
    },
    base: {
      url: process.env.BASE_MAINNET_PROV,
      accounts: [`0x${process.env.MAINNET_PRIVATE_KEY}`],
    },
    baseSepolia: {
      url: process.env.BASE_TESTNET_PROV,
      accounts: [`0x${process.env.TESTNET_PRIVATE_KEY}`],
    },
  },
  etherscan: {
    apiKey:process.env.ETHSCAN_API_KEY,
  },
  gasReporter: {
    enabled: true,
    currency: "ETH",
    gasPrice: 0.024,
  },
  mocha: {
    bail: true,
    timeout: 0,
  },
  tracing: true,
};
