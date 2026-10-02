import Skeleton, { SkeletonPage, SkeletonLines, SkeletonPanel } from "../components/Skeleton";

export default function Loading() {
  return (
    <SkeletonPage maxWidth={980}>
      <SkeletonPanel>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <Skeleton variant="block" width={64} height={64} style={{ borderRadius: "50%" }} />
          <div style={{ flex: 1 }}>
            <SkeletonLines count={2} lastWidth="40%" />
          </div>
        </div>
      </SkeletonPanel>
      <Skeleton variant="block" width={320} height={34} style={{ margin: "16px 0" }} />
      <SkeletonPanel>
        <SkeletonLines count={4} />
      </SkeletonPanel>
    </SkeletonPage>
  );
}
