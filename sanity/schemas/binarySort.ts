/**
 * Sanity schema — Binary Sort (North vs South and variants)
 */
export const binarySort = {
  name: "binarySort",
  title: "Binary Sort Game",
  type: "document",
  fields: [
    { name: "date", title: "Date (YYYY-MM-DD)", type: "string", validation: (r: { required: () => unknown }) => r.required() },
    { name: "status", title: "Status", type: "string", options: { list: ["draft", "in_review", "scheduled", "published", "archived"] }, initialValue: "draft" },
    { name: "masthead", title: "Masthead", type: "string", initialValue: "canberratimes" },
    { name: "rounds", title: "Rounds", type: "number", initialValue: 15 },
    { name: "time_per_round_ms", title: "Time per round (ms)", type: "number", initialValue: 5000 },
    {
      name: "categories",
      title: "Categories",
      type: "object",
      fields: [
        { name: "A", title: "Category A", type: "object", fields: [
          { name: "label", type: "string" },
          { name: "color", type: "string" },
        ]},
        { name: "B", title: "Category B", type: "object", fields: [
          { name: "label", type: "string" },
          { name: "color", type: "string" },
        ]},
      ],
    },
    {
      name: "items",
      title: "Items",
      type: "array",
      of: [{ type: "object", fields: [
        { name: "name", type: "string" },
        { name: "category", type: "string" },
        { name: "lat", type: "number" },
        { name: "lng", type: "number" },
      ]}],
    },
    {
      name: "divider_line",
      title: "Divider line (lat/lng pairs)",
      type: "array",
      of: [{ type: "object", fields: [
        { name: "lat", type: "number" },
        { name: "lng", type: "number" },
      ]}],
    },
  ],
  preview: {
    select: { title: "date", subtitle: "status" },
  },
};
