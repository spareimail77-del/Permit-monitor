import Skeleton, { SkeletonPage, SkeletonRows } from "../components/Skeleton";

export default function Loading() {
  return (
    <SkeletonPage>
      <Skeleton width={140} style={{ marginBottom: 14 }} />
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        <Skeleton variant="block" width={220} height={38} />
        <Skeleton variant="block" width={130} height={38} />
        <Skeleton variant="block" width={130} height={38} />
        <Skeleton variant="block" width={130} height={38} />
      </div>
      <SkeletonRows count={10} />
    </SkeletonPage>
  );
}
