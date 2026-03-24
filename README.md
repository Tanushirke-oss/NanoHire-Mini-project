# NanoHire - Micro Internship Marketplace

NanoHire is a micro-internship marketplace where hirers post short tasks and students apply, collaborate with progress updates, and get paid through a smart contract escrow flow.

## Features

- Hirers can create one-time internships with fee and deadline.
- Students can apply for posted tasks.
- Hirers choose one applicant.
- Progress updates and feedback before deadline.
- Task submission and acceptance flow.
- Smart contract escrow model for release of payment.
- Social-style homepage feed with image/video links and posts.
- Profile page with optional resume and portfolio upload fields (URL or real file upload).
- MongoDB-backed persistent data model for users, gigs, applications, updates, and posts.
- Direct on-chain gig actions from UI: create escrow, select student, submit work, release payment.
- JWT login/register authentication with protected API routes.
- On-chain dispute raise and dispute resolution (release/refund) flow.

## Project Structure

- `client` - React + Vite frontend
- `server` - Node.js + Express API + MongoDB persistence + file uploads
- `contracts` - Solidity escrow contract (Hardhat)

## 1) Install Dependencies

From project root:

```bash
npm install
```

## 2) Configure Environment

Create env files:

1. `server/.env`

```env
PORT=4000
# Optional. If missing, app auto-starts an in-memory MongoDB.
# For persistent database, set your local/remote Mongo URI.
MONGO_URI=mongodb://127.0.0.1:27017/nanohire
JWT_SECRET=replace-with-long-secret
# Optional cloud storage. If omitted, files stay in local /uploads.
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

2. `client/.env`

```env
VITE_API_URL=http://localhost:4000
VITE_ESCROW_CONTRACT_ADDRESS=0xYourDeployedEscrowAddress
```

## 3) Smart Contract Buttons (Now Simulated In-App)

NanoHire now uses an in-app wallet and simulated on-chain transaction IDs. MetaMask is not required.

If you still want to connect a real contract for experimentation, keep `VITE_ESCROW_CONTRACT_ADDRESS` in `client/.env`.

Optional Hardhat local workflow:

```bash
cd contracts
npx hardhat compile
npx hardhat node
```

Open another terminal in `contracts` and deploy:

```bash
npx hardhat run scripts/deploy.js --network localhost
```

Copy deployed contract address into `client/.env` as `VITE_ESCROW_CONTRACT_ADDRESS` if needed.

## 4) Run Backend + Frontend

From project root:

```bash
npm run dev
```

Open app:

- Frontend: `http://localhost:5173`
- Backend health: `http://localhost:4000/health`

## 5) Login And Registration

- Login page: `http://localhost:5173/login`
- Create your account from the register tab on the same page.
- Enter your own wallet address while registering.

## 6) Using The Full Workflow

1. Connect wallet in navbar.
2. Create internship in marketplace.
3. Open gig detail page and click `Lock Escrow On Chain`.
4. Student applies.
5. Hirer selects student (on-chain select transaction is sent).
6. Student posts updates and then submits work (on-chain submit transaction).
7. Hirer accepts submission (on-chain payment release transaction).
8. If needed, hirer/student can raise dispute and hirer can resolve release/refund in this MVP.

## Optional Commands

- Frontend build:

```bash
npm run build --workspace client
```

- Contract compile:

```bash
npm run compile --workspace contracts
```

## Notes

- If `MONGO_URI` is not provided, server uses in-memory MongoDB automatically.
- For production uploads, replace local disk uploads with S3/Cloudinary.
- Escrow contract expects fee in ETH value when creating on-chain gig.

## Vercel Deployment

Deploy frontend and backend as separate Vercel projects.

### A) Deploy Backend (`server`)

1. In Vercel, create a new project and select the `server` folder as root.
2. Vercel uses `server/vercel.json` and serves `server/api/index.js`.
3. Add environment variables:

```env
MONGO_URI=<your-production-mongodb-uri>
JWT_SECRET=<your-production-jwt-secret>
```

4. Deploy and note backend URL, for example:

`https://nanohire-server.vercel.app`

### B) Deploy Frontend (`client`)

1. Create another Vercel project with `client` folder as root.
2. Vercel uses `client/vercel.json` for SPA routing.
3. Add environment variable:

```env
VITE_API_URL=https://nanohire-server.vercel.app
```

4. Deploy frontend.

### C) Post-Deploy Check

1. Open frontend URL and register/login.
2. Verify task posting, profile links, and messages work.
3. Verify backend health:

`https://nanohire-server.vercel.app/health`
