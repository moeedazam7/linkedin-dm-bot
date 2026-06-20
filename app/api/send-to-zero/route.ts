import { NextRequest, NextResponse } from "next/server";
import type { NormalizedFullEnrichRecord } from "@/lib/providers/fullenrich";
import type { QualificationResult } from "@/lib/qualification";

function text(record: Record<string, unknown>, key: string) {
  return String(record[key] ?? "").trim();
}

function looksLikeEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function pickEmail(
  unifyRecord: Record<string, unknown>,
  fullEnrichRecord: NormalizedFullEnrichRecord | null,
) {
  if (fullEnrichRecord?.workEmail && fullEnrichRecord.emailStatus === "valid") {
    return fullEnrichRecord.workEmail;
  }

  const unifyEmail = text(unifyRecord, "Email");
  return looksLikeEmail(unifyEmail) ? unifyEmail : "";
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const unifyRecord = (body.unifyRecord ?? {}) as Record<string, unknown>;
    const fullEnrichRecord = (body.fullEnrichRecord ?? null) as NormalizedFullEnrichRecord | null;
    const qualification = (body.qualification ?? {}) as QualificationResult;
    const demoMode = Boolean(body.demoMode);
    const webhookUrl = process.env.ZERO_WEBHOOK_URL?.trim();
    const payload = {
      person: text(unifyRecord, "Person"),
      email: pickEmail(unifyRecord, fullEnrichRecord),
      qualification_tier: String(qualification.qualificationTier ?? ""),
      final_score: Number(qualification.finalScore ?? 0),
    };

    if (!payload.person || !payload.qualification_tier) {
      return NextResponse.json(
        { success: false, error: "Prospect name and final qualification are required before sending to Zero." },
        { status: 400 },
      );
    }

    if (demoMode || !webhookUrl) {
      return NextResponse.json({
        success: true,
        status: "sent_to_zero",
        demoMode: true,
        message: "Prospect enriched, qualified, and routed to Zero CRM.",
      });
    }

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: "Zero CRM webhook rejected the prospect." },
        { status: 502 },
      );
    }

    return NextResponse.json({
      success: true,
      status: "sent_to_zero",
      message: "Prospect enriched, qualified, and routed to Zero CRM.",
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Could not send prospect to Zero CRM." },
      { status: 500 },
    );
  }
}
