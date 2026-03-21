const hre = require("hardhat");

async function main() {
  const Escrow = await hre.ethers.getContractFactory("NanoHireEscrow");
  const escrow = await Escrow.deploy();
  await escrow.waitForDeployment();

  const address = await escrow.getAddress();
  console.log(`NanoHireEscrow deployed to: ${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
