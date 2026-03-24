function toTimestamp(value) {
  const parsed = Date.parse(value || "");
  return Number.isFinite(parsed) ? parsed : 0;
}

function gigTimestamp(gig) {
  return Math.max(toTimestamp(gig?.updatedAt), toTimestamp(gig?.createdAt));
}

export function buildActivityNotifications({ currentUser, gigs = [], messages = [] }) {
  if (!currentUser?.id) return [];

  const now = Date.now();
  const role = currentUser.role;
  const userId = currentUser.id;
  const items = [];

  const unreadMessages = messages.filter(
    (message) => message.receiverId === userId && message.isRead === false
  );

  if (unreadMessages.length > 0) {
    const latestUnread = unreadMessages.reduce((latest, message) => {
      return toTimestamp(message.createdAt) > toTimestamp(latest?.createdAt) ? message : latest;
    }, unreadMessages[0]);

    items.push({
      id: `unread-msg-${userId}`,
      kind: "message",
      text:
        role === "hirer"
          ? `You have ${unreadMessages.length} unread student message(s).`
          : `You have ${unreadMessages.length} unread message(s) from hirer(s).`,
      link: "/messages",
      createdAt: latestUnread?.createdAt || new Date(now).toISOString()
    });
  }

  gigs.forEach((gig) => {
    const relevantForHirer = role === "hirer" && gig.hirerId === userId;
    const relevantForStudent = role === "student" && gig.selectedStudentId === userId;
    if (!relevantForHirer && !relevantForStudent) return;

    const ts = gigTimestamp(gig) || now;
    const createdAt = new Date(ts).toISOString();

    if (relevantForHirer && gig.status === "submitted") {
      items.push({
        id: `submitted-${gig.id}`,
        kind: "submission",
        text: `Work submitted for "${gig.title}". Review and release payment.`,
        link: `/marketplace/${gig.id}`,
        createdAt
      });
    }

    if (relevantForHirer && gig.status === "in_progress") {
      items.push({
        id: `in-progress-hirer-${gig.id}`,
        kind: "workflow",
        text: `Task "${gig.title}" is in progress and escrow is locked.`,
        link: `/marketplace/${gig.id}`,
        createdAt
      });
    }

    if (relevantForStudent && gig.status === "in_progress") {
      items.push({
        id: `in-progress-student-${gig.id}`,
        kind: "workflow",
        text: `You were selected for "${gig.title}". Keep delivering toward the deadline.`,
        link: `/marketplace/${gig.id}`,
        createdAt
      });
    }

    if (relevantForStudent && gig.status === "submitted") {
      items.push({
        id: `submitted-student-${gig.id}`,
        kind: "submission",
        text: `Submission received for "${gig.title}". Waiting for hirer approval.`,
        link: `/marketplace/${gig.id}`,
        createdAt
      });
    }

    if (
      (relevantForHirer || relevantForStudent) &&
      gig.payment?.status === "released_to_student_wallet"
    ) {
      items.push({
        id: `released-${gig.id}`,
        kind: "payment",
        text:
          role === "hirer"
            ? `Payment released for "${gig.title}".`
            : `Payment released to your wallet for "${gig.title}".`,
        link: `/marketplace/${gig.id}`,
        createdAt
      });
    }

    if (relevantForHirer && gig.payment?.status === "refunded_to_hirer_wallet") {
      items.push({
        id: `refunded-hirer-${gig.id}`,
        kind: "payment",
        text: `Refund returned to your wallet for "${gig.title}".`,
        link: `/marketplace/${gig.id}`,
        createdAt
      });
    }

    if (relevantForStudent && gig.payment?.status === "refunded_to_hirer_wallet") {
      items.push({
        id: `refunded-student-${gig.id}`,
        kind: "payment",
        text: `Task "${gig.title}" was refunded to hirer after dispute resolution.`,
        link: `/marketplace/${gig.id}`,
        createdAt
      });
    }
  });

  const unique = new Map();
  items.forEach((item) => {
    unique.set(item.id, item);
  });

  return [...unique.values()]
    .sort((a, b) => toTimestamp(b.createdAt) - toTimestamp(a.createdAt))
    .slice(0, 12);
}