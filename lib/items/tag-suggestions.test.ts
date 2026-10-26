import { describe, expect, it } from "vitest";
import { mergeSuggestedTags, suggestTags } from "./tag-suggestions";

describe("keyword tag suggestions", () => {
  it("classifies the RAG example using page metadata and the URL path", () => {
    expect(
      suggestTags({
        url: "https://huggingface.co/blog/ngxson/make-your-own-rag",
        title: "Code a simple RAG from scratch",
        description:
          "Build a retrieval-augmented generation system using Python and Ollama.",
      }),
    ).toEqual(["AI", "RAG", "Python", "Tutorials"]);
  });

  it("does not infer topics from hosts, tracking parameters, fragments or partial words", () => {
    expect(
      suggestTags({
        url: "https://python.example/article?topic=recipe#rag",
        title: "A fragment about exercisebooks and apiaries",
      }),
    ).toEqual([]);
  });

  it("uses decoded path words and tolerates malformed URLs", () => {
    expect(
      suggestTags({ url: "https://example.com/web_design/how%20to" }),
    ).toEqual(["Tutorials", "Design"]);
    expect(suggestTags({ url: "invalid", title: "Guitar music" })).toEqual([
      "Music",
    ]);
    expect(
      suggestTags({ url: "https://example.com/%zz", title: "Python" }),
    ).toEqual(["Python"]);
    expect(suggestTags({ url: "data:text/plain,python" })).toEqual([]);
  });

  it("keeps suggestions modest and returns nothing for unknown topics", () => {
    expect(
      suggestTags({
        url: "https://example.com",
        title: "RAG Python JavaScript coding tutorial recipes travel music",
      }),
    ).toHaveLength(5);
    expect(
      suggestTags({ url: "https://example.com", title: "A quiet afternoon" }),
    ).toEqual([]);
  });

  it("merges without replacing authored tags or adding case-insensitive duplicates", () => {
    const existing = ["Projects", "ai"];
    expect(mergeSuggestedTags(existing, ["AI", "Python", "Python"])).toEqual([
      "Projects",
      "ai",
      "Python",
    ]);
    expect(existing).toEqual(["Projects", "ai"]);
  });

  it("respects the item tag limit without dropping authored tags", () => {
    const existing = Array.from({ length: 49 }, (_, index) => `Tag ${index}`);
    expect(mergeSuggestedTags(existing, ["AI", "Python"])).toEqual([
      ...existing,
      "AI",
    ]);
    expect(mergeSuggestedTags([...existing, "Custom"], ["AI"])).toEqual([
      ...existing,
      "Custom",
    ]);
  });
});
