// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract NanoHireEscrow {
    address public mediator;

    enum GigStatus {
        Open,
        StudentSelected,
        Submitted,
        Completed,
        Cancelled,
        Disputed,
        Refunded
    }

    struct Gig {
        address hirer;
        address student;
        uint256 fee;
        uint256 deadline;
        GigStatus status;
        bool exists;
    }

    uint256 public nextGigId;
    mapping(uint256 => Gig) public gigs;

    event GigCreated(uint256 indexed gigId, address indexed hirer, uint256 fee, uint256 deadline);
    event StudentSelected(uint256 indexed gigId, address indexed student);
    event WorkSubmitted(uint256 indexed gigId, address indexed student);
    event PaymentReleased(uint256 indexed gigId, address indexed student, uint256 amount);
    event GigCancelled(uint256 indexed gigId);
    event DisputeRaised(uint256 indexed gigId, address indexed raisedBy);
    event DisputeResolved(uint256 indexed gigId, bool releaseToStudent, uint256 amount);

    constructor() {
        mediator = msg.sender;
    }

    modifier onlyMediator() {
        require(msg.sender == mediator, "Only mediator allowed");
        _;
    }

    modifier onlyHirer(uint256 gigId) {
        require(gigs[gigId].exists, "Gig does not exist");
        require(msg.sender == gigs[gigId].hirer, "Only hirer allowed");
        _;
    }

    modifier onlySelectedStudent(uint256 gigId) {
        require(gigs[gigId].exists, "Gig does not exist");
        require(msg.sender == gigs[gigId].student, "Only selected student allowed");
        _;
    }

    function createGig(uint256 deadline) external payable returns (uint256 gigId) {
        require(msg.value > 0, "Fee must be greater than zero");
        require(deadline > block.timestamp, "Deadline must be in future");

        gigId = nextGigId;
        gigs[gigId] = Gig({
            hirer: msg.sender,
            student: address(0),
            fee: msg.value,
            deadline: deadline,
            status: GigStatus.Open,
            exists: true
        });

        nextGigId += 1;

        emit GigCreated(gigId, msg.sender, msg.value, deadline);
    }

    function selectStudent(uint256 gigId, address student) external onlyHirer(gigId) {
        Gig storage gig = gigs[gigId];
        require(gig.status == GigStatus.Open, "Gig not open");
        require(student != address(0), "Invalid student address");

        gig.student = student;
        gig.status = GigStatus.StudentSelected;

        emit StudentSelected(gigId, student);
    }

    function submitWork(uint256 gigId) external onlySelectedStudent(gigId) {
        Gig storage gig = gigs[gigId];
        require(gig.status == GigStatus.StudentSelected, "Gig not in progress");
        require(block.timestamp <= gig.deadline, "Deadline passed");

        gig.status = GigStatus.Submitted;
        emit WorkSubmitted(gigId, msg.sender);
    }

    function acceptAndRelease(uint256 gigId) external onlyHirer(gigId) {
        Gig storage gig = gigs[gigId];
        require(gig.status == GigStatus.Submitted, "Work not submitted");

        gig.status = GigStatus.Completed;
        uint256 amount = gig.fee;
        gig.fee = 0;

        (bool sent, ) = gig.student.call{value: amount}("");
        require(sent, "Transfer failed");

        emit PaymentReleased(gigId, gig.student, amount);
    }

    function raiseDispute(uint256 gigId) external {
        Gig storage gig = gigs[gigId];
        require(gig.exists, "Gig does not exist");
        require(msg.sender == gig.hirer || msg.sender == gig.student, "Only participants can dispute");
        require(gig.status == GigStatus.StudentSelected || gig.status == GigStatus.Submitted, "Invalid dispute state");

        gig.status = GigStatus.Disputed;
        emit DisputeRaised(gigId, msg.sender);
    }

    function resolveDispute(uint256 gigId, bool releaseToStudent) external onlyMediator {
        Gig storage gig = gigs[gigId];
        require(gig.exists, "Gig does not exist");
        require(gig.status == GigStatus.Disputed, "Gig is not disputed");

        uint256 amount = gig.fee;
        gig.fee = 0;

        if (releaseToStudent) {
            gig.status = GigStatus.Completed;
            (bool sentToStudent, ) = gig.student.call{value: amount}("");
            require(sentToStudent, "Transfer to student failed");
            emit PaymentReleased(gigId, gig.student, amount);
        } else {
            gig.status = GigStatus.Refunded;
            (bool refunded, ) = gig.hirer.call{value: amount}("");
            require(refunded, "Refund failed");
        }

        emit DisputeResolved(gigId, releaseToStudent, amount);
    }

    function cancelBeforeSelection(uint256 gigId) external onlyHirer(gigId) {
        Gig storage gig = gigs[gigId];
        require(gig.status == GigStatus.Open, "Cannot cancel now");

        gig.status = GigStatus.Cancelled;
        uint256 amount = gig.fee;
        gig.fee = 0;

        (bool sent, ) = gig.hirer.call{value: amount}("");
        require(sent, "Refund failed");

        emit GigCancelled(gigId);
    }
}
