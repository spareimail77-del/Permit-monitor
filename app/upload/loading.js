import Skeleton, { SkeletonPage, SkeletonLines, SkeletonPanel, SkeletonRows } from "../components/Skeleton";

export default function Loading() {
  return (
    <SkeletonPage maxWidth={980}>
      <Skeleton variant="block" width={160} height={26} style={{ marginBottom: 16 }} />
      <SkeletonPanel>
        <SkeletonLines count={3} />
        <Skeleton variant="block" height={120} style={{ marginTop: 18, borderRadius: "var(--radius-md)" }} />
      </SkeletonPanel>
      <Skeleton variant="block" width={180} height={22} style={{ margin: "26px 0 12px" }} />
      <SkeletonRows count={5} />
    </SkeletonPage>
  );
}
