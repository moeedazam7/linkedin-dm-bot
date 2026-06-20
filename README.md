# Lightfern Champion Radar

A polished single-page Next.js application for reviewing, prioritising, and activating potential Lightfern product champions identified through Unify.

## Features

- CSV import with required-column validation
- 40-row sample dataset as a fallback
- Prospect filtering and sorting by tier, segment, channel, status, score, rank, and signal strength
- Detailed prospect drawer with score breakdown, evidence, URLs, channel routing, and review controls
- Browser-only review decisions with Approved, Needs Review, and Rejected states
- Approved-prospect CSV export that preserves original fields and adds `review_status` and `reviewed_at`

## Run locally

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.