"use client";

import Papa from "papaparse";
import { ChangeEvent, useEffect, useMemo, useState } from "react";
import type { FullEnrichEmailStatus, FullEnrichStatus, NormalizedFullEnrichRecord } from "@/lib/providers/fullenrich";
import type { QualificationResult } from "@/lib/qualification";

const REQUIRED_COLUMNS = [
  "Person",
  "Email",
  "LinkedIn URL",
  "Company",
  "Job Title",
  "Segment",
  "Mission Alignment",
  "Network Effect",
  "High-Stakes Email Need",
  "Evidence Strength",
  "Exact Public Signal",
  "Source URL",
  "Direct Evidence",
  "Inferred Use Case",
  "Outreach Angle",
  "Preferred Channel",
  "New Rank",
  "Revised Score",
  "Qualification Tier",
  "Position Reason",
] as const;

const SORT_OPTIONS = [
  "New Rank",
  "Revised Score",
  "Mission Alignment",
  "Network Effect",
] as const;

const NUMERIC_COLUMNS = new Set<RequiredColumn>([
  "Mission Alignment",
  "Network Effect",
  "High-Stakes Email Need",
  "Evidence Strength",
  "New Rank",
  "Revised Score",
]);

const REVIEW_STATUSES = [
  "Unreviewed",
  "Approved",
  "Needs Review",
  "Rejected",
] as const;

type RequiredColumn = (typeof REQUIRED_COLUMNS)[number];
type SortOption = (typeof SORT_OPTIONS)[number];
type ReviewStatus = (typeof REVIEW_STATUSES)[number];
type CsvCell = string | number;
type ProspectRow = Record<string, CsvCell>;
type EnrichmentUiStatus =
  | "Not started"
  | "Enrichment queued"
  | "Enriching"
  | "Enriched"
  | "Probably valid email"
  | "No valid email found"
  | "Insufficient credits"
  | "Failed"
  | "Timed out";
type CrmStatus = "Not ready" | "Ready for CRM" | "Sending" | "Sent to Zero" | "Failed" | "Retry";

type ReviewDecision = {
  status: ReviewStatus;
  reviewedAt?: string;
};

type EnrichmentState = {
  status: EnrichmentUiStatus;
  enrichmentId?: string;
  message?: string;
  progress?: string;
};

type CrmState = {
  status: CrmStatus;
  message?: string;
  sentAt?: string;
  isDemo?: boolean;
};

type SamplePerson = {
  person: string;
  company: string;
  title: string;
  segment: string;
};

const SAMPLE_PEOPLE: SamplePerson[] = [
  { person: "Avery Chen", company: "Northstar Climate", title: "VP of Revenue", segment: "Climate Tech" },
  { person: "Maya Patel", company: "Cedar Health", title: "Head of Lifecycle Marketing", segment: "Healthcare" },
  { person: "Jordan Lee", company: "SignalForge", title: "Founder & CEO", segment: "B2B SaaS" },
  { person: "Sofia Martinez", company: "Arcadia Labs", title: "Chief Customer Officer", segment: "AI Infrastructure" },
  { person: "Elliot Brooks", company: "Veridian Capital", title: "Operating Partner", segment: "Venture Capital" },
  { person: "Noor Al-Fayed", company: "Frontier Bio", title: "Director of Partnerships", segment: "Biotech" },
  { person: "Theo Grant", company: "CivicGrid", title: "Head of Growth", segment: "GovTech" },
  { person: "Priya Raman", company: "Atlas Learning", title: "VP of Product Marketing", segment: "EdTech" },
  { person: "Lucas Meyer", company: "Ribbon Finance", title: "Revenue Operations Lead", segment: "Fintech" },
  { person: "Emma Walsh", company: "Brightline AI", title: "Community Lead", segment: "AI Infrastructure" },
  { person: "Kai Johnson", company: "Nimbus Robotics", title: "Director of Sales", segment: "Robotics" },
  { person: "Grace Kim", company: "HelioGrid", title: "Founder", segment: "Climate Tech" },
  { person: "Amara Okafor", company: "Mosaic Care", title: "VP of Operations", segment: "Healthcare" },
  { person: "Ben Carter", company: "LatticeWorks", title: "Head of Partnerships", segment: "B2B SaaS" },
  { person: "Nina Rossi", company: "Novel Foods Co", title: "Chief of Staff", segment: "Food Tech" },
  { person: "Samir Shah", company: "Vector Security", title: "Product Lead", segment: "Cybersecurity" },
  { person: "Claire Dubois", company: "Finch Legal", title: "Partner", segment: "Legal Tech" },
  { person: "Marcus Green", company: "Oak & Ember", title: "Founder", segment: "Consumer" },
  { person: "Iris Zhang", company: "Wave Commerce", title: "Head of CX", segment: "Ecommerce" },
  { person: "Hugo Silva", company: "Nova Talent", title: "Talent Partner", segment: "Venture Capital" },
  { person: "Leah Stein", company: "Bridge Analytics", title: "Demand Generation Manager", segment: "B2B SaaS" },
  { person: "Owen Price", company: "Fjord Renewables", title: "Sales Manager", segment: "Climate Tech" },
  { person: "Zara Ndlovu", company: "Equity Labs", title: "Community Director", segment: "Nonprofit" },
  { person: "Mateo Ruiz", company: "Pulse Health", title: "Customer Marketing Manager", segment: "Healthcare" },
  { person: "Hannah Park", company: "Spark Studio", title: "Founder", segment: "Agency" },
  { person: "Isaac Turner", company: "Waypoint AI", title: "Solutions Consultant", segment: "AI Infrastructure" },
  { person: "Elena Petrova", company: "Kite Logistics", title: "Operations Lead", segment: "Logistics" },
  { person: "Ravi Menon", company: "Summit Bank", title: "Innovation Manager", segment: "Fintech" },
  { person: "Olivia Stone", company: "Evergreen HR", title: "People Operations Lead", segment: "HR Tech" },
  { person: "Daniel Cho", company: "Prism Legal", title: "Head of Client Success", segment: "Legal Tech" },
  { person: "Mina Hassan", company: "Bluebird Energy", title: "Marketing Lead", segment: "Climate Tech" },
  { person: "Jonas Beck", company: "Arena Sports", title: "Partnerships Manager", segment: "Sports Tech" },
  { person: "Talia Morgan", company: "Cobalt Cloud", title: "Sales Enablement Lead", segment: "B2B SaaS" },
  { person: "Peter Novak", company: "Harvest Bio", title: "Business Development Lead", segment: "Biotech" },
  { person: "Mei Lin", company: "Orbit Payments", title: "Developer Relations Lead", segment: "Fintech" },
  { person: "Renee Walker", company: "Wildflower Schools", title: "Regional Director", segment: "EdTech" },
  { person: "Alex Morgan", company: "Open Field", title: "Independent Advisor", segment: "Venture Capital" },
  { person: "Sara Ahmed", company: "Thrive Clinics", title: "Practice Growth Lead", segment: "Healthcare" },
  { person: "Nico Brown", company: "Keystone Labs", title: "Product Marketing Manager", segment: "Cybersecurity" },
  { person: "Lena Fischer", company: "Greenhouse Guild", title: "Founder", segment: "Climate Tech" },
];

const MISSION_SIGNALS = [
  "published a framework on trust-centered outbound",
  "posted about customer relationships depending on high-context email",
  "shared a teardown of founder-led sales workflows",
  "hosted a webinar about advocacy-led growth",
  "wrote about activating operator networks for portfolio companies",
];

function companySlug(company: string) {
  return company.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function personSlug(person: string) {
  return person.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function makeSampleProspects(): ProspectRow[] {
  return SAMPLE_PEOPLE.map((entry, index) => {
    const isPriority = index < 8;
    const isStrong = index >= 8 && index < 20;
    const hasEmail = index < 33;
    const mission = isPriority ? 10 - (index % 2) : isStrong ? 8 - (index % 2) : 6 - (index % 3 === 0 ? 1 : 0);
    const network = isPriority ? 9 - (index % 2) : isStrong ? 8 - (index % 3 === 0 ? 1 : 0) : 6;
    const highStakes = isPriority ? 9 : isStrong ? 7 + (index % 2) : 5 + (index % 2);
    const evidence = isPriority ? 9 - (index % 3 === 0 ? 1 : 0) : isStrong ? 8 : 6;
    const score = isPriority ? 96 - index * 2 : isStrong ? 84 - (index - 8) : 69 - Math.floor((index - 20) * 1.1);
    const tier = isPriority ? "Priority Champion" : isStrong ? "Strong Prospect" : "Nurture";
    const firstName = entry.person.split(" ")[0].toLowerCase();
    const lastName = entry.person.split(" ").slice(-1)[0].toLowerCase();
    const signal = MISSION_SIGNALS[index % MISSION_SIGNALS.length];

    return {
      __prospect_id: `sample-${index + 1}`,
      Person: entry.person,
      Email: hasEmail ? `${firstName}.${lastName}@${companySlug(entry.company)}.com` : "",
      "LinkedIn URL": `https://www.linkedin.com/in/${personSlug(entry.person)}`,
      Company: entry.company,
      "Job Title": entry.title,
      Segment: entry.segment,
      "Mission Alignment": mission,
      "Network Effect": network,
      "High-Stakes Email Need": highStakes,
      "Evidence Strength": evidence,
      "Exact Public Signal": `${entry.person} ${signal}.`,
      "Source URL": `https://example.com/signals/${personSlug(entry.person)}`,
      "Direct Evidence": `${entry.person} has publicly discussed ${signal.replace("published ", "").replace("posted about ", "")} and owns a relationship-heavy GTM motion.`,
      "Inferred Use Case": `Use Lightfern to turn warm network context into credible, high-trust outreach for ${entry.segment.toLowerCase()} buyers and partners.`,
      "Outreach Angle": `Lead with the public signal, then offer a concise champion workflow that helps ${entry.company} activate warm introductions without generic sequencing.`,
      "Preferred Channel": hasEmail ? "Email" : "LinkedIn",
      "New Rank": index + 1,
      "Revised Score": score,
      "Qualification Tier": tier,
      "Position Reason": `${tier} because the role combines mission alignment, network leverage, email urgency, and verifiable public evidence.`,
    };
  });
}

const INITIAL_PROSPECTS = makeSampleProspects();

function normalizeHeader(header: string) {
  return header.replace(/^\uFEFF/, "").trim();
}

function normalizeCsvCell(column: string, cell: unknown): CsvCell {
  const trimmed = String(cell ?? "").trim();
  if (!NUMERIC_COLUMNS.has(column as RequiredColumn)) {
    return trimmed;
  }

  const numeric = Number(trimmed);
  return trimmed !== "" && Number.isFinite(numeric) ? numeric : "";
}

function value(row: ProspectRow, column: RequiredColumn) {
  return String(row[column] ?? "").trim();
}

function numericValue(row: ProspectRow, column: RequiredColumn) {
  const parsed = Number(value(row, column));
  return Number.isFinite(parsed) ? parsed : 0;
}

function prospectId(row: ProspectRow) {
  const internalId = String(row.__prospect_id ?? "").trim();
  if (internalId) {
    return internalId;
  }

  return (
    value(row, "Email").toLowerCase() ||
    value(row, "LinkedIn URL").toLowerCase() ||
    `${value(row, "Person")}-${value(row, "Company")}`.toLowerCase()
  );
}

function withProspectId(row: ProspectRow, index: number, prefix: string) {
  return {
    ...row,
    __prospect_id: String(row.__prospect_id ?? `${prefix}-${index + 1}`),
  };
}

function uniqueValues(rows: ProspectRow[], column: RequiredColumn) {
  return Array.from(new Set(rows.map((row) => value(row, column)).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b),
  );
}

function effectiveChannel(row: ProspectRow) {
  const email = value(row, "Email");
  const linkedin = value(row, "LinkedIn URL");
  const preferred = value(row, "Preferred Channel");

  if (!email && linkedin) {
    return "LinkedIn-only";
  }

  if (preferred.toLowerCase().includes("linkedin")) {
    return "LinkedIn";
  }

  return email ? "Email" : preferred || "Unknown";
}

function tierBadgeClass(tier: string) {
  const normalized = tier.toLowerCase();
  if (normalized.includes("priority")) {
    return "border-emerald-300 bg-emerald-100 text-emerald-900 shadow-sm shadow-emerald-200";
  }
  if (normalized.includes("strong")) {
    return "border-teal-200 bg-teal-50 text-teal-800";
  }
  return "border-slate-200 bg-slate-100 text-slate-600";
}

function channelBadgeClass(channel: string) {
  return channel.toLowerCase().includes("linkedin")
    ? "border-sky-200 bg-sky-50 text-sky-700"
    : "border-emerald-200 bg-emerald-50 text-emerald-700";
}

function reviewBadgeClass(status: ReviewStatus) {
  if (status === "Approved") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }
  if (status === "Needs Review") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }
  if (status === "Rejected") {
    return "border-rose-200 bg-rose-50 text-rose-800";
  }
  return "border-slate-200 bg-white text-slate-500";
}

function statusPillClass(status: string) {
  const normalized = status.toLowerCase();
  if (normalized.includes("sent") || normalized.includes("ready") || normalized.includes("enriched") || normalized === "valid") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }
  if (normalized.includes("probably") || normalized.includes("queued") || normalized.includes("enriching") || normalized.includes("caution")) {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }
  if (normalized.includes("failed") || normalized.includes("invalid") || normalized.includes("insufficient") || normalized.includes("timed")) {
    return "border-rose-200 bg-rose-50 text-rose-800";
  }
  return "border-slate-200 bg-white text-slate-500";
}

function emailStatusLabel(status?: FullEnrichEmailStatus) {
  if (status === "valid") return "Valid";
  if (status === "probably_valid") return "Probably valid";
  if (status === "invalid") return "Invalid";
  return "Not found";
}

function enrichmentUiStatusFromProvider(record: NormalizedFullEnrichRecord): EnrichmentUiStatus {
  if (record.status === "insufficient_credit") return "Insufficient credits";
  if (record.status === "failed" || record.status === "cancelled") return "Failed";
  if (record.status === "queued") return "Enrichment queued";
  if (record.status === "processing") return "Enriching";
  if (record.emailStatus === "valid") return "Enriched";
  if (record.emailStatus === "probably_valid") return "Probably valid email";
  return "No valid email found";
}

function finalScoreFor(id: string, prospect: ProspectRow, qualifications: Record<string, QualificationResult>) {
  return qualifications[id]?.finalScore ?? "";
}

function finalTierFor(id: string, prospect: ProspectRow, qualifications: Record<string, QualificationResult>) {
  return qualifications[id]?.qualificationTier ?? value(prospect, "Qualification Tier");
}

function finalPreferredChannelFor(id: string, prospect: ProspectRow, qualifications: Record<string, QualificationResult>) {
  return qualifications[id]?.preferredChannel ?? effectiveChannel(prospect);
}

function isReadyForCrm(id: string, reviews: Record<string, ReviewDecision>, qualifications: Record<string, QualificationResult>) {
  return reviews[id]?.status === "Approved" && Boolean(qualifications[id]);
}

function validEmailForZero(unifyRecord: ProspectRow | undefined, record: NormalizedFullEnrichRecord | undefined) {
  if (record?.workEmail && record.emailStatus === "valid") return record.workEmail;
  const unifyEmail = unifyRecord ? value(unifyRecord, "Email") : "";
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(unifyEmail) ? unifyEmail : "";
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function downloadCsv(filename: string, rows: ProspectRow[]) {
  const csv = Papa.unparse(
    rows.map((row) =>
      Object.fromEntries(Object.entries(row).filter(([key]) => !key.startsWith("__"))),
    ),
  );
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function Home() {
  const [prospects, setProspects] = useState<ProspectRow[]>(INITIAL_PROSPECTS);
  const [unifyProspects, setUnifyProspects] = useState<ProspectRow[]>(INITIAL_PROSPECTS);
  const [sourceName, setSourceName] = useState("Sample fallback data");
  const [selectedId, setSelectedId] = useState(prospectId(INITIAL_PROSPECTS[0]));
  const [tierFilter, setTierFilter] = useState("All");
  const [segmentFilter, setSegmentFilter] = useState("All");
  const [channelFilter, setChannelFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState<ReviewStatus | "All">("All");
  const [minimumScore, setMinimumScore] = useState(0);
  const [sortBy, setSortBy] = useState<SortOption>("New Rank");
  const [reviews, setReviews] = useState<Record<string, ReviewDecision>>({});
  const [enrichmentStates, setEnrichmentStates] = useState<Record<string, EnrichmentState>>({});
  const [fullEnrichRecords, setFullEnrichRecords] = useState<Record<string, NormalizedFullEnrichRecord>>({});
  const [qualificationResults, setQualificationResults] = useState<Record<string, QualificationResult>>({});
  const [crmStates, setCrmStates] = useState<Record<string, CrmState>>({});
  const [validationError, setValidationError] = useState("");
  const [notice, setNotice] = useState("");
  const [demoMode, setDemoMode] = useState(true);
  const [batchRunning, setBatchRunning] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem("lightfern-review-decisions");
    if (!stored) {
      return;
    }

    try {
      setReviews(JSON.parse(stored) as Record<string, ReviewDecision>);
    } catch {
      window.localStorage.removeItem("lightfern-review-decisions");
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("lightfern-review-decisions", JSON.stringify(reviews));
  }, [reviews]);

  const selectedProspect = useMemo(
    () => prospects.find((prospect) => prospectId(prospect) === selectedId) ?? prospects[0],
    [prospects, selectedId],
  );
  const selectedUnifyProspect = useMemo(
    () => unifyProspects.find((prospect) => prospectId(prospect) === selectedId) ?? selectedProspect,
    [selectedId, selectedProspect, unifyProspects],
  );

  const summary = useMemo(
    () => ({
      imported: prospects.length,
      pendingEnrichment: prospects.filter((row) => !fullEnrichRecords[prospectId(row)]).length,
      enriched: prospects.filter((row) => Boolean(fullEnrichRecords[prospectId(row)])).length,
      readyForCrm: prospects.filter((row) => {
        const id = prospectId(row);
        return isReadyForCrm(id, reviews, qualificationResults) && crmStates[id]?.status !== "Sent to Zero";
      }).length,
      sentToZero: prospects.filter((row) => crmStates[prospectId(row)]?.status === "Sent to Zero").length,
      missingValidEmail: prospects.filter((row) => {
        const id = prospectId(row);
        const unifyRecord = unifyProspects.find((prospect) => prospectId(prospect) === id);
        return !validEmailForZero(unifyRecord, fullEnrichRecords[id]);
      }).length,
    }),
    [crmStates, fullEnrichRecords, prospects, qualificationResults, reviews, unifyProspects],
  );

  const filters = useMemo(
    () => ({
      tiers: Array.from(
        new Set(
          prospects
            .map((prospect) => finalTierFor(prospectId(prospect), prospect, qualificationResults))
            .filter(Boolean),
        ),
      ).sort((a, b) => a.localeCompare(b)),
      segments: uniqueValues(prospects, "Segment"),
      channels: Array.from(
        new Set(
          prospects
            .map((prospect) => finalPreferredChannelFor(prospectId(prospect), prospect, qualificationResults))
            .filter(Boolean),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    }),
    [prospects, qualificationResults],
  );

  const filteredProspects = useMemo(() => {
    return [...prospects]
      .filter((row) => {
        const id = prospectId(row);
        return tierFilter === "All" || finalTierFor(id, row, qualificationResults) === tierFilter;
      })
      .filter((row) => segmentFilter === "All" || value(row, "Segment") === segmentFilter)
      .filter((row) => {
        const id = prospectId(row);
        return channelFilter === "All" || finalPreferredChannelFor(id, row, qualificationResults) === channelFilter;
      })
      .filter((row) => {
        const status = reviews[prospectId(row)]?.status ?? "Unreviewed";
        return statusFilter === "All" || status === statusFilter;
      })
      .filter((row) => {
        const id = prospectId(row);
        return Number(finalScoreFor(id, row, qualificationResults) || numericValue(row, "Revised Score")) >= minimumScore;
      })
      .sort((a, b) => {
        if (sortBy === "New Rank") {
          return numericValue(a, sortBy) - numericValue(b, sortBy);
        }
        return numericValue(b, sortBy) - numericValue(a, sortBy);
      });
  }, [channelFilter, minimumScore, prospects, qualificationResults, reviews, segmentFilter, sortBy, statusFilter, tierFilter]);

  function setDecision(status: ReviewStatus) {
    if (!selectedProspect) {
      return;
    }

    const id = prospectId(selectedProspect);
    if (status === "Approved" && !qualificationResults[id]) {
      setValidationError("Qualification validation must complete before approval.");
      return;
    }

    setReviews((current) => ({
      ...current,
      [id]: {
        status,
        reviewedAt: new Date().toISOString(),
      },
    }));
    if (status === "Approved") {
      setCrmStates((current) => ({
        ...current,
        [id]: {
          status: "Ready for CRM",
          message: "Human approved. Send to Zero is now available.",
        },
      }));
    }
    setValidationError("");
    setNotice(`${value(selectedProspect, "Person") || "Prospect"} marked as ${status}.`);
  }

  function resetFilters() {
    setTierFilter("All");
    setSegmentFilter("All");
    setChannelFilter("All");
    setStatusFilter("All");
    setMinimumScore(0);
    setSortBy("New Rank");
  }

  function resetToSampleData() {
    setProspects(INITIAL_PROSPECTS);
    setUnifyProspects(INITIAL_PROSPECTS);
    setSourceName("Sample fallback data");
    setSelectedId(prospectId(INITIAL_PROSPECTS[0]));
    resetFilters();
    setEnrichmentStates({});
    setFullEnrichRecords({});
    setQualificationResults({});
    setCrmStates({});
    setValidationError("");
    setNotice("Sample fallback data restored.");
  }

  function prospectPayload(prospect: ProspectRow, unifyRecord = prospect) {
    const person = value(unifyRecord, "Person");
    const [firstName = "", ...lastParts] = person.split(/\s+/).filter(Boolean);
    return {
      prospectId: prospectId(prospect),
      person,
      firstName,
      lastName: lastParts.join(" "),
      email: value(unifyRecord, "Email"),
      company: value(unifyRecord, "Company"),
      companyDomain: String(unifyRecord["Company Domain"] ?? ""),
      jobTitle: value(unifyRecord, "Job Title"),
      linkedinUrl: value(unifyRecord, "LinkedIn URL"),
    };
  }

  function mergeFullEnrichRecord(id: string, record: NormalizedFullEnrichRecord) {
    setProspects((current) =>
      current.map((prospect) => {
        if (prospectId(prospect) !== id) {
          return prospect;
        }

        return {
          ...prospect,
          Email: record.workEmail && record.emailStatus === "valid" ? record.workEmail : prospect.Email,
          "LinkedIn URL": record.linkedinUrl || prospect["LinkedIn URL"],
          "Job Title": record.jobTitle || prospect["Job Title"],
          Company: record.company || prospect.Company,
          "Company Domain": record.companyDomain || prospect["Company Domain"] || "",
          "FullEnrich Email Status": record.emailStatus,
        };
      }),
    );
  }

  async function pollFullEnrichStatus(id: string, enrichmentId: string) {
    for (let attempt = 1; attempt <= 30; attempt += 1) {
      await sleep(3000);
      setEnrichmentStates((current) => ({
        ...current,
        [id]: {
          ...current[id],
          status: "Enriching",
          progress: `Polling FullEnrich (${attempt}/30)`,
        },
      }));

      const response = await fetch(`/api/fullenrich/status?enrichmentId=${encodeURIComponent(enrichmentId)}&prospectId=${encodeURIComponent(id)}`);
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error ?? "FullEnrich status polling failed.");
      }

      const record = result.data as NormalizedFullEnrichRecord;
      const uiStatus = enrichmentUiStatusFromProvider(record);
      setEnrichmentStates((current) => ({
        ...current,
        [id]: {
          ...current[id],
          status: uiStatus,
          enrichmentId,
          message: record.isDemo ? "Simulated demo data" : undefined,
        },
      }));

      if (["completed", "failed", "cancelled", "insufficient_credit"].includes(record.status)) {
        if (record.status === "completed") {
          setFullEnrichRecords((current) => ({ ...current, [id]: record }));
          mergeFullEnrichRecord(id, record);
        }
        return record;
      }
    }

    setEnrichmentStates((current) => ({
      ...current,
      [id]: {
        ...current[id],
        status: "Timed out",
        message: "FullEnrich polling timed out after 90 seconds. Retry is available.",
      },
    }));
    return null;
  }

  async function enrichProspect(prospect: ProspectRow, shouldRequalify: boolean) {
    const id = prospectId(prospect);
    const unifyRecord = unifyProspects.find((row) => prospectId(row) === id) ?? prospect;
    setValidationError("");
    setNotice("");
    setEnrichmentStates((current) => ({
      ...current,
      [id]: { status: "Enrichment queued", message: demoMode ? "Simulated demo data" : undefined },
    }));

    try {
      const response = await fetch("/api/fullenrich/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...prospectPayload(prospect, unifyRecord), demoMode }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error ?? "Could not start FullEnrich enrichment.");
      }

      const enrichmentId = String(result.enrichmentId);
      setEnrichmentStates((current) => ({
        ...current,
        [id]: { status: "Enriching", enrichmentId, message: result.demoMode ? "Simulated demo data" : undefined },
      }));

      const record = await pollFullEnrichStatus(id, enrichmentId);
      if (!record || record.status !== "completed") {
        return null;
      }

      if (shouldRequalify) {
        await requalifyProspect(prospect, record);
      }

      return record;
    } catch (error) {
      setEnrichmentStates((current) => ({
        ...current,
        [id]: {
          ...current[id],
          status: "Failed",
          message: error instanceof Error ? error.message : "FullEnrich enrichment failed.",
        },
      }));
      return null;
    }
  }

  async function requalifyProspect(prospect: ProspectRow, overrideFullEnrichRecord?: NormalizedFullEnrichRecord) {
    const id = prospectId(prospect);
    const unifyRecord = unifyProspects.find((row) => prospectId(row) === id) ?? prospect;
    const fullEnrichRecord = overrideFullEnrichRecord ?? fullEnrichRecords[id] ?? null;

    try {
      const response = await fetch("/api/qualify-prospect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unifyRecord, fullEnrichRecord, demoMode }),
      });
      const qualification = (await response.json()) as QualificationResult & { error?: string };
      if (!response.ok) {
        throw new Error(qualification.error ?? "Could not qualify prospect.");
      }

      setQualificationResults((current) => ({ ...current, [id]: qualification }));
      setProspects((current) =>
        current.map((row) =>
          prospectId(row) === id
            ? {
                ...row,
                "Final Score": qualification.finalScore,
                "Final Qualification Tier": qualification.qualificationTier,
                "Preferred Channel": qualification.preferredChannel,
                "Position Reason": qualification.scoreChangeReason,
                "Inferred Use Case": qualification.lightfernUseCase,
                "Outreach Angle": qualification.outreachAngle,
              }
            : row,
        ),
      );
      setNotice(`${value(unifyRecord, "Person") || "Prospect"} qualified with final score ${qualification.finalScore}.`);
      return qualification;
    } catch (error) {
      setValidationError(error instanceof Error ? error.message : "Could not qualify prospect.");
      return null;
    }
  }

  async function sendToZero(prospect: ProspectRow) {
    const id = prospectId(prospect);
    const unifyRecord = unifyProspects.find((row) => prospectId(row) === id) ?? prospect;
    const qualification = qualificationResults[id];

    if (!isReadyForCrm(id, reviews, qualificationResults)) {
      setCrmStates((current) => ({
        ...current,
        [id]: { status: "Not ready", message: "Enrichment, qualification, and approval are required before Zero routing." },
      }));
      return;
    }

    setCrmStates((current) => ({ ...current, [id]: { status: "Sending" } }));

    try {
      const response = await fetch("/api/send-to-zero", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          unifyRecord,
          fullEnrichRecord: fullEnrichRecords[id] ?? null,
          qualification,
          demoMode,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error ?? "Zero CRM routing failed.");
      }

      setCrmStates((current) => ({
        ...current,
        [id]: {
          status: "Sent to Zero",
          message: result.message ?? "Prospect enriched, qualified, and routed to Zero CRM.",
          sentAt: new Date().toISOString(),
          isDemo: Boolean(result.demoMode),
        },
      }));
      setNotice("Prospect enriched, qualified, and routed to Zero CRM.");
    } catch (error) {
      setCrmStates((current) => ({
        ...current,
        [id]: {
          status: "Failed",
          message: error instanceof Error ? error.message : "Zero CRM routing failed.",
        },
      }));
    }
  }

  async function enrichPriorityChampions() {
    if (batchRunning) {
      return;
    }

    setBatchRunning(true);
    const priorityProspects = prospects.filter((prospect) =>
      finalTierFor(prospectId(prospect), prospect, qualificationResults).toLowerCase().includes("priority"),
    );

    for (const prospect of priorityProspects) {
      const id = prospectId(prospect);
      if (fullEnrichRecords[id]) {
        continue;
      }
      await enrichProspect(prospect, true);
    }

    setBatchRunning(false);
  }

  function handleCsvUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setNotice("");
    setValidationError("");

    if (!file) {
      return;
    }

    Papa.parse<ProspectRow>(file, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: normalizeHeader,
      complete: (results) => {
        const fields = results.meta.fields?.map(normalizeHeader).filter(Boolean) ?? [];
        console.log("Lightfern CSV parsed headers:", fields);
        console.log("Lightfern CSV first parsed row:", results.data[0] ?? null);

        const blockingParseErrors = results.errors.filter((error) => error.type !== "FieldMismatch");
        if (blockingParseErrors.length > 0) {
          setValidationError(`Could not parse CSV: ${blockingParseErrors[0]?.message ?? "Unknown parsing error"}.`);
          event.target.value = "";
          return;
        }

        const missingColumns = REQUIRED_COLUMNS.filter((column) => !fields.includes(column));

        if (missingColumns.length > 0) {
          setValidationError(`CSV is missing required column${missingColumns.length === 1 ? "" : "s"}: ${missingColumns.join(", ")}.`);
          event.target.value = "";
          return;
        }

        const rows = results.data
          .filter((row) => fields.some((field) => String(row[field] ?? "").trim() !== ""))
          .map((row, index) => {
            const normalized: ProspectRow = {};
            fields.forEach((field) => {
              normalized[field] = normalizeCsvCell(field, row[field]);
            });
            REQUIRED_COLUMNS.forEach((column) => {
              normalized[column] = normalized[column] ?? "";
            });
            return withProspectId(normalized, index, "csv");
          });

        if (rows.length === 0) {
          setValidationError("CSV has the required columns, but no prospect rows to review.");
          event.target.value = "";
          return;
        }

        setProspects(rows);
        setUnifyProspects(rows);
        setSourceName(file.name);
        setSelectedId(prospectId(rows[0]));
        resetFilters();
        setEnrichmentStates({});
        setFullEnrichRecords({});
        setQualificationResults({});
        setCrmStates({});
        setReviews({});
        setNotice(`${rows.length} prospects imported successfully.`);
        event.target.value = "";
      },
      error: (error) => {
        setValidationError(`Could not parse CSV: ${error.message}`);
        event.target.value = "";
      },
    });
  }

  function exportApproved() {
    const approvedRows = prospects.reduce<ProspectRow[]>((rows, row) => {
      const decision = reviews[prospectId(row)];
      if (decision?.status !== "Approved") {
        return rows;
      }

      rows.push({
        ...row,
        review_status: decision.status,
        reviewed_at: decision.reviewedAt ?? "",
      });
      return rows;
    }, []);

    if (approvedRows.length === 0) {
      setNotice("No approved prospects to export yet.");
      return;
    }

    downloadCsv("lightfern-approved-champions.csv", approvedRows);
    setNotice(`${approvedRows.length} approved prospect${approvedRows.length === 1 ? "" : "s"} exported.`);
  }

  const selectedStatus = selectedProspect ? reviews[prospectId(selectedProspect)]?.status ?? "Unreviewed" : "Unreviewed";
  const selectedReviewedAt = selectedProspect ? reviews[prospectId(selectedProspect)]?.reviewedAt : undefined;

  return (
    <main className="min-h-screen px-4 py-6 text-slate-950 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/75 shadow-2xl shadow-emerald-950/10 backdrop-blur">
          <div className="grid gap-8 p-7 lg:grid-cols-[1.3fr_0.7fr] lg:p-10">
            <div>
              <div className="mb-5 inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-800">
                Unify signal review workspace
              </div>
              <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-6xl">
                Lightfern Champion Radar
              </h1>
              <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-600">
                Find people who will not only use Lightfern, but advocate for it.
              </p>
            </div>

            <section className="rounded-3xl border border-emerald-100 bg-emerald-950 p-6 text-white shadow-xl shadow-emerald-950/20">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-200">
                Why this matters
              </p>
              <div className="mt-5 space-y-4 text-sm leading-6 text-emerald-50">
                <p>
                  Traditional prospecting ranks by title and company.
                </p>
                <p>
                  This system ranks by mission alignment, influence, communication need, and evidence quality.
                </p>
              </div>
            </section>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
          {[
            { label: "Prospects imported", value: summary.imported },
            { label: "Pending enrichment", value: summary.pendingEnrichment },
            { label: "Enriched by FullEnrich", value: summary.enriched },
            { label: "Ready for CRM", value: summary.readyForCrm },
            { label: "Sent to Zero", value: summary.sentToZero },
            { label: "Missing valid email", value: summary.missingValidEmail },
          ].map((card) => (
            <div key={card.label} className="rounded-3xl border border-white/70 bg-white/80 p-5 shadow-lg shadow-emerald-950/5">
              <div className="text-3xl font-semibold tracking-tight text-slate-950">{card.value}</div>
              <div className="mt-1 text-sm font-medium text-slate-500">{card.label}</div>
            </div>
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_23rem]">
          <div className="space-y-6">
            <div className="rounded-[1.75rem] border border-white/70 bg-white/85 p-5 shadow-xl shadow-emerald-950/5 backdrop-blur">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-slate-950">Champion pipeline</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Reviewing {filteredProspects.length} of {prospects.length} prospects from {sourceName}.
                  </p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <label className="inline-flex items-center justify-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800">
                    <input
                      type="checkbox"
                      checked={demoMode}
                      onChange={(event) => setDemoMode(event.target.checked)}
                      className="accent-amber-600"
                    />
                    Demo mode
                  </label>
                  <label className="inline-flex cursor-pointer items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100">
                    Import CSV
                    <input className="sr-only" type="file" accept=".csv,text/csv" onChange={handleCsvUpload} />
                  </label>
                  <button
                    type="button"
                    onClick={enrichPriorityChampions}
                    disabled={batchRunning}
                    className="rounded-full border border-teal-200 bg-teal-50 px-4 py-2 text-sm font-semibold text-teal-800 transition hover:bg-teal-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {batchRunning ? "Enriching..." : "Enrich Priority Champions"}
                  </button>
                  <button
                    type="button"
                    onClick={resetToSampleData}
                    className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-950"
                  >
                    Reset to sample data
                  </button>
                  <button
                    type="button"
                    onClick={exportApproved}
                    className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-slate-950/15 transition hover:bg-slate-800"
                  >
                    Export Approved CSV
                  </button>
                </div>
              </div>

              {(validationError || notice) && (
                <div className="mt-4 space-y-2">
                  {validationError && (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
                      {validationError}
                    </div>
                  )}
                  {notice && (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
                      {notice}
                    </div>
                  )}
                </div>
              )}

              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                <FilterSelect label="Qualification tier" value={tierFilter} onChange={setTierFilter} options={filters.tiers} />
                <FilterSelect label="Segment" value={segmentFilter} onChange={setSegmentFilter} options={filters.segments} />
                <FilterSelect label="Preferred channel" value={channelFilter} onChange={setChannelFilter} options={filters.channels} />
                <label className="text-sm font-medium text-slate-600">
                  Review status
                  <select
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value as ReviewStatus | "All")}
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                  >
                    <option value="All">All</option>
                    {REVIEW_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm font-medium text-slate-600">
                  Sort by
                  <select
                    value={sortBy}
                    onChange={(event) => setSortBy(event.target.value as SortOption)}
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                  >
                    {SORT_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm font-medium text-slate-600">
                  Minimum score: {minimumScore}
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={minimumScore}
                    onChange={(event) => setMinimumScore(Number(event.target.value))}
                    className="mt-4 w-full accent-emerald-600"
                  />
                </label>
              </div>

              <div className="mt-4 flex justify-end">
                <button type="button" onClick={resetFilters} className="text-sm font-semibold text-slate-500 hover:text-slate-950">
                  Reset filters
                </button>
              </div>
            </div>

            <div className="overflow-hidden rounded-[1.75rem] border border-white/70 bg-white/90 shadow-xl shadow-emerald-950/5">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-100">
                  <thead className="bg-slate-50/70 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-5 py-4">Rank</th>
                      <th className="px-5 py-4">Person</th>
                      <th className="px-5 py-4">Unify score</th>
                      <th className="px-5 py-4">Final score</th>
                      <th className="px-5 py-4">Final tier</th>
                      <th className="px-5 py-4">FullEnrich email status</th>
                      <th className="px-5 py-4">Enrichment status</th>
                      <th className="px-5 py-4">CRM status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {filteredProspects.map((prospect) => {
                      const id = prospectId(prospect);
                      const enrichmentStatus = enrichmentStates[id]?.status ?? "Not started";
                      const crmStatus = crmStates[id]?.status ?? (isReadyForCrm(id, reviews, qualificationResults) ? "Ready for CRM" : "Not ready");
                      const fullEnrichEmailStatus = emailStatusLabel(fullEnrichRecords[id]?.emailStatus);
                      const selected = selectedProspect && id === prospectId(selectedProspect);

                      return (
                        <tr
                          key={id}
                          onClick={() => setSelectedId(id)}
                          className={`cursor-pointer transition hover:bg-emerald-50/70 ${selected ? "bg-emerald-50" : "bg-white"}`}
                        >
                          <td className="whitespace-nowrap px-5 py-4 font-semibold text-slate-700">#{value(prospect, "New Rank") || "-"}</td>
                          <td className="whitespace-nowrap px-5 py-4">
                            <div className="font-semibold text-slate-950">{value(prospect, "Person") || "Unnamed prospect"}</div>
                            <div className="text-xs text-slate-500">{value(prospect, "Job Title") || "Unknown title"} at {value(prospect, "Company") || "Unknown company"}</div>
                          </td>
                          <td className="whitespace-nowrap px-5 py-4">
                            <span className="text-lg font-semibold text-slate-950">{value(prospect, "Revised Score") || "0"}</span>
                          </td>
                          <td className="whitespace-nowrap px-5 py-4">
                            <span className="text-lg font-semibold text-slate-950">{finalScoreFor(id, prospect, qualificationResults) || "-"}</span>
                          </td>
                          <td className="whitespace-nowrap px-5 py-4">
                            <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${tierBadgeClass(finalTierFor(id, prospect, qualificationResults))}`}>
                              {finalTierFor(id, prospect, qualificationResults) || "Unqualified"}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-5 py-4">
                            <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusPillClass(fullEnrichEmailStatus)}`}>
                              {fullEnrichEmailStatus}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-5 py-4">
                            <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusPillClass(enrichmentStatus)}`}>
                              {enrichmentStatus}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-5 py-4">
                            <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusPillClass(crmStatus)}`}>
                              {crmStatus}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {filteredProspects.length === 0 && (
                <div className="px-6 py-12 text-center text-sm font-medium text-slate-500">
                  No prospects match the current filters.
                </div>
              )}
            </div>
          </div>

          <aside className="lg:sticky lg:top-6 lg:self-start">
            <ProspectDrawer
              prospect={selectedProspect}
              unifyProspect={selectedUnifyProspect}
              status={selectedStatus}
              reviewedAt={selectedReviewedAt}
              enrichmentState={selectedProspect ? enrichmentStates[prospectId(selectedProspect)] : undefined}
              fullEnrichRecord={selectedProspect ? fullEnrichRecords[prospectId(selectedProspect)] : undefined}
              qualification={selectedProspect ? qualificationResults[prospectId(selectedProspect)] : undefined}
              crmState={selectedProspect ? crmStates[prospectId(selectedProspect)] : undefined}
              demoMode={demoMode}
              isReadyForCrm={
                selectedProspect
                  ? isReadyForCrm(prospectId(selectedProspect), reviews, qualificationResults)
                  : false
              }
              onEnrich={() => selectedProspect && enrichProspect(selectedProspect, false)}
              onEnrichAndRequalify={() => selectedProspect && enrichProspect(selectedProspect, true)}
              onRequalify={() => selectedProspect && requalifyProspect(selectedProspect)}
              onApprove={() => setDecision("Approved")}
              onSendToZero={() => selectedProspect && sendToZero(selectedProspect)}
              onRetry={() => selectedProspect && enrichProspect(selectedProspect, true)}
              onReject={() => setDecision("Rejected")}
            />
          </aside>
        </section>
      </div>
    </main>
  );
}

function FilterSelect({
  label,
  value: selectedValue,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="text-sm font-medium text-slate-600">
      {label}
      <select
        value={selectedValue}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
      >
        <option value="All">All</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function ProspectDrawer({
  prospect,
  unifyProspect,
  status,
  reviewedAt,
  enrichmentState,
  fullEnrichRecord,
  qualification,
  crmState,
  demoMode,
  isReadyForCrm,
  onEnrich,
  onEnrichAndRequalify,
  onRequalify,
  onApprove,
  onSendToZero,
  onRetry,
  onReject,
}: {
  prospect?: ProspectRow;
  unifyProspect?: ProspectRow;
  status: ReviewStatus;
  reviewedAt?: string;
  enrichmentState?: EnrichmentState;
  fullEnrichRecord?: NormalizedFullEnrichRecord;
  qualification?: QualificationResult;
  crmState?: CrmState;
  demoMode: boolean;
  isReadyForCrm: boolean;
  onEnrich: () => void;
  onEnrichAndRequalify: () => void;
  onRequalify: () => void;
  onApprove: () => void;
  onSendToZero: () => void;
  onRetry: () => void;
  onReject: () => void;
}) {
  if (!prospect) {
    return (
      <div className="rounded-[1.75rem] border border-white/70 bg-white/90 p-6 shadow-xl shadow-emerald-950/5">
        Select a prospect to review.
      </div>
    );
  }

  const unifyRecord = unifyProspect ?? prospect;
  const id = prospectId(prospect);
  const scoreItems = [
    ["Unify score", value(unifyRecord, "Revised Score")],
    ["Final score", qualification?.finalScore ?? "-"],
    ["Score difference", qualification ? qualification.scoreDifference : "-"],
    ["Mission", qualification?.missionScore ?? value(unifyRecord, "Mission Alignment")],
    ["Network", qualification?.networkScore ?? value(unifyRecord, "Network Effect")],
    ["Communication", qualification?.communicationScore ?? value(unifyRecord, "High-Stakes Email Need")],
  ];
  const sourceUrl = value(unifyRecord, "Source URL");
  const linkedinUrl = fullEnrichRecord?.linkedinUrl || value(unifyRecord, "LinkedIn URL");
  const enrichmentStatus = enrichmentState?.status ?? "Not started";
  const crmStatus = crmState?.status ?? (isReadyForCrm ? "Ready for CRM" : "Not ready");
  const finalTier = qualification?.qualificationTier ?? value(unifyRecord, "Qualification Tier");
  const preferredChannel = qualification?.preferredChannel ?? finalPreferredChannelFor(id, prospect, qualification ? { [id]: qualification } : {});
  const hasQualification = Boolean(qualification);
  const canSendToZero = isReadyForCrm && crmStatus !== "Sending" && crmStatus !== "Sent to Zero";

  return (
    <div className="overflow-hidden rounded-[1.75rem] border border-white/70 bg-white/95 shadow-2xl shadow-emerald-950/10">
      <div className="border-b border-slate-100 bg-slate-950 p-6 text-white">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-emerald-200">Prospect detail</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">{value(prospect, "Person") || "Unnamed prospect"}</h2>
          </div>
          <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${tierBadgeClass(finalTier)}`}>
            {finalTier || "Unqualified"}
          </span>
        </div>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          {value(prospect, "Job Title") || "Unknown title"} at {value(prospect, "Company") || "Unknown company"}
        </p>
        {demoMode && (
          <div className="mt-4 rounded-2xl border border-amber-300/40 bg-amber-300/10 px-4 py-3 text-sm font-semibold text-amber-100">
            Demo mode is on. Simulated results display as Simulated demo data.
          </div>
        )}
      </div>

      <div className="max-h-[calc(100vh-13rem)] overflow-y-auto p-6">
        <div className="grid grid-cols-2 gap-3">
          {scoreItems.map(([label, score]) => (
            <div key={label} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</div>
              <div className="mt-1 text-2xl font-semibold text-slate-950">{score || "0"}</div>
            </div>
          ))}
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Email validation</div>
            <div className="mt-1 text-sm font-semibold text-slate-950">{emailStatusLabel(fullEnrichRecord?.emailStatus)}</div>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Preferred outreach channel</div>
            <div className={`mt-2 inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${channelBadgeClass(preferredChannel)}`}>
              {preferredChannel}
            </div>
          </div>
        </div>

        <DrawerSection title="Unify discovery data">
          <DetailBlock title="Exact public signal" body={value(unifyRecord, "Exact Public Signal")} />
          <DetailBlock title="Direct evidence" body={value(unifyRecord, "Direct Evidence")} />
          <DetailBlock title="Original qualification tier" body={value(unifyRecord, "Qualification Tier")} />
          <DetailBlock title="Position reason" body={value(unifyRecord, "Position Reason")} />
        </DrawerSection>

        <DrawerSection title="FullEnrich contact enrichment">
          <div className="grid gap-3 text-sm">
            <InfoRow label="Status" value={enrichmentStatus} />
            <InfoRow label="Work email" value={fullEnrichRecord?.workEmail || "Not found"} />
            <InfoRow label="Personal email fallback" value={fullEnrichRecord?.personalEmail || "Not found"} />
            <InfoRow label="Email status" value={emailStatusLabel(fullEnrichRecord?.emailStatus)} />
            <InfoRow label="Phone" value={fullEnrichRecord?.phone || "Not found"} />
            <InfoRow label="Company domain" value={fullEnrichRecord?.companyDomain || String(prospect["Company Domain"] ?? "") || "Not found"} />
            <InfoRow label="Location" value={fullEnrichRecord?.location || "Not found"} />
            {(fullEnrichRecord?.isDemo || enrichmentState?.message === "Simulated demo data") && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
                Simulated demo data
              </div>
            )}
          </div>
        </DrawerSection>

        <DrawerSection title="Qualification validation">
          {qualification ? (
            <div className="space-y-4">
              <FindingList title="Mission alignment" findings={qualification.missionEvidence} />
              <FindingList title="Network effect" findings={qualification.networkEvidence} />
              <FindingList title="Communication need" findings={qualification.communicationEvidence} />
              <FindingList title="Evidence quality" findings={qualification.evidenceAssessment} />
              <DetailBlock title="Validation mode" body={qualification.validationMode} />
              {qualification.qualificationWarnings.length > 0 && (
                <DetailBlock title="Warnings" body={qualification.qualificationWarnings.join(" ")} />
              )}
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-500">Run Requalify or Enrich and Requalify to validate this prospect.</p>
          )}
        </DrawerSection>

        <DrawerSection title="Score comparison">
          <InfoRow label="Unify score" value={value(unifyRecord, "Revised Score") || "0"} />
          <InfoRow label="Final validated score" value={qualification ? String(qualification.finalScore) : "Not calculated"} />
          <InfoRow label="Score difference" value={qualification ? String(qualification.scoreDifference) : "Not calculated"} />
          <InfoRow label="Reason for change" value={qualification?.scoreChangeReason || "Not calculated"} />
        </DrawerSection>

        <DrawerSection title="Lightfern use case">
          <DetailBlock title="Use case" body={qualification?.lightfernUseCase || value(unifyRecord, "Inferred Use Case")} />
          <DetailBlock title="Outreach angle" body={qualification?.outreachAngle || value(unifyRecord, "Outreach Angle")} />
        </DrawerSection>

        <DrawerSection title="Preferred outreach channel">
          <div className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${channelBadgeClass(preferredChannel)}`}>
            {preferredChannel}
          </div>
          <p className="mt-2 text-sm text-slate-500">
            Probably valid email is shown with caution and is not treated as fully verified.
          </p>
        </DrawerSection>

        <DrawerSection title="Zero CRM routing">
          <InfoRow label="CRM status" value={crmStatus} />
          <InfoRow label="Final tier" value={finalTier || "Not calculated"} />
          <InfoRow label="Final score" value={qualification ? String(qualification.finalScore) : "Not calculated"} />
          <InfoRow label="Email validation status" value={emailStatusLabel(fullEnrichRecord?.emailStatus)} />
          {crmState?.message && (
            <p className="mt-3 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
              {crmState.message} {crmState.isDemo ? "Simulated demo data" : ""}
            </p>
          )}
        </DrawerSection>

        <DrawerSection title="Source URLs">
          <ExternalLink label="Source URL" href={sourceUrl} />
          <ExternalLink label="LinkedIn URL" href={linkedinUrl} />
        </DrawerSection>

        <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-950">Prospect actions</p>
              <p className="mt-1 text-xs text-slate-500">
                Current status: <span className="font-semibold">{status}</span>
                {reviewedAt ? ` at ${new Date(reviewedAt).toLocaleString()}` : ""}
              </p>
            </div>
          </div>
          <div className="mt-4 grid gap-2">
            <button type="button" onClick={onEnrich} className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100">
              Enrich with FullEnrich
            </button>
            <button type="button" onClick={onEnrichAndRequalify} className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-950/15 transition hover:bg-slate-800">
              Enrich and Requalify
            </button>
            <button type="button" onClick={onRequalify} className="rounded-2xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm font-semibold text-teal-800 transition hover:bg-teal-100">
              Requalify
            </button>
            <button type="button" onClick={onApprove} disabled={!hasQualification} className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">
              Approve
            </button>
            <button type="button" onClick={onSendToZero} disabled={!canSendToZero} className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-800 transition hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-50">
              Send to Zero
            </button>
            <button type="button" onClick={onRetry} className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800 transition hover:bg-amber-100">
              Retry
            </button>
            <button type="button" onClick={onReject} className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800 transition hover:bg-rose-100">
              Reject
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DrawerSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 rounded-3xl border border-slate-100 bg-white p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function InfoRow({ label, value: rowValue }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
      <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</span>
      <span className="text-right text-sm font-semibold text-slate-800">{rowValue || "Not available"}</span>
    </div>
  );
}

function FindingList({ title, findings }: { title: string; findings: QualificationResult["missionEvidence"] }) {
  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</h4>
      <div className="mt-2 space-y-2">
        {findings.map((finding, index) => (
          <div key={`${title}-${index}`} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <span className="font-semibold text-slate-950">{finding.label}:</span> {finding.finding}
          </div>
        ))}
      </div>
    </div>
  );
}

function DetailBlock({ title, body }: { title: string; body: string }) {
  return (
    <section className="mt-5">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-700">{body || "No value provided."}</p>
    </section>
  );
}

function ExternalLink({ label, href }: { label: string; href: string }) {
  if (!href) {
    return (
      <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-500">
        {label}: Not available
      </div>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100"
    >
      {label}
    </a>
  );
}
