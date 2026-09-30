import Skeleton, { SkeletonPage } from "../components/Skeleton";

export default function Loading() {
  return (
    <SkeletonPage maxWidth={960}>
      <Skeleton variant="block" width={120} height={26} style={{ marginBottom: 10 }} />
      <Skeleton width={220} style={{ marginBottom: 22 }} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} variant="block" height={84} style={{ borderRadius: "var(--radius-md)" }} />
        ))}
      </div>
    </SkeletonPage>
  );
}
