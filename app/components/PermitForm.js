"use client";

import { editImageFile } from "../../lib/editImage";
import DatePicker from "./DatePicker";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FIELD_LABELS,
  certNumberKey,
  isNA,
  STATUSES,
  STATUS_LABELS,
  isValidISODate,
  latestValidTo,
  prettyDate,
  validToProblem,
  validatePermitInput,
  validateStatusInput,
} from "../../lib/permitRules";
import { fileProblem, formatBytes } from "../../lib/fileRules";
import { uploadPermitFiles } from "../../lib/uploadFiles";

// The permit form: the web version of typing one row in the Excel log.
// Dropdown values come from the permit_options table.

function emptyValues() {
  return {
    reference: "",
    area: "",
    location: "",
    permitType: "",
    jobDescription: "",
    applicant: "",
    holder: "",
    issuer: "",
    areaAuthority: "NA",
    controller: "",
    validFrom: "",
    validTo: "",
  };
}

const FILE_ACCEPT = ".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png";

// Defined outside PermitForm on purpose: components defined inside another
// component are rebuilt on every keystroke and the field loses focus.
function Field({ name, label, required, wide, span2, hint, error, children }) {
  return (
    <div className={`pform-field${wide ? " pform-field--wide" : ""}${span2 ? " pform-field--span2" : ""}`}>
      <label htmlFor={`pf-${name}`}>
        {label}
        {required && <span className="pform-req"> *</span>}
      </label>
      {children}
      {hint && !error && <p className="pform-hint">{hint}</p>}
      {error && <p className="pform-error">{error}</p>}
    </div>
  );
}

function Dropdown({ name, label, required, hint, error, value, onChange, items, disabled }) {
  return (
    <Field name={name} label={label} required={required} hint={hint} error={error}>
      <select
        id={`pf-${name}`}
        className="pform-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      >
        <option value="">Select…</option>
        {items.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </Field>
  );
}

// A hidden or removed dropdown value must still show on a permit that uses it.
function withCurrent(items, current) {
  return current && !items.includes(current) ? [...items, current] : items;
}

// One optional file: choose, see its name and size, remove.
function FileSlot({ label, file, error, disabled, onPick, onClear }) {
  return (
    <div className="file-slot">
      <span className="file-slot__label">{label}</span>
      {file ? (
        <span className="file-slot__chosen">
          <span className="file-slot__name">{file.name}</span>
          <span className="pform-hint">{formatBytes(file.size)}</span>
          <button type="button" className="pform-link" onClick={onClear} disabled={disabled}>
            Remove
          </button>
        </span>
      ) : (
        <input
          type="file"
          accept={FILE_ACCEPT}
          disabled={disabled}
          onChange={(e) => {
            const f = e.target.files?.[0] || null;
            e.target.value = "";
            if (f) onPick(f);
          }}
        />
      )}
      {error && <p className="pform-error">{error}</p>}
    </div>
  );
}

// mode "new": the add form. mode "edit": changes a saved permit. In edit mode the
// permit number is locked, files are handled on the permit page, and there is a
// Status section. `initial` = { values, certs, certNumbers, status, cancelReason }.
export default function PermitForm({ options, existingRefs = [], mode = "new", permitId = null, initial = null }) {
  const router = useRouter();
  const isEdit = mode === "edit";
  const [values, setValues] = useState(() => initial?.values || emptyValues());
  const [status, setStatus] = useState(initial?.status || "OPEN");
  const [cancelReason, setCancelReason] = useState(initial?.cancelReason || "");
  const [certs, setCerts] = useState(() => initial?.certs || []); // ticked certificate names
  const [certNumbers, setCertNumbers] = useState(() => initial?.certNumbers || {}); // name -> number
  const [certFiles, setCertFiles] = useState({}); // name -> File
  const [permitCopy, setPermitCopy] = useState(null);
  const [jsa, setJsa] = useState(null);
  const [showJsa, setShowJsa] = useState(false); // JSA is optional: hidden until asked for
  const [others, setOthers] = useState([]); // [{ key, label, file }]
  const [fileErrors, setFileErrors] = useState({}); // slot -> message
  const [errors, setErrors] = useState({});
  const [state, setState] = useState("idle"); // idle | saving | error | saved
  const [message, setMessage] = useState("");
  const [result, setResult] = useState(null); // { ref, id, saved, failed }
  const [savedRefs, setSavedRefs] = useState([]);

  const taken = useMemo(
    () => new Set([...existingRefs, ...savedRefs].map((r) => String(r).trim().toUpperCase())),
    [existingRefs, savedRefs]
  );

  const disabled = state === "saving";

  function set(field, value) {
    setValues((v) => ({ ...v, [field]: value }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
    if (state === "saved") setState("idle");
  }

  function toggleCertificate(name) {
    setErrors((e) => ({ ...e, certificates: undefined }));
    setCerts((list) => {
      if (list.includes(name)) return list.filter((c) => c !== name);
      if (isNA(name)) return [name]; // NA means none: it replaces the others
      return [...list.filter((c) => !isNA(c)), name];
    });
  }

  async function pickFile(slot, picked, apply) {
    // Photos open the crop and compress editor first; PDFs go straight through.
    const file = await editImageFile(picked);
    if (!file) return; // cancelled in the editor
    const problem = fileProblem(file);
    setFileErrors((e) => ({ ...e, [slot]: problem || undefined }));
    if (!problem) apply(file);
  }

  const dd = (name, listKey, extra = {}) => (
    <Dropdown
      name={name}
      label={extra.label || FIELD_LABELS[name]}
      required={extra.required}
      hint={extra.hint}
      error={errors[name]}
      value={values[name]}
      onChange={(v) => set(name, v)}
      items={withCurrent(options[listKey] || [], values[name])}
      disabled={disabled}
    />
  );

  // The latest allowed "Valid to" (Blanket 30 days, COLD 14, HOT 7 after "Valid from").
  const latest = useMemo(
    () => latestValidTo(values.permitType, values.validFrom),
    [values.permitType, values.validFrom]
  );
  const toProblem = validToProblem(values.permitType, values.validFrom, values.validTo);

  const refTaken = !isEdit && values.reference.trim() !== "" && taken.has(values.reference.trim().toUpperCase());

  function buildPayload() {
    return {
      ...values,
      certificates: certs.map((name) => ({
        name,
        number: isNA(name) ? "NA" : certNumbers[name] || "",
      })),
    };
  }

  function resetAll() {
    setValues(emptyValues());
    setCerts([]);
    setCertNumbers({});
    setCertFiles({});
    setPermitCopy(null);
    setJsa(null);
    setShowJsa(false);
    setOthers([]);
    setFileErrors({});
    setErrors({});
  }

  function collectFileItems() {
    const items = [];
    if (permitCopy) items.push({ file: permitCopy, kind: "permit_copy", label: "" });
    if (showJsa && jsa) items.push({ file: jsa, kind: "jsa", label: "" });
    for (const name of certs) {
      if (!isNA(name) && certFiles[name]) items.push({ file: certFiles[name], kind: "certificate", label: name });
    }
    for (const o of others) {
      if (o.file) items.push({ file: o.file, kind: "other", label: o.label.trim() });
    }
    return items;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (state === "saving") return;

    const payload = buildPayload();
    const { errors: found } = validatePermitInput(payload);
    if (refTaken) found.reference = "This permit number is already used (it may be in the trash).";
    if (isEdit) Object.assign(found, validateStatusInput(status, cancelReason).errors);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      setState("error");
      setMessage("Please fix the marked fields.");
      return;
    }

    setState("saving");
    setMessage("");
    if (isEdit) {
      try {
        const res = await fetch(`/api/permits/${permitId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, action: "edit", status, cancelReason }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setErrors(data.fields || {});
          setState("error");
          setMessage(data.error || "The permit could not be saved.");
          return;
        }
        const items = collectFileItems();
        if (items.length) {
          const upload = await uploadPermitFiles(permitId, items);
          if (upload.failed.length) {
            setState("error");
            setMessage(
              `Permit saved, but these files could not be added: ${upload.failed.map((f) => f.name).join(", ")}. Choose them again and press Save changes.`
            );
            // Keep only the files that failed so a retry does not upload the others twice.
            const failedNames = new Set(upload.failed.map((f) => f.name));
            setPermitCopy((f) => (f && failedNames.has(f.name) ? f : null));
            setJsa((f) => (f && failedNames.has(f.name) ? f : null));
            setCertFiles((c) => Object.fromEntries(Object.entries(c).filter(([, f]) => f && failedNames.has(f.name))));
            setOthers((list) => list.filter((o) => o.file && failedNames.has(o.file.name)));
            return;
          }
        }
        router.push(`/permits/${permitId}`);
        router.refresh();
      } catch {
        setState("error");
        setMessage("Network error. Check your connection and try again.");
      }
      return;
    }
    try {
      const res = await fetch("/api/permits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrors(data.fields || {});
        setState("error");
        setMessage(data.error || "The permit could not be saved.");
        return;
      }

      // The permit is saved. Now the optional files.
      const ref = values.reference.trim();
      const items = collectFileItems();
      const upload = items.length ? await uploadPermitFiles(data.id, items) : { saved: 0, failed: [] };

      setSavedRefs((r) => [...r, ref]);
      setResult({ ref, id: data.id, saved: upload.saved, failed: upload.failed });
      resetAll();
      setState("saved");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setState("error");
      setMessage("Network error. Check your connection and try again.");
    }
  }

  const certOptions = certs.reduce((list, c) => (list.includes(c) ? list : [...list, c]), options.certificate || []);

  return (
    <form onSubmit={handleSubmit} noValidate className="pform">
      {state === "saved" && result && (
        <div className={`notice ${result.failed.length ? "" : "notice--ok"}`}>
          Permit <strong className="mono">{result.ref}</strong> saved
          {result.saved > 0 && ` with ${result.saved} file${result.saved === 1 ? "" : "s"}`}.{" "}
          {result.failed.length > 0 && (
            <>
              These files could not be added: {result.failed.map((f) => f.name).join(", ")}. Open the permit to
              add them again.{" "}
            </>
          )}
          <Link href={`/permits/${result.id}`}>Open the permit</Link> · <Link href="/permits">Permit list</Link>. You
          can fill in the next permit below.
        </div>
      )}

      <div className="panel pform-card">
        <h2 className="pform-title">Permit</h2>
        <div className="pform-grid pform-grid--permit">
          <Field name="reference" label="Permit control reference number" required error={errors.reference}>
            <input
              id="pf-reference"
              className="pform-input mono"
              value={values.reference}
              onChange={(e) => set("reference", e.target.value)}
              disabled={disabled || isEdit}
              maxLength={40}
              autoComplete="off"
            />
            {isEdit && <p className="pform-hint">The permit number cannot be changed after saving.</p>}
            {refTaken && !errors.reference && <p className="pform-error">This permit number is already used (it may be in the trash).</p>}
          </Field>
          {dd("area", "area", { required: true })}
          <Field name="location" label="Location" required error={errors.location}>
            <input
              id="pf-location"
              className="pform-input"
              value={values.location}
              onChange={(e) => set("location", e.target.value)}
              disabled={disabled}
              maxLength={200}
            />
          </Field>
          {dd("permitType", "permit_type", { label: "Type of permit", required: true })}
          <Field name="validFrom" label="Valid from" required error={errors.validFrom}>
            <DatePicker
              id="pf-validFrom"
              ariaLabel="Valid from"
              value={values.validFrom}
              onChange={(v) => set("validFrom", v)}
              invalid={Boolean(errors.validFrom)}
              disabled={disabled}
            />
          </Field>
          <Field name="validTo" label="Valid to (expiry)" required error={errors.validTo || toProblem}>
            <DatePicker
              id="pf-validTo"
              ariaLabel="Valid to"
              value={values.validTo}
              onChange={(v) => set("validTo", v)}
              min={isValidISODate(values.validFrom) ? values.validFrom : undefined}
              max={latest ? latest.date : undefined}
              rangeFrom={isValidISODate(values.validFrom) ? values.validFrom : undefined}
              shortcuts={latest ? [{ label: `Latest allowed (${latest.date.split("-").reverse().join("-")})`, value: latest.date }] : []}
              invalid={Boolean(errors.validTo || toProblem)}
              disabled={disabled}
            />
            {latest && (
              <p className="pform-rec">
                Latest: {prettyDate(latest.date)} · {latest.days} days{" "}
                {values.validTo !== latest.date && (
                  <button type="button" className="pform-link pform-link--green" onClick={() => set("validTo", latest.date)} disabled={disabled}>
                    Use it
                  </button>
                )}
              </p>
            )}
            {!latest && values.permitType && (
              <p className="pform-hint">No time limit is set for this type of permit.</p>
            )}
          </Field>
          <Field name="jobDescription" label="Job description" required span2 error={errors.jobDescription}>
            <textarea
              id="pf-jobDescription"
              className="pform-input"
              rows={2}
              value={values.jobDescription}
              onChange={(e) => set("jobDescription", e.target.value)}
              disabled={disabled}
              maxLength={1000}
            />
          </Field>
        </div>
      </div>

      <div className="panel pform-card">
        <h2 className="pform-title">Certificates</h2>
        <div className="pform-grid">
          <div className="pform-field pform-field--wide">
            <span className="pform-label">
              Associated certificates<span className="pform-req"> *</span>
            </span>
            <div className="pform-checks">
              {certOptions.map((name) => (
                <label key={name} className="pform-check">
                  <input
                    type="checkbox"
                    checked={certs.includes(name)}
                    onChange={() => toggleCertificate(name)}
                    disabled={disabled}
                  />
                  {name}
                </label>
              ))}
            </div>
            {errors.certificates ? (
              <p className="pform-error">{errors.certificates}</p>
            ) : (
              <p className="pform-hint">Tick every certificate this permit needs, or NA if none. Each one needs its own number.</p>
            )}
          </div>

          {certs.map((name) =>
            isNA(name) ? (
              <div key={name} className="pform-field pform-field--wide">
                <p className="pform-hint">No certificate: the certificate number is saved as NA.</p>
              </div>
            ) : (
              <div key={name} className="pform-field pform-field--wide cert-row">
                <label htmlFor={`pf-cert-${name}`}>
                  {name} — certificate no.<span className="pform-req"> *</span>
                </label>
                <input
                  id={`pf-cert-${name}`}
                  className="pform-input"
                  value={certNumbers[name] || ""}
                  onChange={(e) => {
                    setCertNumbers((n) => ({ ...n, [name]: e.target.value }));
                    if (errors[certNumberKey(name)]) setErrors((x) => ({ ...x, [certNumberKey(name)]: undefined }));
                  }}
                  disabled={disabled}
                  maxLength={60}
                />
                {errors[certNumberKey(name)] && <p className="pform-error">{errors[certNumberKey(name)]}</p>}
                <FileSlot
                  label={`Copy of the ${name} certificate (optional)`}
                  file={certFiles[name]}
                  error={fileErrors[`cert:${name}`]}
                  disabled={disabled}
                  onPick={(f) => pickFile(`cert:${name}`, f, (file) => setCertFiles((c) => ({ ...c, [name]: file })))}
                  onClear={() => setCertFiles((c) => ({ ...c, [name]: undefined }))}
                />
              </div>
            )
          )}
        </div>
      </div>

      <div className="panel pform-card">
        <h2 className="pform-title">People</h2>
        <div className="pform-grid">
          {dd("applicant", "applicant", { label: "Permit applicant", required: true })}
          {dd("holder", "holder", { label: "Permit holder", hint: "Can be filled in later." })}
          {dd("issuer", "issuer", { label: "Authorized permit issuer" })}
          <Field name="areaAuthority" label="Area authority (if applicable)" error={errors.areaAuthority}>
            <input
              id="pf-areaAuthority"
              className="pform-input"
              value={values.areaAuthority}
              onChange={(e) => set("areaAuthority", e.target.value)}
              disabled={disabled}
              maxLength={120}
            />
          </Field>
          {dd("controller", "controller", { label: "Permit controller", required: true })}
        </div>
      </div>

      {isEdit && (
        <div className="panel pform-card">
          <h2 className="pform-title">Status</h2>
          <div className="pform-grid">
            <Field name="status" label="Status" error={errors.status}>
              <select
                id="pf-status"
                className="pform-input"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setErrors((x) => ({ ...x, status: undefined, cancelReason: undefined }));
                }}
                disabled={disabled}
              >
                {STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {STATUS_LABELS[st]}
                  </option>
                ))}
              </select>
              <p className="pform-hint">
                Closing saves today&apos;s date (Oman time) as the closed date. Overdue and Expiring soon are worked out by
                the site later; they are never chosen here.
              </p>
            </Field>
            {status === "CANCELED" && (
              <Field name="cancelReason" label="Reason for cancelling" required error={errors.cancelReason}>
                <input
                  id="pf-cancelReason"
                  className="pform-input"
                  value={cancelReason}
                  onChange={(e) => {
                    setCancelReason(e.target.value);
                    setErrors((x) => ({ ...x, cancelReason: undefined }));
                  }}
                  disabled={disabled}
                  maxLength={200}
                />
              </Field>
            )}
          </div>
        </div>
      )}

      <div className="panel pform-card">
        <h2 className="pform-title">{isEdit ? "Add documents (optional)" : "Documents (optional)"}</h2>
        <p className="pform-hint mb-3">
          PDF, JPEG or PNG, up to 10 MB each.{" "}
          {isEdit
            ? "Files you choose here are added to the permit when you press Save changes. Existing files stay on the permit page."
            : "You can also add documents later from the permit page."}
        </p>
        <div className="file-grid">
          <FileSlot
            label="Permit copy"
            file={permitCopy}
            error={fileErrors.permitCopy}
            disabled={disabled}
            onPick={(f) => pickFile("permitCopy", f, setPermitCopy)}
            onClear={() => setPermitCopy(null)}
          />
          {showJsa && (
            <div>
              <FileSlot
                label="JSA"
                file={jsa}
                error={fileErrors.jsa}
                disabled={disabled}
                onPick={(f) => pickFile("jsa", f, setJsa)}
                onClear={() => setJsa(null)}
              />
              <button
                type="button"
                className="pform-link"
                disabled={disabled}
                onClick={() => {
                  setShowJsa(false);
                  setJsa(null);
                }}
              >
                Remove JSA
              </button>
            </div>
          )}
        </div>

        {others.map((o) => (
          <div key={o.key} className="other-row">
            <input
              className="pform-input"
              placeholder="What is this document? (e.g. Risk assessment)"
              value={o.label}
              maxLength={80}
              disabled={disabled}
              onChange={(e) =>
                setOthers((list) => list.map((x) => (x.key === o.key ? { ...x, label: e.target.value } : x)))
              }
            />
            <FileSlot
              label="File"
              file={o.file}
              error={fileErrors[`other:${o.key}`]}
              disabled={disabled}
              onPick={(f) =>
                pickFile(`other:${o.key}`, f, (file) =>
                  setOthers((list) => list.map((x) => (x.key === o.key ? { ...x, file } : x)))
                )
              }
              onClear={() => setOthers((list) => list.map((x) => (x.key === o.key ? { ...x, file: null } : x)))}
            />
            <button type="button" className="pform-link" disabled={disabled} onClick={() => setOthers((list) => list.filter((x) => x.key !== o.key))}>
              Remove this row
            </button>
          </div>
        ))}
        <button
          type="button"
          className="btn btn-sm mt-3"
          disabled={disabled}
          onClick={() => setOthers((list) => [...list, { key: crypto.randomUUID(), label: "", file: null }])}
        >
          + Add another document
        </button>
        {!showJsa && (
          <button type="button" className="btn btn-sm mt-3" style={{ marginLeft: 8 }} disabled={disabled} onClick={() => setShowJsa(true)}>
            + Add JSA
          </button>
        )}
      </div>

      {state === "error" && message && <p className="error-text">{message}</p>}

      <div className="pform-actions">
        <button type="submit" className="btn btn-primary" disabled={disabled}>
          {state === "saving" ? "Saving…" : isEdit ? "Save changes" : "Save permit"}
        </button>
        <Link href={isEdit ? `/permits/${permitId}` : "/permits"} className="btn">
          Cancel
        </Link>
      </div>
    </form>
  );
}
