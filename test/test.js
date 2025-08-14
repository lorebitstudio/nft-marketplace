const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("🎨 NFT Marketplace Flow", function () {
  async function deployFixture() {
    const [owner, seller, buyer] = await ethers.getSigners();

    // Deploy ProjectToken
    const ProjectToken = await ethers.getContractFactory("ProjectToken");
    const projectToken = await ProjectToken.deploy();
    await projectToken.waitForDeployment();

    // Mint tokens to buyer
    await projectToken.mint(buyer.address, ethers.parseEther("1000"));

    // Deploy MyNFT
    const MyNFT = await ethers.getContractFactory("MyNFT");
    const myNFT = await MyNFT.deploy();
    await myNFT.waitForDeployment();

    // Deploy Marketplace
    const Marketplace = await ethers.getContractFactory("Marketplace");
    const marketplace = await Marketplace.deploy(projectToken.target, owner.address);
    await marketplace.waitForDeployment();

    return { owner, seller, buyer, projectToken, myNFT, marketplace };
  }

it("should mint, list, cancel, buy an NFT, and update platform fee", async () => {
  const { owner, seller, buyer, projectToken, myNFT, marketplace } = await loadFixture(deployFixture);

  // Mint NFT #0 to seller
  await myNFT.connect(owner).mint(seller.address, "ipfs://example-uri");
  const tokenId0 = 0;
  console.log(`✅ Minted NFT #${tokenId0} to seller (${seller.address})`);

  expect(await myNFT.ownerOf(tokenId0)).to.equal(seller.address);

  // Approve and list NFT #0
  await myNFT.connect(seller).approve(marketplace.target, tokenId0);
  const price = ethers.parseEther("100");
  await marketplace.connect(seller).list(myNFT.target, tokenId0, price);
  console.log(`📋 Listed NFT #${tokenId0} for ${ethers.formatEther(price)} ProjectToken`);

  // Buyer approves tokens & buys NFT #0
  await projectToken.connect(buyer).approve(marketplace.target, price);
  await marketplace.connect(buyer).buy(myNFT.target, tokenId0);
  console.log(`💰 Buyer (${buyer.address}) bought NFT #${tokenId0}`);

  expect(await myNFT.ownerOf(tokenId0)).to.equal(buyer.address);
  console.log(`✅ NFT #${tokenId0} ownership verified: now owned by buyer`);

  // Mint NFT #1 to seller
  await myNFT.connect(owner).mint(seller.address, "ipfs://example-uri-2");
  const tokenId1 = 1;
  console.log(`✅ Minted NFT #${tokenId1} to seller (${seller.address})`);

  expect(await myNFT.ownerOf(tokenId1)).to.equal(seller.address);

  // Approve and list NFT #1
  await myNFT.connect(seller).approve(marketplace.target, tokenId1);
  const price2 = ethers.parseEther("150");
  await marketplace.connect(seller).list(myNFT.target, tokenId1, price2);
  console.log(`📋 Listed NFT #${tokenId1} for ${ethers.formatEther(price2)} ProjectToken`);

  // Cancel listing
  await marketplace.connect(seller).cancel(myNFT.target, tokenId1);
  console.log(`❌ Seller canceled listing of NFT #${tokenId1}`);

  // Check that seller still owns NFT
  expect(await myNFT.ownerOf(tokenId1)).to.equal(seller.address);
  console.log(`✅ NFT #${tokenId1} ownership verified: still owned by seller`);

  // Check that listing is deleted
  const listing = await marketplace.listings(myNFT.target, tokenId1);
  expect(listing.price).to.equal(0);
  expect(listing.seller).to.equal(ethers.ZeroAddress);
  console.log(`🗑️ Listing for NFT #${tokenId1} has been deleted`);

  // 📋 Platform fee tests
  const currentFeeRecipient = await marketplace.feeRecipient();
  const newFeeRecipient = buyer.address;

  console.log(`🔍 Current fee recipient: ${currentFeeRecipient}`);
  console.log(`🎯 Attempting to set new platform fee and recipient…`);

  // Only owner can call setPlatformFee
  await expect(
    marketplace.connect(seller).setPlatformFee(300, buyer.address)
  ).to.be.reverted;
  console.log(`✅ Non-owner cannot set platform fee (expected revert)`);

  // Cannot set fee > 1000
  await expect(
    marketplace.connect(owner).setPlatformFee(1500, newFeeRecipient)
  ).to.be.revertedWith("Fee too high");
  console.log(`✅ Setting fee > 1000 correctly reverted`);

  // Set valid fee & recipient
  await marketplace.connect(owner).setPlatformFee(300, newFeeRecipient);

  const updatedFeeBps = await marketplace.platformFeeBps();
  const updatedRecipient = await marketplace.feeRecipient();

  expect(updatedFeeBps).to.equal(300);
  expect(updatedRecipient).to.equal(newFeeRecipient);

  console.log(`✅ Platform fee updated to: ${updatedFeeBps} bps`);
  console.log(`✅ Fee recipient updated to: ${updatedRecipient}`);

    // 🎨 Royalties test 
    console.log(`🎨 Starting royalties test…`);

    // Mint NFT #2 to seller
    await myNFT.connect(owner).mint(seller.address, "ipfs://royalty-uri");
    const tokenId2 = 2;
    console.log(`✅ Minted NFT #${tokenId2} to seller (${seller.address})`);

    // Set royalties: 5% to owner
    await myNFT.connect(owner).setRoyaltyInfo(owner.address, 500);
    console.log(`🎨 Set royalties: 5% to owner (${owner.address})`);

    const royaltyPrice = ethers.parseEther("200");

    await projectToken.connect(buyer).approve(marketplace.target, royaltyPrice);
    await myNFT.connect(seller).approve(marketplace.target, tokenId2);
    await marketplace.connect(seller).list(myNFT.target, tokenId2, royaltyPrice);
    console.log(`📋 Listed NFT #${tokenId2} for ${ethers.formatEther(royaltyPrice)} ProjectToken`);

    // balances before
    const sellerBefore = await projectToken.balanceOf(seller.address);
    const ownerBefore = await projectToken.balanceOf(owner.address);
    const buyerBefore = await projectToken.balanceOf(buyer.address);

    await marketplace.connect(buyer).buy(myNFT.target, tokenId2);

    // balances after
    const sellerAfter = await projectToken.balanceOf(seller.address);
    const ownerAfter = await projectToken.balanceOf(owner.address);
    const buyerAfter = await projectToken.balanceOf(buyer.address);

    const platformFee = royaltyPrice * BigInt(300) / BigInt(10000); // 3% platform
    const royaltyAmount = royaltyPrice * BigInt(500) / BigInt(10000); // 5% royalty
    const sellerProceeds = royaltyPrice - platformFee - royaltyAmount;

    // ✅ seller gained sellerProceeds
    expect(sellerAfter - sellerBefore).to.equal(sellerProceeds);

    // ✅ owner (artist) gained royalty
    expect(ownerAfter - ownerBefore).to.equal(royaltyAmount);

    // ✅ feeRecipient (also buyer in this case) gained platformFee
    // BUT buyer also paid `royaltyPrice`, so let’s check the *net change*:
    const buyerNet = buyerAfter - buyerBefore;

    // Buyer paid full price, but got back platformFee → net change should be: -(price - platformFee)
    const expectedBuyerNet = -royaltyPrice + platformFee;

    expect(buyerNet).to.equal(expectedBuyerNet);

    expect(await myNFT.ownerOf(tokenId2)).to.equal(buyer.address);

    console.log(`✅ NFT #${tokenId2} sold with royalties:`);
    console.log(`  Seller got: ${ethers.formatEther(sellerProceeds)} ProjectToken`);
    console.log(`  Owner got (royalty): ${ethers.formatEther(royaltyAmount)} ProjectToken`);
    console.log(`  FeeRecipient (buyer) got (platform fee): ${ethers.formatEther(platformFee)} ProjectToken`);
    console.log(`  Buyer paid net: ${ethers.formatEther(buyerNet)} ProjectToken`);
    console.log(`  Buyer now owns NFT #${tokenId2}`);
});
});
