import Link from "next/link";

const LINKS = [
  ["/", "Today"],
  ["/review", "Review"],
  ["/calendar", "Calendar"],
  ["/follow-ups", "Follow-ups"],
  ["/contributions", "Member contributions"],
  ["/learning", "Learning"],
  ["/knowledge", "Knowledge"],
  ["/settings", "Settings"],
];

export function AppShell({
  mode,
  paused,
  children,
}: {
  mode: string;
  paused: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="shell">
      <aside>
        <p className="brand-kicker">SMACKIN’ VIP</p>
        <p className="brand">Community ops</p>
        <p className="mode">
          Mode <strong>{mode.replaceAll("_", " ")}</strong>
          {paused ? <span className="paused">Publication paused</span> : null}
        </p>
        <nav>
          {LINKS.map(([href, label]) => (
            <Link key={href} href={href}>
              {label}
            </Link>
          ))}
        </nav>
        <p className="aside-note">
          The assistant is not Cole. Drafts stay drafts until a person posts them and pastes the group link.
        </p>
      </aside>
      <div className="main">{children}</div>
    </div>
  );
}
