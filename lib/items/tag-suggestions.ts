// Deliberately small, deterministic topic hints—not AI or a full-page classifier.
const rules: ReadonlyArray<readonly [string, RegExp]> = [
  [
    "AI",
    /\b(?:ai|artificial intelligence|machine learning|deep learning|llms?|rag|retrieval[ -]augmented|neural networks?)\b/i,
  ],
  ["RAG", /\b(?:rag|retrieval[ -]augmented generation)\b/i],
  ["Python", /\bpython\b/i],
  [
    "JavaScript",
    /\b(?:javascript|typescript|node\.?js|react\.?js|next\.?js)\b/i,
  ],
  [
    "Development",
    /\b(?:programming|software development|source code|coding|web development|api|apis)\b/i,
  ],
  [
    "Tutorials",
    /\b(?:tutorials?|step[ -]by[ -]step|from scratch|how to|make your own|beginner'?s? guide)\b/i,
  ],
  [
    "Design",
    /\b(?:graphic design|web design|user experience|ux design|ui design|typography|figma)\b/i,
  ],
  ["Cooking", /\b(?:recipes?|cooking|baking)\b/i],
  ["Travel", /\b(?:travel|itinerary|itineraries|backpacking)\b/i],
  ["Health", /\b(?:fitness|nutrition|workouts?|exercise)\b/i],
  ["Finance", /\b(?:personal finance|investing|budgeting|mortgage)\b/i],
  ["Music", /\b(?:music|albums?|supergroup|guitar|songwriting)\b/i],
];

export function suggestTags({
  url,
  title = "",
  description = "",
}: {
  url: string;
  title?: string;
  description?: string;
}): string[] {
  let path = "";
  try {
    // Ignore host, query and fragment: tracking parameters aren't topic evidence.
    const parsed = new URL(url);
    if (["http:", "https:"].includes(parsed.protocol))
      path = decodeURIComponent(parsed.pathname).replace(/[-_]/g, " ");
  } catch {
    // A malformed URL/escape should not prevent using the available page metadata.
  }
  const text = `${title.slice(0, 500)} ${description.slice(0, 10000)} ${path.slice(0, 2000)}`;
  return rules
    .filter(([, pattern]) => pattern.test(text))
    .map(([tag]) => tag)
    .slice(0, 5);
}

export function mergeSuggestedTags(
  existing: string[],
  suggested: string[],
): string[] {
  const result = [...existing];
  const seen = new Set(existing.map((tag) => tag.trim().toLowerCase()));
  for (const tag of suggested) {
    if (result.length >= 50) break;
    if (!seen.has(tag.toLowerCase())) {
      result.push(tag);
      seen.add(tag.toLowerCase());
    }
  }
  return result;
}
