import Skeleton, { SkeletonPage, SkeletonLines, SkeletonPanel } from "../components/Skeleton";

export default function Loading() {
  return (
    <SkeletonPage maxWidth={640}>
      <Skeleton variant="block" width={160} height={26} style={{ marginBottom: 18 }} />
      <SkeletonPanel>
        <SkeletonLines count={4} />
      </SkeletonPanel>
      <SkeletonPanel style={{ marginTop: 16 }}>
        <SkeletonLines count={3} />
      </SkeletonPanel>
    </SkeletonPage>
  );
}
