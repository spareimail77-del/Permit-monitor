import { createAdminClient } from "../../../lib/supabase/admin";
import { getViewerStrict } from "../../../lib/viewer";
import { hashToken, linkState, looksLikeToken } from "../../../lib/guestLinks";
import StartGuest from "./StartGuest";

export const dynamic = "force-dynamic";
// Keep the secret link out of search engines and out of any Referer header.
export const metadata = { title: "HSE Permits: guest view", robots: { index: false, follow: false }, referrer: "no-referrer" };

const NOTE = {
  revoked: ["This link was cancelled", "Please ask for a new one."],
  never_opened: ["This link has expired", "It was not opened in time. Please ask for a new one."],
  active: ["This link was already used", "A guest view has been started with it. Please ask for a new link if you need another."],
  ended: ["This link was already used", "Its guest view has ended. Please ask for a new link if you need another."],
};

function Card({ title, children }) {
  return (
    <div className="guest-card panel">
      <h1 className="guest-card__title">{title}</h1>
      {children}
    </div>
  );
}

export default async function GuestLinkPage({ params }) {
  const token = params.token;
  if (!looksLikeToken(token)) return <Card title="This link is not valid"><p className="guest-card__text">Please check that you copied the whole link, or ask for a new one.</p></Card>;

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return <Card title="Guest links are not available"><p className="guest-card__text">This site is not set up for guest links yet.</p></Card>;
  }

  const { data: link } = await admin
    .from("guest_links")
    .select("label, link_valid_until, session_minutes, opened_at, expires_at, revoked_at")
    .eq("token_hash", hashToken(token))
    .maybeSingle();
  if (!link) return <Card title="This link is not valid"><p className="guest-card__text">Please check that you copied the whole link, or ask for a new one.</p></Card>;

  const state = linkState(link);
  if (state !== "not_opened") {
    const [title, text] = NOTE[state];
    return <Card title={title}><p className="guest-card__text">{text}</p></Card>;
  }

  // Someone who is signed in as a staff member would lose their own session by starting a guest view.
  const viewer = await getViewerStrict();
  if (viewer && !viewer.isGuest) {
    return (
      <Card title="You are signed in">
        <p className="guest-card__text">
          Open this link in a private (incognito) window to see what a guest sees. Starting it here would sign you out.
        </p>
      </Card>
    );
  }

  const minutes = link.session_minutes;
  const length = minutes >= 60 ? `${minutes / 60} hour${minutes === 60 ? "" : "s"}` : `${minutes} minutes`;
  return (
    <Card title="HSE Permits: guest view">
      <p className="guest-card__text">
        You have been invited to look around the SWWS Salalah permit register. It is <strong>read only</strong>: you can see permits, but you cannot change anything.
      </p>
      <p className="guest-card__text">
        The view lasts <strong>{length}</strong> from the moment you press the button, and this link can be used <strong>only once</strong>.
      </p>
      <StartGuest token={token} />
    </Card>
  );
}
