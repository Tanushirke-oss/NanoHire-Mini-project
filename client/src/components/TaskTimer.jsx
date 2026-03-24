import { useEffect, useState } from "react";

export default function TaskTimer({ deadline }) {
  const [timeLeft, setTimeLeft] = useState("");
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const deadlineDate = new Date(deadline);
      const diff = deadlineDate - now;

      if (diff <= 0) {
        setTimeLeft("⏰ Task Deadline Passed");
        setIsExpired(true);
        clearInterval(interval);
      } else {
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
        const mins = Math.floor((diff / 1000 / 60) % 60);
        const secs = Math.floor((diff / 1000) % 60);

        setTimeLeft(`⏰ ${days}d ${hours}h ${mins}m ${secs}s left`);
        setIsExpired(false);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [deadline]);

  return (
    <div className={`task-timer ${isExpired ? "expired" : "active"}`}>
      {timeLeft}
    </div>
  );
}
