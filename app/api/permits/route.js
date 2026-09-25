import { fetchPermitData } from "../../../lib/parsePermits";

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

  return Response.json(data);
}
