"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  FIELD_LABELS,
  addDaysISO,
  isValidISODate,
  recommendedDays,
  validatePermitInput,
} from "../../lib/permitRules";

// The permit form: the web version of typing one row in the Excel log.
// Dropdown values come from the permit_options table.

function emptyValues() {
  return {
    reference: "",
    area: "",
    location: "",
    permitType: "",
    jobDescription: "",
    certificates: [],
    certificateNo: "NA",
    applicant: "",
    holder: "",
    issuer: "",
    areaAuthority: "NA",
    controller: "",
    validFrom: "",
    validTo: "",
  };
}

function prettyDate(iso) {
  if (!isValidISODate(iso)) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

// Defined outside PermitForm on purpose: components defined inside another
// component are rebuilt on every keystroke and the field loses focus.
function Field({ name, label, required, wide, hint, error, children }) {
  return (
    <div className={`pform-field${wide ? " pform-field--wide" : ""}`}>
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

export default function PermitForm({ options, existingRefs = [] }) {
  const [values, setValues] = useState(emptyValues);
  const [errors, setErrors] = useState({});
  const [state, setState] = useState("idle"); // idle | saving | error | saved
  const [message, setMessage] = useState("");
  const [savedRefs, setSavedRefs] = useState([]);
  const [lastSaved, setLastSaved] = useState("");

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
    setValues((v) => {
      const has = v.certificates.includes(name);
      let next;
      if (has) next = v.certificates.filter((c) => c !== name);
      else if (name.toUpperCase() === "NA") next = [name]; // "NA" means none
      else next = [...v.certificates.filter((c) => c.toUpperCase() !== "NA"), name];
      return { ...v, certificates: next };
    });
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
      items={options[listKey] || []}
      disabled={disabled}
    />
  );

  // Same suggestion as the Excel calendar; only a suggestion.
  const suggestion = useMemo(() => {
    const rec = recommendedDays(values.permitType);
    if (!rec || !isValidISODate(values.validFrom)) return null;
    return { date: addDaysISO(values.validFrom, rec.days), label: rec.label };
  }, [values.permitType, values.validFrom]);

  const refTaken = values.reference.trim() !== "" && taken.has(values.reference.trim().toUpperCase());

  async function handleSubmit(e) {
    e.preventDefault();
    if (state === "saving") return;

    const { errors: found } = validatePermitInput(values, { mode: "create" });
    if (refTaken) found.reference = "This permit number is already used.";
    if (Object.keys(found).length > 0) {
      setErrors(found);
      setState("error");
      setMessage("Please fix the marked fields.");
      return;
    }

    setState("saving");
    setMessage("");
    try {
      const res = await fetch("/api/permits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrors(data.fields || {});
        setState("error");
        setMessage(data.error || "The permit could not be saved.");
        return;
      }
      const ref = values.reference.trim();
      setSavedRefs((r) => [...r, ref]);
      setLastSaved(ref);
      setValues(emptyValues());
      setErrors({});
      setState("saved");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setState("error");
      setMessage("Network error. Check your connection and try again.");
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="pform">
      {state === "saved" && (
        <div className="notice notice--ok">
          Permit <strong className="mono">{lastSaved}</strong> saved.{" "}
          <Link href="/permits">See the permit list</Link>, or fill in the next one below.
        </div>
      )}

      <div className="panel pform-card">
        <h3 className="pform-title">Permit</h3>
        <div className="pform-grid">
          <Field name="reference" label="Permit control reference number" required error={errors.reference}>
            <input
              id="pf-reference"
              className="pform-input mono"
              value={values.reference}
              onChange={(e) => set("reference", e.target.value)}
              disabled={disabled}
              maxLength={40}
              autoComplete="off"
            />
            {refTaken && !errors.reference && <p className="pform-error">This permit number is already used.</p>}
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
          <Field name="jobDescription" label="Job description" required wide error={errors.jobDescription}>
            <textarea
              id="pf-jobDescription"
              className="pform-input"
              rows={3}
              value={values.jobDescription}
              onChange={(e) => set("jobDescription", e.target.value)}
              disabled={disabled}
              maxLength={1000}
            />
          </Field>
        </div>
      </div>

      <div className="panel pform-card">
        <h3 className="pform-title">Validity</h3>
        <div className="pform-grid">
          <Field name="validFrom" label="Valid from" required error={errors.validFrom}>
            <input
              id="pf-validFrom"
              type="date"
              className="pform-input"
              value={values.validFrom}
              onChange={(e) => set("validFrom", e.target.value)}
              disabled={disabled}
            />
          </Field>
          <Field name="validTo" label="Valid to (expiry)" required error={errors.validTo}>
            <input
              id="pf-validTo"
              type="date"
              className="pform-input"
              value={values.validTo}
              min={isValidISODate(values.validFrom) ? values.validFrom : undefined}
              onChange={(e) => set("validTo", e.target.value)}
              disabled={disabled}
            />
            {suggestion && values.validTo !== suggestion.date && (
              <p className="pform-hint">
                Suggested: {prettyDate(suggestion.date)} ({suggestion.label}){" "}
                <button type="button" className="pform-link" onClick={() => set("validTo", suggestion.date)} disabled={disabled}>
                  Use it
                </button>
              </p>
            )}
          </Field>
        </div>
      </div>

      <div className="panel pform-card">
        <h3 className="pform-title">Certificates</h3>
        <div className="pform-grid">
          <div className="pform-field pform-field--wide">
            <span className="pform-label">Associated certificates</span>
            <div className="pform-checks">
              {(options.certificate || []).map((name) => (
                <label key={name} className="pform-check">
                  <input
                    type="checkbox"
                    checked={values.certificates.includes(name)}
                    onChange={() => toggleCertificate(name)}
                    disabled={disabled}
                  />
                  {name}
                </label>
              ))}
            </div>
            <p className="pform-hint">Tick every certificate this permit needs, or NA if none.</p>
          </div>
          <Field name="certificateNo" label="Certificate no." error={errors.certificateNo}>
            <input
              id="pf-certificateNo"
              className="pform-input"
              value={values.certificateNo}
              onChange={(e) => set("certificateNo", e.target.value)}
              disabled={disabled}
              maxLength={200}
            />
          </Field>
        </div>
      </div>

      <div className="panel pform-card">
        <h3 className="pform-title">People</h3>
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

      {state === "error" && message && <p className="error-text">{message}</p>}

      <div className="pform-actions">
        <button type="submit" className="btn btn-primary" disabled={disabled}>
          {state === "saving" ? "Saving…" : "Save permit"}
        </button>
        <Link href="/permits" className="btn">
          Cancel
        </Link>
      </div>
    </form>
  );
}
