"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import StatusBadge from "./StatusBadge";
import Icon from "./Icon";
import { STATUS_META, matchesStatusFilter } from "../../lib/statusMeta";

function uniqueSorted(values) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) =>
    a.localeCompare(b)
  );
}

export default function PermitTable({
  permits,
  duplicateReferences = [],
  initialStatus = "ALL",
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [areaFilter, setAreaFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");

  const areas = useMemo(() => uniqueSorted(permits.map((p) => p.area)), [
    permits,
  ]);
  const types = useMemo(
    () => uniqueSorted(permits.map((p) => p.permitType)),
    [permits]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return permits.filter((p) => {
      if (!matchesStatusFilter(p.displayStatus, statusFilter)) return false;
      if (areaFilter !== "ALL" && p.area !== areaFilter) return false;
      if (typeFilter !== "ALL" && p.permitType !== typeFilter) return false;
      if (!q) return true;
      const haystack = [
        p.reference,
        p.location,
        p.jobDescription,
        p.applicant,
        p.holder,
        p.issuer,
        p.areaAuthority,
        p.controller,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [permits, query, statusFilter, areaFilter, typeFilter]);

  return (
    <div>
      <div className="filter-bar">
        <input
          type="search"
          placeholder="Search reference, location, applicant, holder…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search permits"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filter by status"
        >
          <option value="ALL">All statuses</option>
          {Object.entries(STATUS_META).map(([key, meta]) => (
            <option key={key} value={key}>
              {key === "OPEN" ? "Active / Open (incl. expiring soon)" : meta.label}
            </option>
          ))}
        </select>
        <select
          value={areaFilter}
          onChange={(e) => setAreaFilter(e.target.value)}
          aria-label="Filter by area"
        >
          <option value="ALL">All areas</option>
          {areas.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          aria-label="Filter by permit type"
        >
          <option value="ALL">All permit types</option>
          {types.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      <p className="result-count">
        Showing {filtered.length} of {permits.length} permits
      </p>

      <div className="table-scroll">
        <table className="permit-table">
          <thead>
            <tr>
              <th>Reference</th>
              <th>Area</th>
              <th>Location</th>
              <th>Type</th>
              <th>Status</th>
              <th>Days</th>
              <th>Valid To</th>
              <th>Holder</th>
              <th title="Attachments">Files</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr
                key={p.reference + p.rowNumber}
                onClick={() =>
                  router.push(`/permits/${p.rowNumber}`)
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter")
                    router.push(`/permits/${p.rowNumber}`);
                }}
                tabIndex={0}
                role="link"
                style={{ cursor: "pointer" }}
              >
                <td className="mono">
                  {p.reference}
                  {duplicateReferences.includes(p.reference) && (
                    <span title="Duplicate reference — check Excel" style={{ color: "var(--color-expiring)" }}>
                      {" "}⚠
                    </span>
                  )}
                </td>
                <td>{p.area}</td>
                <td>{p.location}</td>
                <td>{p.permitType}</td>
                <td>
                  <StatusBadge status={p.displayStatus} />
                </td>
                <td className="mono">
                  {p.daysRemaining !== null ? p.daysRemaining : "—"}
                </td>
                <td className="mono">{p.validTo || "—"}</td>
                <td>{p.holder || "—"}</td>
                <td>
                  <AttachBadge count={p.attachmentCount} />
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} style={{ textAlign: "center", padding: 24 }}>
                  No permits match your search/filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="permit-cards">
        {filtered.map((p) => (
          <div
            key={p.reference + p.rowNumber}
            className="permit-card"
            onClick={() => router.push(`/permits/${p.rowNumber}`)}
            onKeyDown={(e) => {
              if (e.key === "Enter") router.push(`/permits/${p.rowNumber}`);
            }}
            tabIndex={0}
            role="link"
          >
            <div className="permit-card__top">
              <span className="mono permit-card__ref">
                {p.reference}
                {duplicateReferences.includes(p.reference) && " ⚠"}
              </span>
              <StatusBadge status={p.displayStatus} />
            </div>
            <p className="permit-card__where">
              {[p.location, p.area].filter(Boolean).join(" · ") || "—"}
            </p>
            <p className="permit-card__type">{p.permitType || "—"}</p>
            <div className="permit-card__meta">
              <span>
                Days left{" "}
                <strong className="mono">
                  {p.daysRemaining !== null ? p.daysRemaining : "—"}
                </strong>
              </span>
              <span>
                Valid to <strong className="mono">{p.validTo || "—"}</strong>
              </span>
            </div>
            <div className="permit-card__foot">
              <span>{p.holder || "—"}</span>
              <AttachBadge count={p.attachmentCount} showNone />
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="permit-cards__empty">
            No permits match your search/filters.
          </p>
        )}
      </div>
    </div>
  );
}

function AttachBadge({ count, showNone = false }) {
  if (!count) {
    return showNone ? (
      <span className="attach-badge attach-badge--none">No files</span>
    ) : (
      <span className="attach-badge attach-badge--none" title="No attachments">
        —
      </span>
    );
  }
  return (
    <span className="attach-badge" title={`${count} attachment${count > 1 ? "s" : ""}`}>
      <Icon name="paperclip" size={13} />
      {count}
    </span>
  );
}
