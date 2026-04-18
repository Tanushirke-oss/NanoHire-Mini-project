import { connectDB } from './src/config/db.js';
import User from './src/models/User.js';
async function run() { await connectDB(); const hirer = await User.findOne({ role: 'hirer' }).lean(); if (hirer) { console.log(JSON.stringify(hirer.walletTransactions.slice(-2), null, 2)); } process.exit(0); } run();
