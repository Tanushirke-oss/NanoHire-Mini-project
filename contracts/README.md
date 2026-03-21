# NanoHire Smart Contracts

`NanoHireEscrow` provides an escrow workflow:

1. Hirer creates gig and deposits fee (`createGig`).
2. Hirer selects a student (`selectStudent`).
3. Student submits work (`submitWork`).
4. Hirer accepts and payment is released (`acceptAndRelease`).

## Commands

```bash
npm install
npx hardhat compile
npx hardhat node
npx hardhat run scripts/deploy.js --network localhost
```
