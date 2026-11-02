export const metadata = { title: "HSE Permits: guest view ended", robots: { index: false, follow: false } };

// Shown when a guest's time is over, or when Root ended the guest view.
export default function GuestEndedPage() {
  return (
    <div className="guest-card panel">
      <h1 className="guest-card__title">The guest view has ended</h1>
      <p className="guest-card__text">Thank you for looking around. If you need to see more, please ask for a new link.</p>
    </div>
  );
}
