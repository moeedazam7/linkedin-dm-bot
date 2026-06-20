import type { FullEnrichEmailStatus, NormalizedFullEnrichRecord } from "./providers/fullenrich";

export type QualificationEvidenceLabel = "Verified" | "Supported by Unify evidence" | "Inferred" | "Not found";
export type ValidationMode = "anthropic" | "openai" | "rules_based" | "demo";

export type QualificationFinding = {
  label: QualificationEvidenceLabel;
  finding: string;
};

export type QualificationResult = {
  missionScore: number;
  networkScore: number;
  communicationScore: number;
  evidenceScore: number;
  finalScore: number;
  unifyScore: number;
  scoreDifference: number;
  scoreChangeReason: string;
  qualificationTier: string;
  missionEvidence: QualificationFinding[];
  networkEvidence: QualificationFinding[];
  communicationEvidence: QualificationFinding[];
  evidenceAssessment: QualificationFinding[];
  lightfernUseCase: string;
  preferredChannel: string;
  outreachAngle: string;
  qualificationWarnings: string[];
  validationMode: ValidationMode;
};

type ProspectRecord = Record<string, unknown>;

const SENIORITY_TERMS = [
  "founder",
  "ceo",
  "chief",
  "vp",
  "vice president",
  "head",
  "partner",
  "director",
  "lead",
];

function text(record: ProspectRecord, key: string) {
  return String(record[key] ?? "").trim();
}

function numberValue(record: ProspectRecord, key: string) {
  const numeric = Number(record[key]);
  return Number.isFinite(numeric) ? numeric : 0;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function scoreFromTen(value: number, max: number) {
  return clamp((value / 10) * max, 0, max);
}

function hasAny(haystack: string, needles: string[]) {
  const lower = haystack.toLowerCase();
  return needles.some((needle) => lower.includes(needle));
}

export function preferredChannelFor(
  fullEnrichRecord: NormalizedFullEnrichRecord | null,
  unifyRecord: ProspectRecord,
) {
  if (fullEnrichRecord?.workEmail && fullEnrichRecord.emailStatus === "valid") {
    return "Email";
  }

  if (fullEnrichRecord?.workEmail && fullEnrichRecord.emailStatus === "probably_valid") {
    return "Email with caution";
  }

  if (fullEnrichRecord?.personalEmail) {
    return "Personal email with caution";
  }

  if (text(unifyRecord, "LinkedIn URL") || fullEnrichRecord?.linkedinUrl) {
    return "LinkedIn";
  }

  return "Manual research";
}

export function tierForScore(
  finalScore: number,
  missionScore: number,
  evidenceScore: number,
  preferredChannel: string,
) {
  if (finalScore >= 80 && missionScore >= 28 && evidenceScore >= 10 && preferredChannel !== "Manual research") {
    return "Priority Champion";
  }
  if (finalScore >= 65) return "Strong Prospect";
  if (finalScore >= 50) return "Nurture";
  return "Not Qualified";
}

function finding(label: QualificationEvidenceLabel, findingText: string): QualificationFinding {
  return { label, finding: findingText };
}

export function deterministicQualification(
  unifyRecord: ProspectRecord,
  fullEnrichRecord: NormalizedFullEnrichRecord | null,
  validationMode: ValidationMode = "rules_based",
): QualificationResult {
  const missionAlignment = numberValue(unifyRecord, "Mission Alignment");
  const networkEffect = numberValue(unifyRecord, "Network Effect");
  const communicationNeed = numberValue(unifyRecord, "High-Stakes Email Need");
  const evidenceStrength = numberValue(unifyRecord, "Evidence Strength");
  const unifyScore = numberValue(unifyRecord, "Revised Score");
  const directEvidence = text(unifyRecord, "Direct Evidence");
  const publicSignal = text(unifyRecord, "Exact Public Signal");
  const positionReason = text(unifyRecord, "Position Reason");
  const jobTitle = fullEnrichRecord?.jobTitle || text(unifyRecord, "Job Title");
  const company = fullEnrichRecord?.company || text(unifyRecord, "Company");
  const preferredChannel = preferredChannelFor(fullEnrichRecord, unifyRecord);
  const fullText = [publicSignal, directEvidence, positionReason, text(unifyRecord, "Inferred Use Case")].join(" ");

  const missionScore = scoreFromTen(missionAlignment, 40);
  let networkScore = scoreFromTen(networkEffect, 25);
  const communicationScore = scoreFromTen(communicationNeed, 20);
  let evidenceScore = scoreFromTen(evidenceStrength, 15);
  const warnings: string[] = [];

  if (jobTitle && hasAny(jobTitle, SENIORITY_TERMS)) {
    networkScore = clamp(networkScore + 2, 0, 25);
  }

  if (fullEnrichRecord?.jobTitle || fullEnrichRecord?.company || fullEnrichRecord?.companyDomain) {
    evidenceScore = clamp(evidenceScore + 1, 0, 15);
  }

  if (fullEnrichRecord?.workEmail && fullEnrichRecord.emailStatus === "probably_valid") {
    warnings.push("FullEnrich found a probably valid work email, not a fully verified email.");
  }

  if (!fullEnrichRecord?.workEmail && !text(unifyRecord, "Email")) {
    warnings.push("No valid work email found; outreach may require LinkedIn or manual research.");
  }

  if (!directEvidence && !publicSignal) {
    warnings.push("Unify evidence is sparse; qualification confidence is limited.");
    evidenceScore = clamp(evidenceScore - 4, 0, 15);
  }

  const finalScore = clamp(missionScore + networkScore + communicationScore + evidenceScore, 0, 100);
  const qualificationTier = tierForScore(finalScore, missionScore, evidenceScore, preferredChannel);

  return {
    missionScore,
    networkScore,
    communicationScore,
    evidenceScore,
    finalScore,
    unifyScore,
    scoreDifference: finalScore - unifyScore,
    scoreChangeReason:
      finalScore === unifyScore
        ? "Rules-based validation matched the Unify score."
        : "Rules-based validation recalculated score from Unify evidence and FullEnrich identity/contact confidence without adding new web research.",
    qualificationTier,
    missionEvidence: [
      finding(publicSignal || directEvidence ? "Supported by Unify evidence" : "Not found", publicSignal || directEvidence || "No mission evidence found in supplied record."),
      finding(
        hasAny(fullText, ["writing", "story", "creative", "voice", "ai", "communication"])
          ? "Supported by Unify evidence"
          : "Inferred",
        hasAny(fullText, ["writing", "story", "creative", "voice", "ai", "communication"])
          ? "The supplied Unify text references communication quality, creativity, voice, or AI adoption."
          : "Mission alignment comes primarily from Unify's numeric score rather than explicit text evidence.",
      ),
    ],
    networkEvidence: [
      finding(jobTitle ? "Verified" : "Not found", jobTitle ? `${jobTitle}${company ? ` at ${company}` : ""}.` : "No job title found."),
      finding(
        hasAny(jobTitle, SENIORITY_TERMS) ? "Inferred" : "Not found",
        hasAny(jobTitle, SENIORITY_TERMS)
          ? "Seniority suggests potential network leverage, but audience reach is not independently verified."
          : "No strong network-effect signal found in the supplied data.",
      ),
    ],
    communicationEvidence: [
      finding(
        text(unifyRecord, "Inferred Use Case") ? "Supported by Unify evidence" : "Inferred",
        text(unifyRecord, "Inferred Use Case") || "Communication need inferred from role and segment.",
      ),
      finding(
        hasAny(fullText, ["sales", "partnership", "fundraising", "investor", "client", "hiring", "executive", "relationship"])
          ? "Supported by Unify evidence"
          : "Inferred",
        "High-stakes communication need evaluated from Unify use case, outreach angle, role, and segment.",
      ),
    ],
    evidenceAssessment: [
      finding(directEvidence ? "Supported by Unify evidence" : "Not found", directEvidence || "No direct evidence supplied."),
      finding(
        fullEnrichRecord?.workEmail && fullEnrichRecord.emailStatus === "valid"
          ? "Verified"
          : fullEnrichRecord?.workEmail
            ? "Inferred"
            : "Not found",
        fullEnrichRecord?.workEmail
          ? `FullEnrich work email status: ${fullEnrichRecord.emailStatus}.`
          : "FullEnrich did not return a work email.",
      ),
    ],
    lightfernUseCase:
      text(unifyRecord, "Inferred Use Case") ||
      `Use Lightfern to help ${text(unifyRecord, "Person") || "this prospect"} create higher-trust outreach and relationship-led communication.`,
    preferredChannel,
    outreachAngle:
      text(unifyRecord, "Outreach Angle") ||
      "Lead with the verified public signal and ask whether a more human champion-led outreach workflow would help.",
    qualificationWarnings: validationMode === "demo" ? ["Simulated demo data"] : warnings,
    validationMode,
  };
}

function extractJson(textResponse: string) {
  const fenced = textResponse.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const raw = fenced ?? textResponse;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error("Model response did not contain JSON.");
  }
  return JSON.parse(raw.slice(start, end + 1)) as Partial<QualificationResult>;
}

function normalizeModelResult(
  result: Partial<QualificationResult>,
  fallback: QualificationResult,
  mode: ValidationMode,
): QualificationResult {
  const finalScore = clamp(Number(result.finalScore ?? fallback.finalScore), 0, 100);
  const missionScore = clamp(Number(result.missionScore ?? fallback.missionScore), 0, 40);
  const evidenceScore = clamp(Number(result.evidenceScore ?? fallback.evidenceScore), 0, 15);
  const preferredChannel = String(result.preferredChannel ?? fallback.preferredChannel);
  const qualificationTier = String(result.qualificationTier ?? tierForScore(finalScore, missionScore, evidenceScore, preferredChannel));

  return {
    ...fallback,
    ...result,
    missionScore,
    networkScore: clamp(Number(result.networkScore ?? fallback.networkScore), 0, 25),
    communicationScore: clamp(Number(result.communicationScore ?? fallback.communicationScore), 0, 20),
    evidenceScore,
    finalScore,
    unifyScore: fallback.unifyScore,
    scoreDifference: finalScore - fallback.unifyScore,
    qualificationTier,
    preferredChannel,
    validationMode: mode,
    qualificationWarnings: Array.isArray(result.qualificationWarnings) ? result.qualificationWarnings : fallback.qualificationWarnings,
  };
}

function qualificationPrompt(unifyRecord: ProspectRecord, fullEnrichRecord: NormalizedFullEnrichRecord | null) {
  return `You are validating a Lightfern GTM prospect. Use only the provided Unify evidence, Unify source URLs, FullEnrich identity/contact data, and existing job/company data. Do not perform or claim new web research. Never invent evidence.

Return strict JSON matching this TypeScript shape:
{
  "missionScore": number,
  "networkScore": number,
  "communicationScore": number,
  "evidenceScore": number,
  "finalScore": number,
  "scoreChangeReason": string,
  "qualificationTier": "Priority Champion" | "Strong Prospect" | "Nurture" | "Not Qualified",
  "missionEvidence": [{"label":"Verified"|"Supported by Unify evidence"|"Inferred"|"Not found","finding":string}],
  "networkEvidence": [{"label":"Verified"|"Supported by Unify evidence"|"Inferred"|"Not found","finding":string}],
  "communicationEvidence": [{"label":"Verified"|"Supported by Unify evidence"|"Inferred"|"Not found","finding":string}],
  "evidenceAssessment": [{"label":"Verified"|"Supported by Unify evidence"|"Inferred"|"Not found","finding":string}],
  "lightfernUseCase": string,
  "preferredChannel": string,
  "outreachAngle": string,
  "qualificationWarnings": string[]
}

Scoring: mission alignment 40, network effect 25, high-stakes communication need 20, evidence strength/recency 15. FullEnrich can improve contactability and identity/company confidence, but must not increase mission alignment without direct relevant evidence.

Unify record:
${JSON.stringify(unifyRecord, null, 2)}

FullEnrich record:
${JSON.stringify(fullEnrichRecord, null, 2)}`;
}

export async function qualifyProspect(
  unifyRecord: ProspectRecord,
  fullEnrichRecord: NormalizedFullEnrichRecord | null,
  demoMode = false,
): Promise<QualificationResult> {
  const fallback = deterministicQualification(unifyRecord, fullEnrichRecord, demoMode ? "demo" : "rules_based");

  if (demoMode) {
    return {
      ...fallback,
      qualificationWarnings: Array.from(new Set([...fallback.qualificationWarnings, "Simulated demo data"])),
      validationMode: "demo",
    };
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY?.trim();
  const openAiKey = process.env.OPENAI_API_KEY?.trim();
  const prompt = qualificationPrompt(unifyRecord, fullEnrichRecord);

  try {
    if (anthropicKey) {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-3-5-sonnet-latest",
          max_tokens: 1600,
          temperature: 0,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error("Anthropic qualification request failed.");
      const content = body?.content?.map((part: { text?: string }) => part.text ?? "").join("\n") ?? "";
      return normalizeModelResult(extractJson(content), fallback, "anthropic");
    }

    if (openAiKey) {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openAiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          temperature: 0,
          response_format: { type: "json_object" },
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error("OpenAI qualification request failed.");
      const content = body?.choices?.[0]?.message?.content ?? "";
      return normalizeModelResult(extractJson(content), fallback, "openai");
    }
  } catch {
    return {
      ...fallback,
      qualificationWarnings: Array.from(
        new Set([...fallback.qualificationWarnings, "Model validation failed; rules-based validation was used instead."]),
      ),
      validationMode: "rules_based",
    };
  }

  return fallback;
}

export function hasValidWorkEmail(record: NormalizedFullEnrichRecord | null) {
  return Boolean(record?.workEmail && record.emailStatus === "valid");
}

export function emailStatusLabel(status: FullEnrichEmailStatus | undefined) {
  if (status === "valid") return "Valid";
  if (status === "probably_valid") return "Probably valid";
  if (status === "invalid") return "Invalid";
  return "Not found";
}
