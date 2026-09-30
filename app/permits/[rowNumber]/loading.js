import Skeleton, { SkeletonPage, SkeletonPanel } from "../../components/Skeleton";

export default function Loading() {
  return (
    <SkeletonPage maxWidth={900}>
      <Skeleton width={150} style={{ marginBottom: 18 }} />
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 18 }}>
        <Skeleton variant="block" width={240} height={28} />
        <Skeleton variant="block" width={80} height={24} style={{ borderRadius: 999 }} />
      </div>
      {[4, 2, 3, 3].map((n, i) => (
        <SkeletonPanel key={i} style={{ marginBottom: 14 }}>
          <Skeleton width={110} style={{ marginBottom: 16 }} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
            {Array.from({ length: n }, (_, j) => (
              <div key={j} className="skeleton-stack">
                <Skeleton width="45%" />
                <Skeleton width="80%" />
              </div>
            ))}
          </div>
        </SkeletonPanel>
      ))}
    </SkeletonPage>
  );
}
