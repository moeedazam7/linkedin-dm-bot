const FULLENRICH_BASE_URL = "https://app.fullenrich.com/api/v2";
const FULLENRICH_PROVIDER = process.env.FULLENRICH_PROVIDER ?? "fullenrich";

export type FullEnrichEmailStatus = "valid" | "probably_valid" | "invalid" | "not_found";
export type FullEnrichStatus =
  | "queued"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled"
  | "insufficient_credit";

export type FullEnrichStartInput = {
  prospectId: string;
  person: string;
  firstName: string;
  lastName: string;
  email: string;
  company: string;
  companyDomain: string;
  jobTitle: string;
  linkedinUrl: string;
};

export type NormalizedFullEnrichRecord = {
  prospectId: string;
  enrichmentId: string;
  status: FullEnrichStatus;
  workEmail: string;
  personalEmail: string;
  emailStatus: FullEnrichEmailStatus;
  phone: string;
  linkedinUrl: string;
  firstName: string;
  lastName: string;
  jobTitle: string;
  company: string;
  companyDomain: string;
  location: string;
  enrichedAt: string;
  rawProvider: "fullenrich";
  isDemo?: boolean;
};

type FullEnrichContact = {
  first_name?: string;
  last_name?: string;
  domain?: string;
  company_name?: string;
  linkedin_url?: string;
  enrich_fields: string[];
  custom: {
    prospect_id: string;
  };
};

type FullEnrichEmail = {
  email?: string;
  status?: string;
};

type FullEnrichResult = {
  id?: string;
  status?: string;
  data?: Array<{
    custom?: Record<string, string>;
    contact_info?: {
      most_probable_work_email?: FullEnrichEmail;
      most_probable_personal_email?: FullEnrichEmail;
      most_probable_phone?: { number?: string };
      work_emails?: FullEnrichEmail[];
      personal_emails?: FullEnrichEmail[];
      phones?: Array<{ number?: string }>;
    };
    profile?: {
      first_name?: string;
      last_name?: string;
      full_name?: string;
      location?: {
        city?: string;
        region?: string;
        country?: string;
      };
      social_profiles?: {
        professional_network?: {
          url?: string;
        };
      };
      employment?: {
        current?: {
          title?: string;
          company?: {
            name?: string;
            domain?: string;
          };
        };
      };
    };
  }>;
};

export function splitName(person: string) {
  const parts = person.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] ?? "",
    lastName: parts.length > 1 ? parts.slice(1).join(" ") : "",
  };
}

export function deriveDomainFromEmail(email: string) {
  const domain = email.split("@")[1]?.trim().toLowerCase() ?? "";
  return domain.includes(".") ? domain : "";
}

function apiKey() {
  return process.env.FULLENRICH_API_KEY?.trim() ?? "";
}

export function isFullEnrichConfigured() {
  return Boolean(apiKey());
}

export function buildContact(input: FullEnrichStartInput) {
  const personNames = splitName(input.person);
  const firstName = input.firstName || personNames.firstName;
  const lastName = input.lastName || personNames.lastName;
  const domain = input.companyDomain || deriveDomainFromEmail(input.email);
  const contact: FullEnrichContact = {
    enrich_fields: ["contact.work_emails", "contact.personal_emails", "contact.phones"],
    custom: {
      prospect_id: input.prospectId,
    },
  };

  if (input.linkedinUrl) {
    contact.linkedin_url = input.linkedinUrl;
    if (firstName) contact.first_name = firstName;
    if (lastName) contact.last_name = lastName;
    if (domain) contact.domain = domain;
    if (input.company) contact.company_name = input.company;
    return contact;
  }

  if (firstName && lastName && domain) {
    contact.first_name = firstName;
    contact.last_name = lastName;
    contact.domain = domain;
    if (input.company) contact.company_name = input.company;
    return contact;
  }

  if (firstName && lastName && input.company) {
    contact.first_name = firstName;
    contact.last_name = lastName;
    contact.company_name = input.company;
    return contact;
  }

  return null;
}

async function fullEnrichFetch(path: string, init: RequestInit = {}) {
  const key = apiKey();
  if (!key) {
    throw new Error("FullEnrich is not configured.");
  }

  const response = await fetch(`${FULLENRICH_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      ...init.headers,
    },
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof body?.message === "string" ? body.message : "FullEnrich request failed.";
    const code = typeof body?.code === "string" ? body.code : String(response.status);
    throw new Error(`${code}: ${message}`);
  }

  return body;
}

export async function startFullEnrichBulk(input: FullEnrichStartInput) {
  const contact = buildContact(input);
  if (!contact) {
    return {
      success: false,
      error: "Insufficient identifying information for FullEnrich.",
    };
  }

  const body = {
    name: `Lightfern - ${input.person || input.prospectId}`,
    providers: [FULLENRICH_PROVIDER],
    data: [contact],
  };

  const response = await fullEnrichFetch("/contact/enrich/bulk?silentFail=true", {
    method: "POST",
    body: JSON.stringify(body),
  });

  return {
    success: true,
    enrichmentId: String(response.enrichment_id ?? response.id ?? ""),
    status: "enrichment_started" as const,
  };
}

function normalizeProviderStatus(status?: string): FullEnrichStatus {
  switch ((status ?? "").toUpperCase()) {
    case "CREATED":
      return "queued";
    case "IN_PROGRESS":
    case "RATE_LIMIT":
      return "processing";
    case "FINISHED":
      return "completed";
    case "CANCELED":
    case "CANCELLED":
      return "cancelled";
    case "CREDITS_INSUFFICIENT":
      return "insufficient_credit";
    default:
      return "failed";
  }
}

function normalizeEmailStatus(status?: string): FullEnrichEmailStatus {
  switch ((status ?? "").toUpperCase()) {
    case "DELIVERABLE":
      return "valid";
    case "HIGH_PROBABILITY":
    case "CATCH_ALL":
      return "probably_valid";
    case "INVALID":
    case "INVALID_DOMAIN":
      return "invalid";
    default:
      return "not_found";
  }
}

function bestEmail(primary?: FullEnrichEmail, all: FullEnrichEmail[] = []) {
  const candidates = [primary, ...all].filter((email): email is FullEnrichEmail => Boolean(email?.email));
  return (
    candidates.find((email) => normalizeEmailStatus(email.status) === "valid") ??
    candidates.find((email) => normalizeEmailStatus(email.status) === "probably_valid") ??
    candidates[0]
  );
}

export async function getFullEnrichStatus(enrichmentId: string, prospectId: string) {
  const response = (await fullEnrichFetch(`/contact/enrich/bulk/${encodeURIComponent(enrichmentId)}`)) as FullEnrichResult;
  return normalizeFullEnrichResult(response, enrichmentId, prospectId);
}

export function normalizeFullEnrichResult(
  response: FullEnrichResult,
  enrichmentId: string,
  prospectId: string,
): NormalizedFullEnrichRecord {
  const providerStatus = normalizeProviderStatus(response.status);
  const record =
    response.data?.find((item) => item.custom?.prospect_id === prospectId) ??
    response.data?.[0];
  const contactInfo = record?.contact_info;
  const profile = record?.profile;
  const currentEmployment = profile?.employment?.current;
  const workEmail = bestEmail(contactInfo?.most_probable_work_email, contactInfo?.work_emails);
  const personalEmail = bestEmail(contactInfo?.most_probable_personal_email, contactInfo?.personal_emails);
  const workStatus = normalizeEmailStatus(workEmail?.status);
  const personalStatus = normalizeEmailStatus(personalEmail?.status);
  const location = [profile?.location?.city, profile?.location?.region, profile?.location?.country]
    .filter(Boolean)
    .join(", ");

  return {
    prospectId,
    enrichmentId: response.id ?? enrichmentId,
    status: providerStatus,
    workEmail: workEmail?.email ?? "",
    personalEmail: personalEmail?.email ?? "",
    emailStatus: workEmail?.email ? workStatus : personalEmail?.email ? personalStatus : "not_found",
    phone: contactInfo?.most_probable_phone?.number ?? contactInfo?.phones?.find((phone) => phone.number)?.number ?? "",
    linkedinUrl: profile?.social_profiles?.professional_network?.url ?? "",
    firstName: profile?.first_name ?? "",
    lastName: profile?.last_name ?? "",
    jobTitle: currentEmployment?.title ?? "",
    company: currentEmployment?.company?.name ?? "",
    companyDomain: currentEmployment?.company?.domain ?? "",
    location,
    enrichedAt: providerStatus === "completed" ? new Date().toISOString() : "",
    rawProvider: "fullenrich",
  };
}

export function demoFullEnrichRecord(prospectId: string, enrichmentId: string): NormalizedFullEnrichRecord {
  const timestamp = new Date().toISOString();
  return {
    prospectId,
    enrichmentId,
    status: "completed",
    workEmail: `simulated.${prospectId.replace(/[^a-z0-9]/gi, "").slice(0, 16).toLowerCase()}@example.com`,
    personalEmail: "",
    emailStatus: "probably_valid",
    phone: "",
    linkedinUrl: "",
    firstName: "",
    lastName: "",
    jobTitle: "",
    company: "",
    companyDomain: "",
    location: "",
    enrichedAt: timestamp,
    rawProvider: "fullenrich",
    isDemo: true,
  };
}
