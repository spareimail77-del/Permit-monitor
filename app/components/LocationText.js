import { shortLocation } from "../../lib/locationMatch";

// Shows a permit's location in crowded places (table rows, trash list). A long list of
// places is cut to the first few plus a "+N more" badge; hovering shows the full text.
// Short locations look exactly as before. The full text is always on the permit page.
export default function LocationText({ text, keep = 3 }) {
  const full = String(text ?? "").trim();
  if (!full) return "—";
  const s = shortLocation(full, keep);
  if (!s.more) return full;
  return (
    <span title={full}>
      {s.text}
      <span className="loc-more">+{s.more} more</span>
    </span>
  );
}
