export default function DetailField({ label, value, mono }) {
  return (
    <div className="detail-field">
      <dt>{label}</dt>
      <dd className={mono ? "mono" : undefined}>
        {value || value === 0 ? value : "—"}
      </dd>
    </div>
  );
}
