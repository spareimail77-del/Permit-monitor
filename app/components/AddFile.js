"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FILE_KINDS, fileProblem, formatBytes } from "../../lib/fileRules";
import { uploadPermitFiles } from "../../lib/uploadFiles";
import { editImageFile } from "../../lib/editImage";

const FILE_ACCEPT = ".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png";

// Adds one more document to a permit that is already saved.
// certificateNames: the permit's certificates (without NA), for "Certificate copy".
export default function AddFile({ permitId, certificateNames = [] }) {
  const router = useRouter();
  const [kind, setKind] = useState("permit_copy");
  const [label, setLabel] = useState("");
  const [file, setFile] = useState(null);
  const [state, setState] = useState("idle"); // idle | saving
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [over, setOver] = useState(false);

  const kinds = Object.entries(FILE_KINDS).filter(([k]) => k !== "certificate" || certificateNames.length > 0);

  function say(text, error) {
    setMessage(text);
    setIsError(error);
  }

  async function pick(picked) {
    // Photos open the crop and compress editor first; PDFs go straight through.
    const f = picked ? await editImageFile(picked) : null;
    if (picked && !f) return; // cancelled in the editor
    setFile(f);
    say(f ? fileProblem(f) || "" : "", Boolean(f && fileProblem(f)));
  }

  async function submit(e) {
    e.preventDefault();
    if (state === "saving") return;
    const problem = fileProblem(file);
    if (problem) return say(problem, true);
    if (kind === "certificate" && !label) return say("Choose which certificate this is a copy of.", true);

    setState("saving");
    say("", false);
    const out = await uploadPermitFiles(permitId, [{ file, kind, label: kind === "other" || kind === "certificate" ? label.trim() : "" }]);
    setState("idle");
    if (out.saved === 1) {
      setFile(null);
      setLabel("");
      say("File added.", false);
      router.refresh();
    } else {
      say(`${file.name} could not be added (${out.failed[0]?.reason || "unknown problem"}). Try again.`, true);
    }
  }

  return (
    <form onSubmit={submit} className="pform pform--tight">
      <div className="pform-grid">
        <div className="pform-field">
          <label htmlFor="af-kind">Kind of document</label>
          <select
            id="af-kind"
            className="pform-input"
            value={kind}
            onChange={(e) => {
              setKind(e.target.value);
              setLabel("");
            }}
            disabled={state === "saving"}
          >
            {kinds.map(([k, name]) => (
              <option key={k} value={k}>
                {name}
              </option>
            ))}
          </select>
        </div>

        {kind === "certificate" && (
          <div className="pform-field">
            <label htmlFor="af-cert">Which certificate</label>
            <select id="af-cert" className="pform-input" value={label} onChange={(e) => setLabel(e.target.value)} disabled={state === "saving"}>
              <option value="">Select…</option>
              {certificateNames.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        )}

        {kind === "other" && (
          <div className="pform-field">
            <label htmlFor="af-label">What is it? (optional)</label>
            <input id="af-label" className="pform-input" value={label} maxLength={80} onChange={(e) => setLabel(e.target.value)} disabled={state === "saving"} />
          </div>
        )}
      </div>

      <div className="file-slot">
        {file ? (
          <span className="file-slot__chosen">
            <span className="file-slot__name">{file.name}</span>
            <span className="pform-hint">{formatBytes(file.size)}</span>
            <button type="button" className="pform-link" onClick={() => setFile(null)} disabled={state === "saving"}>
              Remove
            </button>
          </span>
        ) : (
          <label
            className={`dropzone${over ? " is-over" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setOver(false);
              if (state !== "saving") pick(e.dataTransfer.files?.[0] || null);
            }}
          >
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 16V4M7 9l5-5 5 5M5 20h14" />
            </svg>
            <span>
              <strong>Choose a file</strong> or drop it here
            </span>
            <span className="pform-hint">PDF, JPEG or PNG, up to 10 MB</span>
            <input
              type="file"
              className="sr-only"
              accept={FILE_ACCEPT}
              disabled={state === "saving"}
              onChange={(e) => {
                const f = e.target.files?.[0] || null;
                e.target.value = "";
                pick(f);
              }}
            />
          </label>
        )}
      </div>

      {message && <p className={isError ? "error-text" : "pform-rec"}>{message}</p>}

      <div className="pform-actions">
        <button type="submit" className="btn btn-primary btn-sm" disabled={state === "saving" || !file}>
          {state === "saving" ? "Uploading…" : "Add file"}
        </button>
      </div>
    </form>
  );
}
