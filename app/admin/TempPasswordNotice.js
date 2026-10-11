"use client";

import { useState } from "react";

// Shows a temporary password ONCE. It is not stored anywhere readable.
export default function TempPasswordNotice({ staffId, password, onClose }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="notice notice--ok temp-pass">
      <p style={{ margin: "0 0 6px" }}>
        Temporary password for <strong className="mono">{staffId}</strong>. It is shown only now. Give it to the person; they
        must choose a new password at their next sign-in.
      </p>
      <p style={{ margin: "0 0 10px" }}>
        <span className="temp-pass__value mono">{password}</span>
      </p>
      <div className="pform-actions">
        <button type="button" className="btn btn-sm" onClick={copy}>
          {copied ? "Copied" : "Copy"}
        </button>
        <button type="button" className="btn btn-sm" onClick={onClose}>
          I have noted it, close
        </button>
      </div>
    </div>
  );
}
