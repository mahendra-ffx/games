export const timelineGuess = {
  name: "timelineGuess",
  title: "Flashback Friday",
  type: "document",
  fields: [
    { name: "date", title: "Publish date (YYYY-MM-DD)", type: "string" },
    { name: "title", title: "Title", type: "string", initialValue: "Flashback Friday" },
    { name: "status", title: "Status", type: "string", options: { list: ["draft", "in_review", "scheduled", "published", "archived"] }, initialValue: "draft" },
    { name: "masthead", title: "Masthead", type: "string", initialValue: "canberratimes" },
    { name: "year_range_start", title: "Year range start", type: "number", initialValue: 1913 },
    { name: "year_range_end", title: "Year range end", type: "number", initialValue: 2010 },
    {
      name: "photos",
      title: "Photos (up to 9)",
      type: "array",
      validation: (r: { max: (n: number) => unknown }) => r.max(9),
      of: [{ type: "object", fields: [
        { name: "image", title: "Image URL (from Valencia/Transform)", type: "url" },
        { name: "year", title: "Actual year", type: "number" },
        { name: "credit", title: "Photo credit", type: "string" },
        { name: "desc", title: "Description / caption", type: "text" },
        { name: "hint_decade", title: "Hint: Decade", type: "string" },
        { name: "hint_context", title: "Hint: Context clue", type: "string" },
      ]}],
    },
  ],
  preview: {
    select: { title: "date", subtitle: "status" },
  },
};
