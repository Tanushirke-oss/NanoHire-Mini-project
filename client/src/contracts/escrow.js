import { BrowserProvider, Contract, parseEther } from "ethers";
import { ESCROW_ABI } from "./escrowAbi";

function getContractAddress() {
  const address = import.meta.env.VITE_ESCROW_CONTRACT_ADDRESS;
  if (!address) {
    throw new Error("VITE_ESCROW_CONTRACT_ADDRESS is not configured.");
  }
  return address;
}

async function getSignerContract() {
  if (!window.ethereum) {
    throw new Error("MetaMask is not available.");
  }

  const provider = new BrowserProvider(window.ethereum);
  await provider.send("eth_requestAccounts", []);
  const signer = await provider.getSigner();
  const contract = new Contract(getContractAddress(), ESCROW_ABI, signer);
  return { contract, signer };
}

export async function createOnchainGigTransaction({ fee, deadline }) {
  const { contract } = await getSignerContract();

  const nextGigId = await contract.nextGigId();
  const deadlineUnix = Math.floor(new Date(deadline).getTime() / 1000);
  const tx = await contract.createGig(deadlineUnix, {
    value: parseEther(String(fee))
  });
  const receipt = await tx.wait();

  return {
    onchainGigId: nextGigId.toString(),
    txHash: receipt.hash,
    escrowContractAddress: getContractAddress()
  };
}

export async function selectStudentOnchain({ onchainGigId, studentWalletAddress }) {
  const { contract } = await getSignerContract();
  const tx = await contract.selectStudent(onchainGigId, studentWalletAddress);
  const receipt = await tx.wait();
  return { txHash: receipt.hash };
}

export async function submitWorkOnchain({ onchainGigId }) {
  const { contract } = await getSignerContract();
  const tx = await contract.submitWork(onchainGigId);
  const receipt = await tx.wait();
  return { txHash: receipt.hash };
}

export async function acceptAndReleaseOnchain({ onchainGigId }) {
  const { contract } = await getSignerContract();
  const tx = await contract.acceptAndRelease(onchainGigId);
  const receipt = await tx.wait();
  return { txHash: receipt.hash };
}

export async function raiseDisputeOnchain({ onchainGigId }) {
  const { contract } = await getSignerContract();
  const tx = await contract.raiseDispute(onchainGigId);
  const receipt = await tx.wait();
  return { txHash: receipt.hash };
}

export async function resolveDisputeOnchain({ onchainGigId, releaseToStudent }) {
  const { contract } = await getSignerContract();
  const tx = await contract.resolveDispute(onchainGigId, releaseToStudent);
  const receipt = await tx.wait();
  return { txHash: receipt.hash };
}
