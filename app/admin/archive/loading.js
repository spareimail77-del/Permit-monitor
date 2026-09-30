import Skeleton, { SkeletonPage, SkeletonRows } from "../../components/Skeleton";

export default function Loading() {
  return (
    <SkeletonPage>
      <Skeleton width={140} style={{ marginBottom: 10 }} />
      <Skeleton variant="block" width={200} height={26} style={{ marginBottom: 16 }} />
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        <Skeleton variant="block" width={150} height={38} />
        <Skeleton variant="block" width={150} height={38} />
        <Skeleton variant="block" width={150} height={38} />
      </div>
      <SkeletonRows count={9} />
    </SkeletonPage>
  );
}
