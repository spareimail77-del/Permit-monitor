"use client";

import { useState } from "react";

export default function UploadPage() {
  const [file, setFile] = useState(null);
  const [state, setState] = useState("idle"); // idle | uploading | done | error
  const [message, setMessage] = useState("");
  const [result, setResult] = useState(null);

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

  return (
    <main style={styles.main}>
      <header style={styles.header}>
        <div style={styles.headerInner}>
          <p style={styles.eyebrow}>SWWS — Salalah</p>
          <h1 style={styles.title}>Upload Permit Log</h1>
        </div>
      </header>

      <section style={styles.body}>
        <div style={styles.card}>
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
              disabled={!file || state === "uploading"}
              style={{
                ...styles.button,
                opacity: !file || state === "uploading" ? 0.5 : 1,
              }}
            >
              {state === "uploading" ? "Uploading…" : "Upload"}
            </button>
          </form>

          {state === "error" && (
            <p style={styles.errorText}>{message}</p>
          )}

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
      </section>
    </main>
  );
}

const styles = {
  main: { minHeight: "100dvh" },
  header: { background: "var(--color-brand-dark)", color: "#fff" },
  headerInner: { maxWidth: 720, margin: "0 auto", padding: "28px 20px" },
  eyebrow: {
    margin: 0,
    fontFamily: "var(--font-mono)",
    fontSize: "var(--font-size-xs)",
    letterSpacing: "0.04em",
    color: "#bfe3ec",
  },
  title: { marginTop: 6, fontSize: "var(--font-size-2xl)" },
  body: { maxWidth: 720, margin: "0 auto", padding: "32px 20px" },
  card: {
    background: "var(--color-surface)",
    border: "1px solid var(--color-rule)",
    borderRadius: "var(--radius-md)",
    padding: "24px 28px",
  },
  cardText: { color: "var(--color-ink-muted)", marginTop: 0 },
  form: {
    display: "flex",
    gap: 12,
    alignItems: "center",
    marginTop: 20,
    flexWrap: "wrap",
  },
  fileInput: { fontSize: "var(--font-size-sm)" },
  button: {
    background: "var(--color-brand)",
    color: "#fff",
    border: "none",
    borderRadius: "var(--radius-sm)",
    padding: "10px 18px",
    fontSize: "var(--font-size-sm)",
    fontWeight: 600,
    cursor: "pointer",
  },
  errorText: { color: "var(--color-expired)", marginTop: 16 },
  resultBox: {
    marginTop: 20,
    padding: "16px 18px",
    background: "var(--color-open-tint)",
    border: "1px solid var(--color-open)",
    borderRadius: "var(--radius-sm)",
  },
  resultLine: { margin: "4px 0", fontSize: "var(--font-size-sm)" },
};
