import Skeleton, { SkeletonPage, SkeletonLines, SkeletonPanel } from "../components/Skeleton";

export default function Loading() {
  return (
    <SkeletonPage maxWidth={720}>
      <Skeleton variant="block" width={160} height={26} style={{ marginBottom: 16 }} />
      <SkeletonPanel>
        <SkeletonLines count={3} />
        <Skeleton variant="block" height={120} style={{ marginTop: 18, borderRadius: "var(--radius-md)" }} />
      </SkeletonPanel>
    </SkeletonPage>
  );
}
