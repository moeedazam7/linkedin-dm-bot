import { NextRequest, NextResponse } from "next/server";
import { qualifyProspect } from "@/lib/qualification";
import type { NormalizedFullEnrichRecord } from "@/lib/providers/fullenrich";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const unifyRecord = (body.unifyRecord ?? {}) as Record<string, unknown>;
    const fullEnrichRecord = (body.fullEnrichRecord ?? null) as NormalizedFullEnrichRecord | null;
    const demoMode = Boolean(body.demoMode || fullEnrichRecord?.isDemo);
    const result = await qualifyProspect(unifyRecord, fullEnrichRecord, demoMode);

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "Could not qualify prospect." },
      { status: 500 },
    );
  }
}
