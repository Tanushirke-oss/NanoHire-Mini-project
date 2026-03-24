import { useMemo } from "react";

const SELECTED_MESSAGES = [
  "You were chosen because your effort stood out. Build confidently and deliver with heart.",
  "Beautiful start, champion. Break this task into steps and finish strong.",
  "You earned this opportunity. Stay focused, ask smart questions, and ship quality.",
  "Your skills opened this door. Consistency will help you leave a lasting impact.",
  "Trust your preparation. Progress every day and let your work speak for you.",
  "You are the selected one for a reason. Keep momentum and complete like a pro.",
  "Clarity, discipline, and creativity can make this submission exceptional.",
  "Your talent is visible. Now convert it into a neat and on-time delivery.",
  "Stay calm, stay curious, and complete this task with pride.",
  "You are closer to your next breakthrough. Finish this task with excellence."
];

const NOT_SELECTED_MESSAGES = [
  "This one was not your match, but your effort still matters and is improving you.",
  "You are growing with every application. Keep going, your yes is coming soon.",
  "Not selected today does not reduce your value. Keep learning and stay visible.",
  "Your journey is still beautiful. Sharpen one skill and try the next task.",
  "A no can be useful feedback in disguise. Use it and come back stronger.",
  "You showed courage by applying. Keep that courage and your chance will arrive.",
  "Progress is not always instant. Stay consistent, your breakthrough is near.",
  "You are building career muscle right now. Keep applying and keep improving.",
  "Every attempt adds experience. The right hirer will recognize your effort.",
  "Take a breath, keep your confidence, and move to the next opportunity."
];

export default function MotivationalMessage({ isSelected }) {
  const messages = isSelected ? SELECTED_MESSAGES : NOT_SELECTED_MESSAGES;
  const message = useMemo(() => {
    const randomIndex = Math.floor(Math.random() * messages.length);
    return messages[randomIndex];
  }, [messages]);

  return (
    <div className={`motivational-message ${isSelected ? "selected" : "not-selected"}`}>
      <p>{message}</p>
    </div>
  );
}
