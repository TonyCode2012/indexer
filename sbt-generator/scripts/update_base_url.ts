import { ethers } from "hardhat";

async function main() {
  const NFT = await ethers.getContractFactory("StarNFTV4");
  const nft = await NFT.attach("0x9B82DAF85E9dcC4409ed13970035a181fB411542");

  await nft.setURI("https://data.nosocial.xyz/metadata/");

  console.log(`New url has been set`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
