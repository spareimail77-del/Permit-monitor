"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import StatusBadge from "./StatusBadge";
import Icon from "./Icon";
import RoleChip from "./RoleChip";
import { STATUS_META, matchesStatusFilter } from "../../lib/statusMeta";
import { daysText } from "../../lib/status";
import { downloadPermitWorkbook, listRowToExportPermit } from "../../lib/exportPermits";

function uniqueSorted(values) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) =>
    a.localeCompare(b)
  );
}

export default function PermitTable({
  permits,
  duplicateReferences = [],
  initialStatus = "ALL",
  initialArea = "ALL",
  initialType = "ALL",
  initialMine = "ALL",
  hasLinks = false,
  canExport = false,
  template = null,
  today = "",
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [areaFilter, setAreaFilter] = useState(initialArea);
  const [typeFilter, setTypeFilter] = useState(initialType);
  const [mineFilter, setMineFilter] = useState(initialMine); // ALL | MINE | holder | applicant
  const [exportState, setExportState] = useState("idle"); // idle | working | error

  const areas = useMemo(() => uniqueSorted(permits.map((p) => p.area)), [
    permits,
  ]);
  const types = useMemo(
    () => uniqueSorted(permits.map((p) => p.permitType)),
    [permits]
  );

  // Device preference from My profile -> Preferences: open on "My permits"
  // when the page was opened plainly (no filters in the address).
  useEffect(() => {
    if (!hasLinks || initialMine !== "ALL") return;
    try {
      if (
        window.location.search === "" &&
        window.localStorage.getItem("permit-log-start-mine") === "1"
      ) {
        setMineFilter("MINE");
      }
    } catch (err) {
      // storage unavailable - keep "All permits"
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // How many permits are mine, as holder, as applicant (both counts a permit
  // in each of the last two).
  const mineCounts = useMemo(() => {
    const c = { MINE: 0, holder: 0, applicant: 0 };
    for (const p of permits) {
      if (!p.mine) continue;
      c.MINE++;
      if (p.mine === "holder" || p.mine === "both") c.holder++;
      if (p.mine === "applicant" || p.mine === "both") c.applicant++;
    }
    return c;
  }, [permits]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return permits.filter((p) => {
      if (mineFilter === "MINE" && !p.mine) return false;
      if (mineFilter === "holder" && p.mine !== "holder" && p.mine !== "both") return false;
      if (mineFilter === "applicant" && p.mine !== "applicant" && p.mine !== "both") return false;
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
  }, [permits, query, statusFilter, areaFilter, typeFilter, mineFilter]);

  async function handleExport() {
    setExportState("working");
    try {
      await downloadPermitWorkbook({
        permits: filtered.map(listRowToExportPermit),
        template,
        filename: `Permit_Log_export_${today || "today"}.xlsx`,
      });
      setExportState("idle");
    } catch (err) {
      console.error("Export failed:", err);
      setExportState("error");
    }
  }

  const mineOptions = [
    { value: "ALL", label: "All permits", count: permits.length },
    { value: "MINE", label: "My permits", count: mineCounts.MINE },
    ...(mineCounts.holder > 0 && mineCounts.holder !== mineCounts.MINE
      ? [{ value: "holder", label: "As holder", count: mineCounts.holder }]
      : []),
    ...(mineCounts.applicant > 0 && mineCounts.applicant !== mineCounts.MINE
      ? [{ value: "applicant", label: "As applicant", count: mineCounts.applicant }]
      : []),
  ];

  return (
    <div>
      {hasLinks && (
        <div className="seg" role="tablist" aria-label="Which permits">
          {mineOptions.map((o) => (
            <button
              key={o.value}
              type="button"
              role="tab"
              aria-selected={mineFilter === o.value}
              className="seg__btn"
              onClick={() => setMineFilter(o.value)}
            >
              {o.label} <span className="seg__count">{o.count}</span>
            </button>
          ))}
        </div>
      )}

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
            <React.Fragment key={key}>
              <option value={key}>
                {key === "OPEN" ? "Active / Open (incl. expiring soon & overdue)" : meta.label}
              </option>
              {key === "OPEN" && (
                <option value="OPEN_ONLY">Open only (on track)</option>
              )}
            </React.Fragment>
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

      <div className="result-row">
        <p className="result-count">
          Showing {filtered.length} of {permits.length} permits
        </p>
        {canExport && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={handleExport}
            disabled={exportState === "working" || filtered.length === 0}
            title="Download the permits currently shown as an Excel file"
          >
            <Icon name="download" size={15} />
            {exportState === "working"
              ? "Preparing…"
              : `Export ${filtered.length} to Excel`}
          </button>
        )}
      </div>
      {exportState === "error" && (
        <p className="error-text">Could not create the Excel file. Try again.</p>
      )}

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
                className={p.mine ? "is-mine" : undefined}
                style={{ cursor: "pointer" }}
              >
                <td className="mono">
                  {p.reference}
                  {duplicateReferences.includes(p.reference) && (
                    <span title="Duplicate reference — check Excel" style={{ color: "var(--color-expiring)" }}>
                      {" "}⚠
                    </span>
                  )}
                  {p.mine && (
                    <>
                      {" "}
                      <RoleChip role={p.mine} short />
                    </>
                  )}
                </td>
                <td>{p.area}</td>
                <td>{p.location}</td>
                <td>{p.permitType}</td>
                <td>
                  <StatusBadge status={p.displayStatus} />
                </td>
                <td
                  className="mono"
                  style={p.displayStatus === "OVERDUE" ? { color: "var(--color-expired)", fontWeight: 600 } : undefined}
                >
                  {daysText(p)}
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
            className={`permit-card${p.mine ? " is-mine" : ""}`}
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
                {p.mine && (
                  <>
                    {" "}
                    <RoleChip role={p.mine} short />
                  </>
                )}
              </span>
              <StatusBadge status={p.displayStatus} />
            </div>
            <p className="permit-card__where">
              {[p.location, p.area].filter(Boolean).join(" · ") || "—"}
            </p>
            <p className="permit-card__type">{p.permitType || "—"}</p>
            <div className="permit-card__meta">
              <span>
                <strong
                  className="mono"
                  style={p.displayStatus === "OVERDUE" ? { color: "var(--color-expired)" } : undefined}
                >
                  {daysText(p)}
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
