import Skeleton, { SkeletonPage, SkeletonRows } from "../../components/Skeleton";

export default function Loading() {
  return (
    <SkeletonPage maxWidth={960}>
      <Skeleton width={140} style={{ marginBottom: 10 }} />
      <Skeleton variant="block" width={180} height={26} style={{ marginBottom: 18 }} />
      <SkeletonRows count={7} />
    </SkeletonPage>
  );
}
