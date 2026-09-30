import Skeleton, { SkeletonLines, SkeletonPage, SkeletonPanel } from "./components/Skeleton";

export default function Loading() {
  return (
    <SkeletonPage>
      <div className="stat-grid" style={{ marginBottom: 16 }}>
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} variant="card" />
        ))}
      </div>
      <div className="dash-row">
        <SkeletonPanel>
          <Skeleton width="40%" />
          <Skeleton variant="block" width={190} height={190} style={{ borderRadius: "50%", margin: "22px auto 0" }} />
        </SkeletonPanel>
        <SkeletonPanel>
          <Skeleton width="40%" style={{ marginBottom: 16 }} />
          <SkeletonLines count={5} />
        </SkeletonPanel>
      </div>
      <div className="dash-row" style={{ marginTop: 16 }}>
        <SkeletonPanel><Skeleton width="30%" style={{ marginBottom: 16 }} /><SkeletonLines count={5} /></SkeletonPanel>
        <SkeletonPanel><Skeleton width="30%" style={{ marginBottom: 16 }} /><SkeletonLines count={5} /></SkeletonPanel>
      </div>
    </SkeletonPage>
  );
}
