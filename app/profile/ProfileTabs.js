import Link from "next/link";
import Icon from "../components/Icon";

const TABS = [
  { id: "overview", label: "Overview", icon: "users", href: "/profile" },
  { id: "security", label: "Security", icon: "lock", href: "/profile?tab=security" },
  { id: "preferences", label: "Preferences", icon: "layers", href: "/profile?tab=preferences" },
];

// Tabs are plain links (the tab lives in the address), so the Back button and
// shared links work and nothing is loaded for tabs that are not open.
export default function ProfileTabs({ active }) {
  return (
    <nav className="pf-tabs" aria-label="Profile sections">
      {TABS.map((t) => (
        <Link
          key={t.id}
          prefetch={false}
          scroll={false}
          href={t.href}
          className="pf-tab"
          aria-current={active === t.id ? "page" : undefined}
        >
          <Icon name={t.icon} size={15} />
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
