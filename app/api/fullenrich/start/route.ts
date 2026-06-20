import { NextRequest, NextResponse } from "next/server";
import { buildContact, demoFullEnrichRecord, isFullEnrichConfigured, startFullEnrichBulk } from "@/lib/providers/fullenrich";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const demoMode = Boolean(body.demoMode);
    const input = {
      prospectId: String(body.prospectId ?? ""),
      person: String(body.person ?? ""),
      firstName: String(body.firstName ?? ""),
      lastName: String(body.lastName ?? ""),
      email: String(body.email ?? ""),
      company: String(body.company ?? ""),
      companyDomain: String(body.companyDomain ?? ""),
      jobTitle: String(body.jobTitle ?? ""),
      linkedinUrl: String(body.linkedinUrl ?? ""),
    };

    if (!buildContact(input)) {
      return NextResponse.json(
        { success: false, error: "Insufficient identifying information for FullEnrich." },
        { status: 400 },
      );
    }

    if (demoMode || !isFullEnrichConfigured()) {
      const enrichmentId = `demo-${input.prospectId}-${Date.now()}`;
      return NextResponse.json({
        success: true,
        enrichmentId,
        status: "enrichment_started",
        demoMode: true,
        preview: demoFullEnrichRecord(input.prospectId, enrichmentId),
      });
    }

    const result = await startFullEnrichBulk(input);
    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Could not start FullEnrich enrichment.",
      },
      { status: 500 },
    );
  }
}
