"use client";

import Papa from "papaparse";
import { ChangeEvent, useEffect, useMemo, useState } from "react";

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

const REVIEW_STATUSES = [
  "Unreviewed",
  "Approved",
  "Needs Review",
  "Rejected",
] as const;

type ProspectRow = Record<string, string>;
type RequiredColumn = (typeof REQUIRED_COLUMNS)[number];
type SortOption = (typeof SORT_OPTIONS)[number];
type ReviewStatus = (typeof REVIEW_STATUSES)[number];

type ReviewDecision = {
  status: ReviewStatus;
  reviewedAt?: string;
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
      Person: entry.person,
      Email: hasEmail ? `${firstName}.${lastName}@${companySlug(entry.company)}.com` : "",
      "LinkedIn URL": `https://www.linkedin.com/in/${personSlug(entry.person)}`,
      Company: entry.company,
      "Job Title": entry.title,
      Segment: entry.segment,
      "Mission Alignment": String(mission),
      "Network Effect": String(network),
      "High-Stakes Email Need": String(highStakes),
      "Evidence Strength": String(evidence),
      "Exact Public Signal": `${entry.person} ${signal}.`,
      "Source URL": `https://example.com/signals/${personSlug(entry.person)}`,
      "Direct Evidence": `${entry.person} has publicly discussed ${signal.replace("published ", "").replace("posted about ", "")} and owns a relationship-heavy GTM motion.`,
      "Inferred Use Case": `Use Lightfern to turn warm network context into credible, high-trust outreach for ${entry.segment.toLowerCase()} buyers and partners.`,
      "Outreach Angle": `Lead with the public signal, then offer a concise champion workflow that helps ${entry.company} activate warm introductions without generic sequencing.`,
      "Preferred Channel": hasEmail ? "Email" : "LinkedIn",
      "New Rank": String(index + 1),
      "Revised Score": String(score),
      "Qualification Tier": tier,
      "Position Reason": `${tier} because the role combines mission alignment, network leverage, email urgency, and verifiable public evidence.`,
    };
  });
}

const INITIAL_PROSPECTS = makeSampleProspects();

function value(row: ProspectRow, column: RequiredColumn) {
  return String(row[column] ?? "").trim();
}

function numericValue(row: ProspectRow, column: RequiredColumn) {
  const parsed = Number(value(row, column));
  return Number.isFinite(parsed) ? parsed : 0;
}

function prospectId(row: ProspectRow) {
  return (
    value(row, "Email").toLowerCase() ||
    value(row, "LinkedIn URL").toLowerCase() ||
    `${value(row, "Person")}-${value(row, "Company")}`.toLowerCase()
  );
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

function downloadCsv(filename: string, rows: ProspectRow[]) {
  const csv = Papa.unparse(rows);
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
  const [sourceName, setSourceName] = useState("Sample fallback data");
  const [selectedId, setSelectedId] = useState(prospectId(INITIAL_PROSPECTS[0]));
  const [tierFilter, setTierFilter] = useState("All");
  const [segmentFilter, setSegmentFilter] = useState("All");
  const [channelFilter, setChannelFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState<ReviewStatus | "All">("All");
  const [minimumScore, setMinimumScore] = useState(0);
  const [sortBy, setSortBy] = useState<SortOption>("New Rank");
  const [reviews, setReviews] = useState<Record<string, ReviewDecision>>({});
  const [validationError, setValidationError] = useState("");
  const [notice, setNotice] = useState("");

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

  const summary = useMemo(
    () => ({
      analysed: prospects.length,
      priority: prospects.filter((row) => value(row, "Qualification Tier").toLowerCase().includes("priority")).length,
      strong: prospects.filter((row) => value(row, "Qualification Tier").toLowerCase().includes("strong")).length,
      emailReady: prospects.filter((row) => Boolean(value(row, "Email"))).length,
      linkedinOnly: prospects.filter((row) => !value(row, "Email") && Boolean(value(row, "LinkedIn URL"))).length,
    }),
    [prospects],
  );

  const filters = useMemo(
    () => ({
      tiers: uniqueValues(prospects, "Qualification Tier"),
      segments: uniqueValues(prospects, "Segment"),
      channels: Array.from(new Set(prospects.map(effectiveChannel).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b),
      ),
    }),
    [prospects],
  );

  const filteredProspects = useMemo(() => {
    return [...prospects]
      .filter((row) => tierFilter === "All" || value(row, "Qualification Tier") === tierFilter)
      .filter((row) => segmentFilter === "All" || value(row, "Segment") === segmentFilter)
      .filter((row) => channelFilter === "All" || effectiveChannel(row) === channelFilter)
      .filter((row) => {
        const status = reviews[prospectId(row)]?.status ?? "Unreviewed";
        return statusFilter === "All" || status === statusFilter;
      })
      .filter((row) => numericValue(row, "Revised Score") >= minimumScore)
      .sort((a, b) => {
        if (sortBy === "New Rank") {
          return numericValue(a, sortBy) - numericValue(b, sortBy);
        }
        return numericValue(b, sortBy) - numericValue(a, sortBy);
      });
  }, [channelFilter, minimumScore, prospects, reviews, segmentFilter, sortBy, statusFilter, tierFilter]);

  function setDecision(status: ReviewStatus) {
    if (!selectedProspect) {
      return;
    }

    setReviews((current) => ({
      ...current,
      [prospectId(selectedProspect)]: {
        status,
        reviewedAt: new Date().toISOString(),
      },
    }));
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
      transformHeader: (header) => header.replace(/^\uFEFF/, "").trim(),
      complete: (results) => {
        const fields = results.meta.fields?.map((field) => field.trim()).filter(Boolean) ?? [];
        const missingColumns = REQUIRED_COLUMNS.filter((column) => !fields.includes(column));

        if (missingColumns.length > 0) {
          setValidationError(`CSV is missing required column${missingColumns.length === 1 ? "" : "s"}: ${missingColumns.join(", ")}.`);
          event.target.value = "";
          return;
        }

        const rows = results.data
          .filter((row) => fields.some((field) => String(row[field] ?? "").trim() !== ""))
          .map((row) => {
            const normalized: ProspectRow = {};
            fields.forEach((field) => {
              normalized[field] = String(row[field] ?? "").trim();
            });
            REQUIRED_COLUMNS.forEach((column) => {
              normalized[column] = normalized[column] ?? "";
            });
            return normalized;
          });

        if (rows.length === 0) {
          setValidationError("CSV has the required columns, but no prospect rows to review.");
          event.target.value = "";
          return;
        }

        setProspects(rows);
        setSourceName(file.name);
        setSelectedId(prospectId(rows[0]));
        resetFilters();
        setNotice(`${rows.length} prospects imported from ${file.name}.`);
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

        <section className="grid gap-4 md:grid-cols-5">
          {[
            { label: "prospects analysed", value: summary.analysed },
            { label: "Priority Champions", value: summary.priority },
            { label: "Strong Prospects", value: summary.strong },
            { label: "email-ready", value: summary.emailReady },
            { label: "LinkedIn-only", value: summary.linkedinOnly },
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
                  <label className="inline-flex cursor-pointer items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100">
                    Import CSV
                    <input className="sr-only" type="file" accept=".csv,text/csv" onChange={handleCsvUpload} />
                  </label>
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
                      <th className="px-5 py-4">Job title and company</th>
                      <th className="px-5 py-4">Segment</th>
                      <th className="px-5 py-4">Revised score</th>
                      <th className="px-5 py-4">Qualification tier</th>
                      <th className="px-5 py-4">Preferred channel</th>
                      <th className="px-5 py-4">Review status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {filteredProspects.map((prospect) => {
                      const id = prospectId(prospect);
                      const status = reviews[id]?.status ?? "Unreviewed";
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
                            <div className="text-xs text-slate-500">{value(prospect, "Email") || "No email captured"}</div>
                          </td>
                          <td className="min-w-64 px-5 py-4 text-slate-600">
                            <div>{value(prospect, "Job Title") || "Unknown title"}</div>
                            <div className="text-xs font-medium text-slate-400">{value(prospect, "Company") || "Unknown company"}</div>
                          </td>
                          <td className="whitespace-nowrap px-5 py-4 text-slate-600">{value(prospect, "Segment") || "-"}</td>
                          <td className="whitespace-nowrap px-5 py-4">
                            <span className="text-lg font-semibold text-slate-950">{value(prospect, "Revised Score") || "0"}</span>
                          </td>
                          <td className="whitespace-nowrap px-5 py-4">
                            <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${tierBadgeClass(value(prospect, "Qualification Tier"))}`}>
                              {value(prospect, "Qualification Tier") || "Unqualified"}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-5 py-4">
                            <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${channelBadgeClass(effectiveChannel(prospect))}`}>
                              {effectiveChannel(prospect)}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-5 py-4">
                            <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${reviewBadgeClass(status)}`}>
                              {status}
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
              status={selectedStatus}
              reviewedAt={selectedReviewedAt}
              onApprove={() => setDecision("Approved")}
              onNeedsReview={() => setDecision("Needs Review")}
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
  status,
  reviewedAt,
  onApprove,
  onNeedsReview,
  onReject,
}: {
  prospect?: ProspectRow;
  status: ReviewStatus;
  reviewedAt?: string;
  onApprove: () => void;
  onNeedsReview: () => void;
  onReject: () => void;
}) {
  if (!prospect) {
    return (
      <div className="rounded-[1.75rem] border border-white/70 bg-white/90 p-6 shadow-xl shadow-emerald-950/5">
        Select a prospect to review.
      </div>
    );
  }

  const scoreItems = [
    ["Mission Alignment", value(prospect, "Mission Alignment")],
    ["Network Effect", value(prospect, "Network Effect")],
    ["High-Stakes Email Need", value(prospect, "High-Stakes Email Need")],
    ["Evidence Strength", value(prospect, "Evidence Strength")],
    ["Revised Score", value(prospect, "Revised Score")],
  ];
  const sourceUrl = value(prospect, "Source URL");
  const linkedinUrl = value(prospect, "LinkedIn URL");

  return (
    <div className="overflow-hidden rounded-[1.75rem] border border-white/70 bg-white/95 shadow-2xl shadow-emerald-950/10">
      <div className="border-b border-slate-100 bg-slate-950 p-6 text-white">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-emerald-200">Prospect detail</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">{value(prospect, "Person") || "Unnamed prospect"}</h2>
          </div>
          <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${tierBadgeClass(value(prospect, "Qualification Tier"))}`}>
            {value(prospect, "Qualification Tier") || "Unqualified"}
          </span>
        </div>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          {value(prospect, "Job Title") || "Unknown title"} at {value(prospect, "Company") || "Unknown company"}
        </p>
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
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Email availability</div>
            <div className="mt-1 text-sm font-semibold text-slate-950">{value(prospect, "Email") || "No email - LinkedIn only"}</div>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Preferred outreach</div>
            <div className={`mt-2 inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${channelBadgeClass(effectiveChannel(prospect))}`}>
              {effectiveChannel(prospect)}
            </div>
          </div>
        </div>

        <DetailBlock title="Exact public signal" body={value(prospect, "Exact Public Signal")} />
        <DetailBlock title="Direct evidence" body={value(prospect, "Direct Evidence")} />
        <DetailBlock title="Inferred Lightfern use case" body={value(prospect, "Inferred Use Case")} />
        <DetailBlock title="Position reason" body={value(prospect, "Position Reason")} />
        <DetailBlock title="Outreach angle" body={value(prospect, "Outreach Angle")} />

        <div className="mt-5 grid gap-3">
          <ExternalLink label="Source URL" href={sourceUrl} />
          <ExternalLink label="LinkedIn URL" href={linkedinUrl} />
        </div>

        <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-950">Review controls</p>
              <p className="mt-1 text-xs text-slate-500">
                Current status: <span className="font-semibold">{status}</span>
                {reviewedAt ? ` at ${new Date(reviewedAt).toLocaleString()}` : ""}
              </p>
            </div>
          </div>
          <div className="mt-4 grid gap-2">
            <button type="button" onClick={onApprove} className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-700">
              Approve
            </button>
            <button type="button" onClick={onNeedsReview} className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800 transition hover:bg-amber-100">
              Needs Review
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
