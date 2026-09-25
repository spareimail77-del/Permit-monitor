import Link from "next/link";
import Icon from "./Icon";

export default function StatCard({ label, value, color, icon, href, hero }) {
  const iconColor = color || "var(--color-brand-2)";
  const content = (
    <>
      <span
        className="stat-card__icon"
        style={{
          background: color ? `color-mix(in srgb, ${color} 16%, transparent)` : "var(--color-brand-tint)",
          color: iconColor,
        }}
      >
        <Icon name={icon || "layers"} />
      </span>
      <div>
        <p className="stat-card__value">{value}</p>
        <p className="stat-card__label">{label}</p>
      </div>
    </>
  );

  const className = `stat-card${hero ? " stat-card--hero" : ""}`;

  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }

  return <div className={className}>{content}</div>;
}
