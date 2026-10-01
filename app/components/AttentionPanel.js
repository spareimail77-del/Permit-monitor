"use client";

import { useState } from "react";
import ExpiringWatchlist from "./ExpiringWatchlist";

// Dashboard right-hand panel: two tabs, Overdue and Expiring soon.
// Opens on Overdue whenever anything is overdue.
export default function AttentionPanel({
  overdue,
  overdueTotal,
  expiring,
  expiringTotal,
}) {
  const [tab, setTab] = useState(overdueTotal > 0 ? "overdue" : "expiring");
  const isOverdue = tab === "overdue";

  return (
    <>
      <h2 className="panel-title">Needs attention</h2>
      <p className="panel-subtitle">
        {isOverdue
          ? "Still open past their Valid To date, most overdue first."
          : "Open permits grouped by expiry day, soonest first."}
      </p>

      <div className="attn-tabs" role="tablist" aria-label="Needs attention">
        <button
          type="button"
          role="tab"
          aria-selected={isOverdue}
          className="attn-tab attn-tab--overdue"
          onClick={() => setTab("overdue")}
        >
          Overdue <span className="attn-tab__count">{overdueTotal}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={!isOverdue}
          className="attn-tab attn-tab--expiring"
          onClick={() => setTab("expiring")}
        >
          Expiring soon <span className="attn-tab__count">{expiringTotal}</span>
        </button>
      </div>

      <div className="dash-panel__body">
        {isOverdue ? (
          <ExpiringWatchlist
            key="overdue"
            mode="overdue"
            permits={overdue}
            totalCount={overdueTotal}
            viewAllHref="/permits?status=OVERDUE"
          />
        ) : (
          <ExpiringWatchlist
            key="expiring"
            mode="expiring"
            permits={expiring}
            totalCount={expiringTotal}
            viewAllHref="/permits?status=OPEN"
          />
        )}
      </div>
    </>
  );
}
