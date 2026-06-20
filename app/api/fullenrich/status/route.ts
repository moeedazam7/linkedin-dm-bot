import { NextRequest, NextResponse } from "next/server";
import { demoFullEnrichRecord, getFullEnrichStatus, isFullEnrichConfigured } from "@/lib/providers/fullenrich";

export async function GET(request: NextRequest) {
  try {
    const enrichmentId = request.nextUrl.searchParams.get("enrichmentId") ?? "";
    const prospectId = request.nextUrl.searchParams.get("prospectId") ?? "";

    if (!enrichmentId || !prospectId) {
      return NextResponse.json(
        { success: false, error: "enrichmentId and prospectId are required." },
        { status: 400 },
      );
    }

    if (enrichmentId.startsWith("demo-") || !isFullEnrichConfigured()) {
      return NextResponse.json({
        success: true,
        data: demoFullEnrichRecord(prospectId, enrichmentId),
      });
    }

    const data = await getFullEnrichStatus(enrichmentId, prospectId);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Could not retrieve FullEnrich status.",
      },
      { status: 500 },
    );
  }
}
