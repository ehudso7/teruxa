# Brand Guidelines

## Core Identity

- **Brand Name**: Teruxa
- **Product Name**: Teruxa UGC Ops
- **Short Name**: Teruxa
- **Descriptor**: UGC Ops

## Voice & Tone

### Use Plain Product Language
We use straightforward, functional language that describes what the product does:
- ✅ "Create angles from seed data"
- ✅ "Localize content for multiple platforms"
- ✅ "Build packs for distribution"
- ✅ "Iterate based on performance"

### Avoid Marketing Hype
We avoid overly promotional or trendy language:
- ❌ "AI Content Factory"
- ❌ "Hyper-optimized creative engine"
- ❌ "Ultimate UGC solution"
- ❌ "God-tier content generation"

## UI Wording Guidelines

### Navigation & Features
- **Projects** - Where users manage their UGC campaigns
- **Create** - Generate angle cards from product data
- **Localize** - Adapt content for different markets
- **Build Packs** - Bundle localized content
- **Performance** - Track metrics and iterate

### Action Labels
- Use imperative verbs: "Create Project", "Generate Angles", "Export Pack"
- Keep it simple: "Save", "Cancel", "Delete", "Edit"
- Be specific: "Import CSV", not just "Import"

### Status Indicators
- draft
- in_review
- approved
- archived

## Banned Phrases

These terms should NOT appear in the product:
- "forge" or "AngleForge"
- "hyper" anything
- "ultimate" anything
- "god-tier" anything
- "AI Content Factory"
- "Winner Loop" (use "Performance Iteration" or "Iterate Winners")
- "Angle Engine" (use "Angle Generation" or just "Create")
- "UGC Localizer" as a standalone product name

## Technical Naming

### Package Names
- Root: `teruxa`
- Backend: `@ugc/backend` (internal scope, unchanged)
- Frontend: `@ugc/frontend` (internal scope, unchanged)

### Database
- Database name: `teruxa`
- Schema: `public`

### Environment Variables
Keep existing variable names for compatibility, only change display values.

## Acceptable Variations

These are acceptable when referring to the product:
- Teruxa
- Teruxa UGC Ops
- UGC Ops (when context is clear)

## Implementation Notes

1. HTML title tags should use full name: "Teruxa UGC Ops"
2. Navigation headers can use short name: "Teruxa"
3. Feature descriptions should use plain language
4. API endpoints remain unchanged (no breaking changes)
5. Internal package scopes remain as @ugc/ for workspace compatibility