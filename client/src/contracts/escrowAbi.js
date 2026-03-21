export const ESCROW_ABI = [
  "function nextGigId() view returns (uint256)",
  "function createGig(uint256 deadline) payable returns (uint256 gigId)",
  "function selectStudent(uint256 gigId, address student)",
  "function submitWork(uint256 gigId)",
  "function acceptAndRelease(uint256 gigId)",
  "function raiseDispute(uint256 gigId)",
  "function resolveDispute(uint256 gigId, bool releaseToStudent)",
  "function gigs(uint256) view returns (address hirer, address student, uint256 fee, uint256 deadline, uint8 status, bool exists)"
];
