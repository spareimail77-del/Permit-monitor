import { fetchPermitData } from "../../../lib/parsePermits";
import { computeDisplayStatus, todayInMuscat } from "../../../lib/status";

// Always read fresh from Blob — never cache stale permit data.
export const dynamic = "force-dynamic";

export async function GET() {
  const data = await fetchPermitData();

  if (data.error) {
    const status = data.error === "NO_FILE" ? 404 : 500;
    return Response.json(
      { error: data.error, message: data.message },
      { status }
    );
  }

  const today = todayInMuscat();

  const permits = data.permits.map((permit) => {
    const { displayStatus, daysRemaining } = computeDisplayStatus(
      permit,
      today
    );
    return { ...permit, displayStatus, daysRemaining };
  });

  return Response.json({
    uploadedAt: data.uploadedAt,
    today,
    duplicateReferences: data.duplicateReferences,
    permits,
  });
}
