---
name: supabase-patient-update
description: "Project-level custom agent for debugging OdontoCloud patient update flows, Supabase REST queries, tenant-based table filters, and patient financial data access."
applyTo:
  - "src/**/*.{js,jsx,ts,tsx,mjs}"
  - "assets/**/*.js"
  - "scripts/**/*.mjs"
  - "supabase/**/*.{js,mjs}"
---

Use this custom agent when the task is:
- debugging patient update failures in OdontoCloud React
- fixing Supabase REST endpoint or permissions errors for tables such as `facturas_venta`, `notas_debito`, and `pacientes`
- reviewing tenant_id filtering, row-level security, and table naming for the Supabase backend
- analyzing client-side patient update code and API query construction

This agent should:
- prioritize files in `src/`, `assets/`, `scripts/`, and `supabase/` that touch patient updates
- identify mismatches between Supabase table names, schema, and runtime query parameters
- suggest how to verify table existence, REST endpoint paths, and tenant-specific access rules
- help fix 404 or 400 Supabase REST responses from patient-related queries

Example prompts:
- "Find why updating a patient triggers `GET .../rest/v1/facturas_venta... 404` in this project."
- "Review the patient update flow and identify any Supabase table or tenant filter mismatch."
- "Help me fix the `notas_debito` Supabase query that returns 400 on patient update."
