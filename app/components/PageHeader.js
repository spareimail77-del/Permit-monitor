import Link from "next/link";

// The top of every signed-in page: breadcrumbs, one h1 title, an optional line
// under it, and the page's main buttons on the right.
//   crumbs: [{ label, href? }, ...]. The last one is the current page (no link).
//   badge:  something shown right after the title (a status badge).
//   actions: buttons or links for the right-hand side.
export default function PageHeader({ title, sub, crumbs = [], badge, actions }) {
  return (
    <header className="page-head">
      {crumbs.length > 0 && (
        <nav className="crumbs" aria-label="Breadcrumb">
          <ol>
            {crumbs.map((c, i) => (
              <li key={`${i}-${c.label}`}>
                {c.href && i < crumbs.length - 1 ? (
                  <Link href={c.href}>{c.label}</Link>
                ) : (
                  <span aria-current={i === crumbs.length - 1 ? "page" : undefined}>{c.label}</span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      )}
      <div className="page-head__row">
        <div className="page-head__text">
          <div className="page-head__title">
            <h1 className="page-title">{title}</h1>
            {badge}
          </div>
          {sub && <p className="page-sub">{sub}</p>}
        </div>
        {actions && <div className="page-head__actions">{actions}</div>}
      </div>
    </header>
  );
}
