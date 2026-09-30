import Skeleton, { SkeletonPage, SkeletonRows } from "../../components/Skeleton";

export default function Loading() {
  return (
    <SkeletonPage maxWidth={960}>
      <Skeleton width={180} style={{ marginBottom: 10 }} />
      <Skeleton variant="block" width={220} height={26} style={{ marginBottom: 18 }} />
      <SkeletonRows count={4} />
    </SkeletonPage>
  );
}
