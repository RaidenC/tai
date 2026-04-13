---
markmap:
  initialExpandLevel: 4
  colorFreezeLevel: 3
  spacingVertical: 12
---
# **1. Concept Group 1**
## **1.1 Sub Group 1**
1. Sub-concept A
2. Sub-concept B

# **2. Concept Group 2**
## **2.1 Sub Group 1**
1. Sub-concept C

---

# Markmap Mindmap Template Rules

When generating an external Mindmap for a knowledge base article, adhere to the following rules:

1. **Separate File:** The mindmap must be created in a separate file ending in `-mindmap.md` (e.g., `message-queues-mindmap.md`).
2. **YAML Frontmatter:** Use the frontmatter shown above. Setting `colorFreezeLevel: 3`,  `spacingVertical: 12` ensures that the root-to-parent line is a different color than the parent-to-child line, providing deep visual contrast for spatial memory.
3. **Clean Text (No Links):** Do NOT wrap the nodes in markdown hyperlinks. Keep the text clean and readable. The VS Code Markmap extension struggles with local file resolution, so plain text is required.
4. **Parent Node Prominence:** Use Markdown bolding (`**`) and heading levels (`##`) to make parent nodes stand out visually from children.
5. **Max 5 Children Rule:** If a parent node has more than 5 child nodes, group them by adding a new intermediate layer (`###`).
6. **No Q&A:** Do not include the Interview Q&A section in the mindmap to prevent visual clutter.
7. **Abstract Important Points:** For the deepest levels of the mindmap (under the numbered child nodes), extract 2-3 concise, highly important bullet points from the main document to provide deeper context. Do not just copy the headers.
8. **Assign Number:** Assign numbers to all headings at each level and use ordered lists (`1. `, `2. `) for child nodes. Sub-bullets should use standard unordered list markers (`- `).