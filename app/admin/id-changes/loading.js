import Skeleton, { SkeletonPage, SkeletonRows } from "../../components/Skeleton";

export default function Loading() {
  return (
    <SkeletonPage maxWidth={840}>
      <Skeleton width={160} style={{ marginBottom: 10 }} />
      <Skeleton variant="block" width={200} height={26} style={{ marginBottom: 18 }} />
      <SkeletonRows count={4} />
    </SkeletonPage>
  );
}
