"use client";

/**
 * A sortable table column header.
 *
 * The click used to live on the `<th>` itself, which made sorting a
 * pointer-only action: a keyboard user could never reach it (WCAG 2.1.1
 * Keyboard). The header now keeps its real `<th scope="col">` semantics and
 * puts the action on a native `<button>` inside it, so Tab reaches it and
 * Enter or Space activates it.
 *
 * `aria-sort` on the `<th>` is what tells assistive technology which column is
 * sorted and in which direction, so the arrow glyph is decorative and hidden
 * from the accessible name.
 */
interface SortableTableHeaderProps {
  /** Column key handed back to `onSort`. */
  field: string;
  /** Visible column label. */
  label: string;
  /** The column currently sorted by. */
  activeField: string;
  /** Sort direction of the active column. */
  direction: "asc" | "desc";
  /** Called with the column field when the header is activated. */
  onSort: (field: string) => void;
  /** Extra classes for the `<th>`. */
  className?: string;
  /** Extra classes for the inner button row. */
  buttonClassName?: string;
}

export default function SortableTableHeader({
  field,
  label,
  activeField,
  direction,
  onSort,
  className = "",
  buttonClassName = "",
}: SortableTableHeaderProps) {
  const isActive = activeField === field;

  return (
    <th
      scope="col"
      aria-sort={isActive ? (direction === "asc" ? "ascending" : "descending") : "none"}
      className={className}
    >
      <button
        type="button"
        onClick={() => onSort(field)}
        className={`inline-flex items-center gap-1 text-left ${buttonClassName}`}
      >
        <span>{label}</span>
        <span aria-hidden="true" className={isActive ? "text-primary font-bold" : "text-base-content/75 group-hover:text-base-content"}>
          {isActive ? (direction === "desc" ? "↓" : "↑") : ""}
        </span>
      </button>
    </th>
  );
}
