// Validate documents without rendering HTML. Plain-text pages remain supported;
// structured editor pages are constrained to the schema and safe link protocols.
export function isSafePageContent(content: string): boolean {
  let parsed: unknown;
  try { parsed = JSON.parse(content); } catch { return true; }
  if (!parsed || typeof parsed !== "object" || !("type" in parsed) || parsed.type !== "doc") return true;
  const allowedNodes = new Set(["doc", "paragraph", "heading", "text", "bulletList", "orderedList", "listItem", "taskList", "taskItem", "blockquote", "codeBlock", "hardBreak", "horizontalRule"]);
  const allowedMarks = new Set(["bold", "italic", "underline", "strike", "code", "link", "textStyle", "highlight"]);
  const stack: { value: unknown; depth: number }[] = [{ value: parsed, depth: 0 }];
  let count = 0;
  while (stack.length) {
    const { value, depth } = stack.pop()!;
    if (++count > 6000 || depth > 60 || !value || typeof value !== "object" || Array.isArray(value)) return false;
    const node = value as { type?: unknown; text?: unknown; attrs?: unknown; content?: unknown; marks?: unknown };
    if (typeof node.type !== "string" || !allowedNodes.has(node.type)) return false;
    if (node.type === "text" && typeof node.text !== "string") return false;
    if (node.content !== undefined) {
      if (!Array.isArray(node.content)) return false;
      for (const child of node.content) stack.push({ value: child, depth: depth + 1 });
    }
    if (node.marks !== undefined) {
      if (!Array.isArray(node.marks) || node.marks.length > 20) return false;
      for (const value of node.marks) {
        if (!value || typeof value !== "object" || Array.isArray(value)) return false;
        const mark = value as { type?: unknown; attrs?: Record<string, unknown> };
        if (typeof mark.type !== "string" || !allowedMarks.has(mark.type)) return false;
        if (mark.type === "link") {
          const href = mark.attrs?.href;
          if (typeof href !== "string" || href.length > 2048) return false;
          try { if (!["https:", "http:", "mailto:"].includes(new URL(href).protocol)) return false; } catch { return false; }
        }
        if ((mark.type === "textStyle" || mark.type === "highlight") && mark.attrs?.color != null) {
          const color = mark.attrs.color;
          if (typeof color !== "string" || !/^(#[0-9a-f]{3,8}|[a-z]{1,20}|rgba?\([0-9.,%\s]+\))$/i.test(color)) return false;
        }
      }
    }
  }
  return true;
}

// Extract readable content from structured editor documents for search,
// previews and exports while retaining compatibility with older text pages.
export function pagePlainText(content: string): string {
  if (!content) return "";
  try {
    const document: unknown = JSON.parse(content);
    if (!document || typeof document !== "object" || !("type" in document) || document.type !== "doc") return content;
    const pieces: string[] = [];
    const visit = (node: unknown) => {
      if (!node || typeof node !== "object") return;
      const item = node as { type?: unknown; text?: unknown; content?: unknown };
      if (typeof item.text === "string") pieces.push(item.text);
      if (Array.isArray(item.content)) item.content.forEach(visit);
      if (typeof item.type === "string" && ["paragraph", "heading", "listItem", "taskItem", "blockquote", "codeBlock"].includes(item.type)) pieces.push("\n");
    };
    visit(document);
    return pieces.join("").replace(/\n{3,}/g, "\n\n").trim();
  } catch {
    return content;
  }
}
