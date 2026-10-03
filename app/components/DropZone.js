"use client";

import { useEffect, useRef, useState } from "react";
import Icon from "./Icon";
import { formatSize } from "../../lib/format";

// A drop-zone file field: drag a file onto it, or click / press Enter or
// Space to open the file explorer. Used by the Excel upload and by permit
// attachments. It only picks the file; the page that uses it still does
// the uploading.
//
//   file       the chosen File (or null) - kept by the page
//   onFile     called with the new File, or with null when removed
//   accept     allowed extensions, e.g. ".xlsm,.xlsx"
//   typeError  message shown when the extension is not allowed
//   validate   optional: (file) => error text, or null when fine (size etc.)
//   hint       small line under the title, e.g. "PDF or JPEG, up to 10 MB"

function extOf(name) {
  const s = String(name || "");
  const i = s.lastIndexOf(".");
  return i < 0 ? "" : s.slice(i).toLowerCase();
}

export default function DropZone({
  file,
  onFile,
  accept,
  typeError,
  validate,
  hint,
  disabled = false,
}) {
  const inputRef = useRef(null);
  const depth = useRef(0); // drag enter/leave fire for child elements too
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");

  const allowed = accept
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  // When the page clears the file (e.g. after a successful upload),
  // make sure the hidden input forgets it too.
  useEffect(() => {
    if (!file && inputRef.current) inputRef.current.value = "";
  }, [file]);

  function pick(f) {
    if (!f) return;
    if (!allowed.includes(extOf(f.name))) {
      setError(typeError || "That file type is not allowed.");
      return;
    }
    const problem = validate ? validate(f) : null;
    if (problem) {
      setError(problem);
      return;
    }
    setError("");
    onFile(f);
  }

  function openPicker() {
    if (!disabled && inputRef.current) inputRef.current.click();
  }

  function onChange(e) {
    pick(e.target.files?.[0] ?? null);
    // Reset so choosing the same file again still counts as a change.
    e.target.value = "";
  }

  function onDragEnter(e) {
    e.preventDefault();
    if (disabled) return;
    depth.current += 1;
    setDragging(true);
  }
  function onDragOver(e) {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = disabled ? "none" : "copy";
  }
  function onDragLeave(e) {
    e.preventDefault();
    depth.current = Math.max(0, depth.current - 1);
    if (depth.current === 0) setDragging(false);
  }
  function onDrop(e) {
    e.preventDefault();
    depth.current = 0;
    setDragging(false);
    if (disabled) return;
    const files = e.dataTransfer?.files;
    if (!files || files.length === 0) return;
    if (files.length > 1) {
      setError("Please drop one file at a time.");
      return;
    }
    pick(files[0]);
  }

  function onKeyDown(e) {
    if (e.target !== e.currentTarget) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openPicker();
    }
  }

  const classes = [
    "dz",
    dragging ? "dz--over" : "",
    error ? "dz--error" : "",
    file ? "dz--filled" : "",
    disabled ? "dz--disabled" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const dragProps = { onDragEnter, onDragOver, onDragLeave, onDrop };

  return (
    <div className="dz-wrap">
      {file ? (
        <div className={classes} {...dragProps}>
          <span className="dz-icon">
            <Icon name="file" size={20} />
          </span>
          <span className="dz-file" aria-live="polite">
            <span className="dz-file-name">{file.name}</span>
            <span className="dz-file-size">{formatSize(file.size)}</span>
          </span>
          <span className="dz-actions">
            <button
              type="button"
              className="btn btn-ghost dz-btn"
              onClick={openPicker}
              disabled={disabled}
            >
              Replace
            </button>
            <button
              type="button"
              className="btn btn-ghost dz-btn"
              onClick={() => {
                setError("");
                onFile(null);
              }}
              disabled={disabled}
            >
              <Icon name="x" size={14} /> Remove
            </button>
          </span>
        </div>
      ) : (
        <div
          className={classes}
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-disabled={disabled}
          aria-label={`Choose a file. ${hint || ""}`}
          onClick={openPicker}
          onKeyDown={onKeyDown}
          {...dragProps}
        >
          <span className="dz-icon">
            <Icon name="upload" size={22} />
          </span>
          <span className="dz-title">
            <span className="dz-title-desktop">
              Drag a file here, or <u>click to browse</u>
            </span>
            <span className="dz-title-touch">Tap to choose a file</span>
          </span>
          {hint && <span className="dz-hint">{hint}</span>}
        </div>
      )}

      {error && (
        <p className="error-text dz-error" role="alert">
          {error}
        </p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="dz-input"
        tabIndex={-1}
        aria-hidden="true"
        disabled={disabled}
        onChange={onChange}
      />
    </div>
  );
}
