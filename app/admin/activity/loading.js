import Skeleton, { SkeletonPage, SkeletonPanel, SkeletonLines } from "../../components/Skeleton";

export default function Loading() {
  return (
    <SkeletonPage maxWidth={960}>
      <Skeleton width={120} style={{ marginBottom: 10 }} />
      <Skeleton variant="block" width={170} height={26} style={{ marginBottom: 14 }} />
      <SkeletonLines count={2} lastWidth="70%" />
      <div style={{ height: 18 }} />
      {Array.from({ length: 5 }, (_, i) => (
        <SkeletonPanel key={i} style={{ marginBottom: 10, display: "flex", gap: 14, alignItems: "center" }}>
          <Skeleton variant="block" width={38} height={38} style={{ borderRadius: "50%", flex: "none" }} />
          <div className="skeleton-stack" style={{ flex: 1 }}>
            <Skeleton width="35%" />
            <Skeleton width="55%" />
          </div>
        </SkeletonPanel>
      ))}
    </SkeletonPage>
  );
}
