"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "../components/Icon";
import { createClient } from "../../lib/supabase/client";

export default function UploadForm() {
  const router = useRouter();
  const [file, setFile] = useState(null);
  const [state, setState] = useState("idle"); // idle | uploading | done | error
  const [message, setMessage] = useState("");
  const [result, setResult] = useState(null);
  const [signingOut, setSigningOut] = useState(false);

  async function handleUpload(e) {
    e.preventDefault();
    if (!file) return;

    setState("uploading");
    setMessage("");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        setState("error");
        setMessage(data.error || "Upload failed.");
        return;
      }

      setState("done");
      setResult(data);
    } catch (err) {
      setState("error");
      setMessage("Upload failed. Check your connection and try again.");
    }
  }

  async function handleSignOut() {
    setSigningOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } finally {
      router.push("/login");
      router.refresh();
    }
  }

  return (
    <div className="panel" style={styles.card}>
      <div style={styles.cardHead}>
        <p style={styles.badge}>
          <Icon name="checkCircle" size={14} /> Signed in as admin
        </p>
        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          className="btn btn-ghost"
          style={{ padding: "6px 12px", fontSize: "var(--font-size-xs)" }}
        >
          <Icon name="logout" size={14} />
          {signingOut ? "Signing out…" : "Sign out"}
        </button>
      </div>

      <p style={styles.cardText}>
        Upload the latest <span className="mono">.xlsm</span> permit log.
        This replaces the file the dashboard reads from. Your local
        Excel file and its macros are never touched — this only copies
        the file to storage.
      </p>

      <form onSubmit={handleUpload} style={styles.form}>
        <input
          type="file"
          accept=".xlsm,.xlsx"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          style={styles.fileInput}
        />
        <button
          type="submit"
          className="btn btn-primary"
          disabled={!file || state === "uploading"}
        >
          {state === "uploading" ? "Uploading…" : "Upload"}
        </button>
      </form>

      {state === "error" && <p className="error-text">{message}</p>}

      {state === "done" && result && (
        <div style={styles.resultBox}>
          <p style={styles.resultLine}>
            <strong>Uploaded:</strong>{" "}
            <span className="mono">{result.originalName}</span>
          </p>
          <p style={styles.resultLine}>
            <strong>Size:</strong> {(result.size / 1024).toFixed(0)} KB
          </p>
          <p style={styles.resultLine}>
            <strong>Stored at:</strong>{" "}
            {new Date(result.uploadedAt).toLocaleString()}
          </p>
        </div>
      )}
    </div>
  );
}

const styles = {
  card: { padding: "24px 28px" },
  cardHead: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
    flexWrap: "wrap",
    gap: 10,
  },
  badge: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    margin: 0,
    fontSize: "var(--font-size-xs)",
    fontWeight: 600,
    color: "var(--color-open)",
  },
  cardText: { color: "var(--color-ink-muted)", marginTop: 0 },
  form: {
    display: "flex",
    gap: 12,
    alignItems: "center",
    marginTop: 20,
    flexWrap: "wrap",
  },
  fileInput: { fontSize: "var(--font-size-sm)", color: "var(--color-ink)" },
  resultBox: {
    marginTop: 20,
    padding: "16px 18px",
    background: "var(--color-open-tint)",
    border: "1px solid var(--color-open)",
    borderRadius: "var(--radius-sm)",
  },
  resultLine: { margin: "4px 0", fontSize: "var(--font-size-sm)" },
};
