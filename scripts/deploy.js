const { ethers, run } = require("hardhat");

async function main() {
  const deployer = new ethers.Wallet(process.env.TESTNET_PRIVATE_KEY, ethers.provider);
  console.log(`👷 Deploying contracts with: ${deployer.address}`);

  const verify = async (address, constructorArgs = []) => {
    console.log(`🔍 Verifying ${address}…`);
    try {
      await run("verify:verify", {
        address,
        constructorArguments: constructorArgs,
      });
      console.log(`✅ Verified: ${address}`);
    } catch (err) {
      if (err.message.includes("Already Verified")) {
        console.log(`ℹ️ Already Verified: ${address}`);
      } else {
        console.error(`❌ Verification failed: ${err}`);
      }
    }
  };

  // Deploy ProjectToken
  const ProjectToken = await ethers.getContractFactory("ProjectToken", deployer);
  const projectToken = await ProjectToken.deploy();
  await projectToken.waitForDeployment();
  const projectTokenAddr = await projectToken.getAddress();
  console.log(`✅ ProjectToken deployed: ${projectTokenAddr}`);

  // Deploy MyNFT
  const MyNFT = await ethers.getContractFactory("MyNFT", deployer);
  const myNFT = await MyNFT.deploy();
  await myNFT.waitForDeployment();
  const myNFTAddr = await myNFT.getAddress();
  console.log(`✅ MyNFT deployed: ${myNFTAddr}`);

  // Deploy Marketplace
  const Marketplace = await ethers.getContractFactory("Marketplace", deployer);
  const marketplace = await Marketplace.deploy(projectTokenAddr, deployer.address);
  await marketplace.waitForDeployment();
  const marketplaceAddr = await marketplace.getAddress();
  console.log(`✅ Marketplace deployed: ${marketplaceAddr}`);

  console.log(`🎉 All contracts deployed successfully!`);

  console.log(`⏳ Waiting before verifying (Etherscan may need a few seconds)…`);
  await new Promise((r) => setTimeout(r, 20000)); // wait 20s before verifying

  console.log(`🚀 Starting verification…`);

  await verify(projectTokenAddr);
  await verify(myNFTAddr);
  await verify(marketplaceAddr, [projectTokenAddr, deployer.address]);

  console.log(`🎉 All contracts verified successfully!`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
