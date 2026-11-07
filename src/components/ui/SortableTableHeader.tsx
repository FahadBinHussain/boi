"use client";

import Link from "next/link";

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
 *
 * A table whose sort is a URL rather than a state change passes `href`
 * instead of `onSort`. The action is then a `<Link>` inside the same
 * `<th scope="col">`, so both kinds of sortable table keep the same header
 * semantics and the same `aria-sort`.
 */
interface SortableTableHeaderProps {
  /** Column key handed back to `onSort`, and used to match the active column. */
  field: string;
  /** Visible column label. */
  label: string;
  /** The column currently sorted by. */
  activeField: string;
  /** Sort direction of the active column. */
  direction: "asc" | "desc";
  /** Called with the column field when the header is activated. */
  onSort?: (field: string) => void;
  /** Sort as a link. When set, the header renders a `<Link>` instead of a button. */
  href?: string;
  /** Glyph shown on a column that is not sorted. Empty means no glyph. */
  inactiveIndicator?: string;
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
  href,
  inactiveIndicator = "",
  className = "",
  buttonClassName = "",
}: SortableTableHeaderProps) {
  const isActive = activeField === field;
  const ariaSort = isActive ? (direction === "asc" ? "ascending" : "descending") : "none";

  const arrow = (
    <span
      aria-hidden="true"
      className={isActive ? "text-primary font-bold" : "text-base-content/75 group-hover:text-base-content"}
    >
      {isActive ? (direction === "desc" ? "↓" : "↑") : inactiveIndicator}
    </span>
  );

  const innerClass = `inline-flex items-center gap-1 py-1 text-left ${buttonClassName}`;

  return (
    <th scope="col" aria-sort={ariaSort} className={className}>
      {href ? (
        <Link href={href} className={innerClass}>
          <span>{label}</span>
          {arrow}
        </Link>
      ) : (
        <button type="button" onClick={() => onSort?.(field)} className={innerClass}>
          <span>{label}</span>
          {arrow}
        </button>
      )}
    </th>
  );
}
