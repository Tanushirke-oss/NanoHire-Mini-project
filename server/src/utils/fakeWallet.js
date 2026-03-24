const HIRER_DEFAULT_BALANCE = 2000;
const STUDENT_MIN_BALANCE = 100;
const STUDENT_MAX_BALANCE = 999;

function randomIntInclusive(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function createFakeWalletId() {
  const randomPart = Math.random().toString(36).slice(2, 10);
  return `fw_${randomPart}`;
}

function createFakeWalletAddress() {
  const base = Math.random().toString(16).slice(2, 10);
  const ts = Date.now().toString(16);
  return `0xFAKE${base}${ts}`.slice(0, 42);
}

export function getStudentInitialBalance() {
  return randomIntInclusive(STUDENT_MIN_BALANCE, STUDENT_MAX_BALANCE);
}

export async function ensureFakeWalletAssigned(user) {
  if (!user) return user;

  let changed = false;

  if (!user.fakeWalletId) {
    user.fakeWalletId = createFakeWalletId();
    changed = true;
  }

  if (!user.walletAddress) {
    user.walletAddress = createFakeWalletAddress();
    changed = true;
  }

  if (user.role === "hirer") {
    if (typeof user.walletBalance !== "number") {
      user.walletBalance = HIRER_DEFAULT_BALANCE;
      changed = true;
    }
  } else if (typeof user.walletBalance !== "number") {
    user.walletBalance = getStudentInitialBalance();
    changed = true;
  }

  if (!Array.isArray(user.walletTransactions)) {
    user.walletTransactions = [];
    changed = true;
  }

  if (changed) {
    await user.save();
  }

  return user;
}

export function serializeWallet(user) {
  return {
    walletAddress: user.walletAddress,
    walletBalance: typeof user.walletBalance === "number" ? user.walletBalance : 0,
    fakeWalletId: user.fakeWalletId || "",
    walletTransactions: Array.isArray(user.walletTransactions) ? user.walletTransactions : []
  };
}

export async function applyWalletDelta(user, { delta, type, note, gigId = "" }) {
  if (!user) {
    throw new Error("Wallet user is required.");
  }

  if (typeof delta !== "number" || Number.isNaN(delta) || delta === 0) {
    throw new Error("Wallet delta must be a non-zero number.");
  }

  await ensureFakeWalletAssigned(user);

  const currentBalance = typeof user.walletBalance === "number" ? user.walletBalance : 0;
  const nextBalance = currentBalance + delta;

  if (nextBalance < 0) {
    throw new Error("Insufficient wallet balance.");
  }

  const entry = {
    type,
    direction: delta > 0 ? "credit" : "debit",
    amount: Math.abs(delta),
    delta,
    note: note || "",
    gigId,
    balanceAfter: nextBalance,
    createdAt: new Date().toISOString()
  };

  const history = Array.isArray(user.walletTransactions) ? user.walletTransactions : [];
  history.push(entry);

  user.walletBalance = nextBalance;
  user.walletTransactions = history.slice(-100);
  await user.save();

  return entry;
}
