import Link from "next/link";
import Icon from "./Icon";

export default function StatCard({ label, value, color, icon, href, hero, urgent, hint }) {
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
        {hint && <p className="stat-card__hint">{hint}</p>}
      </div>
    </>
  );

  const className = `stat-card${hero ? " stat-card--hero" : ""}${urgent ? " stat-card--urgent" : ""}`;

  if (href) {
    return (
      <Link prefetch={false} href={href} className={className}>
        {content}
      </Link>
    );
  }

  return <div className={className}>{content}</div>;
}
