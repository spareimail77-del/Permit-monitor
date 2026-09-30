import { buildCertificateRows } from "../../lib/certificates";

// Renders a permit's certificates one per line, with each certificate's
// number beside it when the two lists match up.
export default function CertificateList({ certificates, certificateNo }) {
  const { names, numbers, paired, rows } = buildCertificateRows(
    certificates,
    certificateNo
  );

  if (names.length === 0 && numbers.length === 0) {
    return <p className="cert-empty">No certificates on file</p>;
  }

  if (paired) {
    return (
      <div className="cert-block">
        <div className="cert-count">
          {rows.length} certificate{rows.length === 1 ? "" : "s"}
        </div>
        <ul className="cert-list">
          {rows.map((r, i) => (
            <li key={i} className="cert-row">
              <span className="cert-name">{r.name}</span>
              <span className="cert-no mono">{r.number}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  // Counts differ (or one side is empty): show both lists honestly.
  return (
    <div className="cert-block">
      <div className="cert-unpaired-grid">
        <div>
          <div className="cert-sub">Associated Certificates</div>
          {names.length ? (
            <ul className="cert-plain">
              {names.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          ) : (
            <p className="cert-empty">—</p>
          )}
        </div>
        <div>
          <div className="cert-sub">Certificate No.</div>
          {numbers.length ? (
            <ul className="cert-plain mono">
              {numbers.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          ) : (
            <p className="cert-empty">—</p>
          )}
        </div>
      </div>
      {names.length > 0 && numbers.length > 0 && (
        <p className="cert-note">
          {names.length} certificate{names.length === 1 ? "" : "s"} but{" "}
          {numbers.length} number{numbers.length === 1 ? "" : "s"} in the
          workbook, so they can't be matched up automatically. Check the
          Excel file.
        </p>
      )}
    </div>
  );
}
