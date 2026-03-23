export const crossword = {
  name: "crossword",
  title: "Mini Crossword",
  type: "document",
  fields: [
    { name: "date", title: "Date (YYYY-MM-DD)", type: "string" },
    { name: "status", title: "Status", type: "string", options: { list: ["draft", "in_review", "scheduled", "published", "archived"] }, initialValue: "draft" },
    { name: "masthead", title: "Masthead", type: "string", initialValue: "canberratimes" },
    { name: "size", title: "Grid size", type: "number", initialValue: 5 },
    {
      name: "solution",
      title: "Solution grid (flat array, space for black cells)",
      type: "array",
      of: [{ type: "string" }],
      description: "25 characters for 5×5. Use space for black cells.",
    },
    {
      name: "clues_across",
      title: "Across clues",
      type: "array",
      of: [{ type: "object", fields: [
        { name: "number", title: "Clue number", type: "string" },
        { name: "clue", title: "Clue text", type: "string" },
      ]}],
    },
    {
      name: "clues_down",
      title: "Down clues",
      type: "array",
      of: [{ type: "object", fields: [
        { name: "number", title: "Clue number", type: "string" },
        { name: "clue", title: "Clue text", type: "string" },
      ]}],
    },
  ],
  preview: {
    select: { title: "date", subtitle: "status" },
  },
};
