const ONCHAIN_COUNTER_KEY = "nanohire_fake_onchain_gig_counter";

function getContractAddress() {
  return import.meta.env.VITE_ESCROW_CONTRACT_ADDRESS || "FAKE-SMART-CONTRACT";
}

function nextFakeOnchainGigId() {
  const raw = localStorage.getItem(ONCHAIN_COUNTER_KEY);
  const current = Number(raw || 0);
  const next = Number.isFinite(current) ? current + 1 : 1;
  localStorage.setItem(ONCHAIN_COUNTER_KEY, String(next));
  return String(next);
}

function fakeTxHash() {
  const a = Math.random().toString(16).slice(2);
  const b = Date.now().toString(16);
  return `0x${a}${b}`.slice(0, 66);
}

async function simulateTransaction() {
  await new Promise((resolve) => setTimeout(resolve, 350));
  return { txHash: fakeTxHash() };
}

export async function createOnchainGigTransaction({ fee, deadline }) {
  if (!fee || Number(fee) <= 0) {
    throw new Error("Fee must be greater than 0.");
  }

  if (!deadline || Number.isNaN(new Date(deadline).getTime())) {
    throw new Error("Valid deadline is required.");
  }

  const tx = await simulateTransaction();

  return {
    onchainGigId: nextFakeOnchainGigId(),
    txHash: tx.txHash,
    escrowContractAddress: getContractAddress()
  };
}

export async function selectStudentOnchain({ onchainGigId, studentWalletAddress }) {
  if (!onchainGigId) throw new Error("Missing on-chain gig id.");
  return simulateTransaction();
}

export async function submitWorkOnchain({ onchainGigId }) {
  if (!onchainGigId) throw new Error("Missing on-chain gig id.");
  return simulateTransaction();
}

export async function acceptAndReleaseOnchain({ onchainGigId }) {
  if (!onchainGigId) throw new Error("Missing on-chain gig id.");
  return simulateTransaction();
}

export async function raiseDisputeOnchain({ onchainGigId }) {
  if (!onchainGigId) throw new Error("Missing on-chain gig id.");
  return simulateTransaction();
}

export async function resolveDisputeOnchain({ onchainGigId, releaseToStudent }) {
  if (!onchainGigId) throw new Error("Missing on-chain gig id.");
  if (typeof releaseToStudent !== "boolean") {
    throw new Error("releaseToStudent must be true or false.");
  }
  return simulateTransaction();
}
