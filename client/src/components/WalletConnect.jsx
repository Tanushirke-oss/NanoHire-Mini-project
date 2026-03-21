import { useEffect, useState } from "react";
import { BrowserProvider } from "ethers";

function getInjectedWallet() {
  if (typeof window === "undefined") return null;
  const injected = window.ethereum;
  if (!injected) return null;

  if (Array.isArray(injected.providers) && injected.providers.length > 0) {
    return injected.providers.find((p) => p.isMetaMask) || injected.providers[0];
  }

  return injected;
}

export default function WalletConnect() {
  const [wallet, setWallet] = useState("");
  const [chainId, setChainId] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const providerSource = getInjectedWallet();
  const hasWalletProvider = !!providerSource;

  async function connectWallet() {
    setErrorMessage("");
    if (!providerSource) {
      setErrorMessage("No wallet extension was detected. You can still use off-chain features.");
      return;
    }

    try {
      const provider = new BrowserProvider(providerSource);
      const accounts = await provider.send("eth_requestAccounts", []);
      const network = await provider.getNetwork();

      setWallet(accounts?.[0] ?? "");
      setChainId(network.chainId.toString());
    } catch (error) {
      setErrorMessage(error?.message || "Unable to connect wallet.");
    }
  }

  useEffect(() => {
    if (!providerSource) return;

    const handleAccounts = (accounts) => {
      setWallet(accounts?.[0] ?? "");
    };

    providerSource.on("accountsChanged", handleAccounts);
    return () => {
      providerSource.removeListener("accountsChanged", handleAccounts);
    };
  }, [providerSource]);

  return (
    <div className="wallet-connect">
      {wallet ? (
        <span className="wallet-badge">
          Connected: {wallet.slice(0, 6)}...{wallet.slice(-4)} {chainId ? `(Chain ${chainId})` : ""}
        </span>
      ) : (
        <div className="wallet-actions">
          <button type="button" className="secondary-btn" onClick={connectWallet}>
            Connect Wallet
          </button>
          {!hasWalletProvider ? (
            <a
              href="https://metamask.io/download/"
              target="_blank"
              rel="noreferrer"
              className="wallet-install-link"
            >
              Install MetaMask
            </a>
          ) : null}
        </div>
      )}
      {errorMessage ? <p className="wallet-error">{errorMessage}</p> : null}
    </div>
  );
}
