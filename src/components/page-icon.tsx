import {
  BookOpen, CalendarDays, Coffee, FileText, Flower2, Heart, Laptop, Leaf,
  Lightbulb, MessageCircle, Moon, Mountain, Palette, Pin, Puzzle, Rocket,
  Sparkles, Sprout, Star, Sun, Target, TreeDeciduous, Bird, NotebookPen,
  type LucideIcon,
} from "lucide-react";

export const PAGE_ICONS: { value: string; label: string; icon: LucideIcon }[] = [
  { value: "leaf", label: "Leaf", icon: Leaf },
  { value: "file", label: "Page", icon: FileText },
  { value: "sparkles", label: "Sparkles", icon: Sparkles },
  { value: "sprout", label: "Sprout", icon: Sprout },
  { value: "flower", label: "Flower", icon: Flower2 },
  { value: "sun", label: "Sun", icon: Sun },
  { value: "notebook", label: "Notebook", icon: NotebookPen },
  { value: "book", label: "Book", icon: BookOpen },
  { value: "bulb", label: "Idea", icon: Lightbulb },
  { value: "calendar", label: "Calendar", icon: CalendarDays },
  { value: "palette", label: "Palette", icon: Palette },
  { value: "pin", label: "Pin", icon: Pin },
  { value: "heart", label: "Heart", icon: Heart },
  { value: "coffee", label: "Coffee", icon: Coffee },
  { value: "message", label: "Message", icon: MessageCircle },
  { value: "puzzle", label: "Puzzle", icon: Puzzle },
  { value: "target", label: "Target", icon: Target },
  { value: "moon", label: "Moon", icon: Moon },
  { value: "mountain", label: "Mountain", icon: Mountain },
  { value: "bird", label: "Bird", icon: Bird },
  { value: "laptop", label: "Laptop", icon: Laptop },
  { value: "star", label: "Star", icon: Star },
  { value: "rocket", label: "Rocket", icon: Rocket },
  { value: "tree", label: "Tree", icon: TreeDeciduous },
];

const legacyIcons: Record<string, string> = {
  "📄": "file", "🌿": "leaf", "✨": "sparkles", "✳️": "sparkles", "🌱": "sprout",
  "🪴": "sprout", "☀️": "sun", "📝": "notebook", "📚": "book", "💡": "bulb",
  "🗓️": "calendar", "💬": "message", "🎨": "palette", "📌": "pin", "🌼": "flower",
  "🍃": "leaf", "🧡": "heart", "☕": "coffee", "💭": "message", "🧩": "puzzle",
  "🎯": "target", "🌙": "moon", "🪨": "mountain", "🕊️": "bird", "💻": "laptop",
  "🌻": "flower", "🚀": "rocket", "✍️": "notebook",
};

export function PageIcon({ value, size = 20, className = "" }: { value: string; size?: number; className?: string }) {
  const normalized = legacyIcons[value] ?? value;
  const item = PAGE_ICONS.find((entry) => entry.value === normalized);
  if (!item) return <span className={className} aria-hidden="true">{value}</span>;
  const Icon = item.icon;
  return <Icon className={className} size={size} strokeWidth={1.7} aria-hidden="true" />;
}
