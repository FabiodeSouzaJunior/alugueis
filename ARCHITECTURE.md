# ARCHITECTURE

## 1. Purpose

This document is the architectural source of truth for this project.

It defines the required target architecture for all new code and for every refactor. The project must evolve toward:

- Frontend as a **feature-based architecture**
- Backend as a **modular monolith**
- Strict separation of concerns
- API-only communication between frontend and backend
- Predictable, testable, and maintainable code

When existing code conflicts with this document, this document wins.

## 2. Scope

This project is a Next.js App Router application with UI pages, route handlers, shared UI primitives, and domain APIs for areas such as:

- auth
- tenants
- properties
- payments
- maintenance
- expenses
- water-energy
- obras
- condominium
- crm
- crm-intelligence
- notifications
- evaluations
- search
- dashboard and reporting

These business areas are the architectural units of the system.

## 3. Global Rules

- Business logic must live in domain-specific units, never in pages and never in framework glue.
- The codebase must be organized around business capabilities, not around technical file types.
- Every module and every feature must expose a narrow public API.
- Internal implementation details must stay private to the owning feature or module.
- Shared code must be minimal, generic, and domain-agnostic.
- DTOs are the contract between backend and frontend.
- Database shape is not an API contract.
- UI state and domain state must not be mixed arbitrarily.
- A large file with mixed concerns is always a design smell and must be decomposed.

## 4. Canonical Top-Level Structure

```text
app/
  (public)/
    login/
  (app)/
    dashboard/
    inquilinos/
    imoveis/
    pagamentos/
    manutencao/
    despesas/
    agua-luz/
    obras/
    condominio/
    crm/
    notifications/
    relatorios/
  api/
    auth/
    tenants/
    properties/
    payments/
    maintenance/
    expenses/
    water-energy/
    obras/
    condominium/
    crm/
    crm-intelligence/
    notifications/
    resident-evaluations/
    search/

features/
  auth/
  tenants/
  properties/
  payments/
  maintenance/
  expenses/
  water-energy/
  obras/
  condominium/
  crm/
  crm-intelligence/
  notifications/
  evaluations/
  dashboard/
  reports/

server/
  core/
  modules/
    auth/
    tenants/
    properties/
    payments/
    maintenance/
    expenses/
    water-energy/
    obras/
    condominium/
    crm/
    crm-intelligence/
    notifications/
    evaluations/
    search/
    dashboard/
    reporting/

shared/
  ui/
  hooks/
  lib/
  types/
  constants/
```

## 5. Frontend Architecture

### 5.1 Frontend Rule

The frontend must be organized by **feature**, not by technical category.

The current `components/` structure is transitional. New feature code must not be added to global technical buckets such as `components/forms`, `components/dashboard`, or `lib/api.js` when that code belongs to a specific domain.

### 5.2 Frontend Feature Structure

Each feature must be isolated and self-contained.

```text
features/
  tenants/
    components/
      TenantList.jsx
      TenantForm.jsx
      TenantStatusBadge.jsx
    hooks/
      useTenants.js
      useTenantMutations.js
    services/
      tenants.service.js
    types/
      tenant.types.js
    utils/
      tenant-formatters.js
      tenant-validators.js
    index.js
```

### 5.3 Frontend Layer Responsibilities

- `components`: presentation only; render UI from props; no direct API access; no domain orchestration.
- `hooks`: feature logic, state composition, side effects, view-model shaping, cache coordination.
- `services`: HTTP calls only; no rendering logic; no component state; no DOM concerns.
- `types`: DTO types, view-model types, form types, and feature-specific contracts.
- `utils`: pure, stateless helpers local to the feature.

### 5.4 Shared Frontend Code

The `shared/` layer exists only for cross-feature generic assets.

Allowed in `shared/`:

- UI primitives
- generic hooks
- formatting helpers with no domain ownership
- app-wide constants
- transport utilities

Forbidden in `shared/`:

- tenant rules
- payment rules
- property rules
- any domain orchestration
- feature-specific validation
- feature-specific API calls

### 5.5 Pages in `app/`

Pages are composition entry points only.

Pages may:

- read route params
- read search params
- compose feature screens
- provide layout-level wiring

Pages must not:

- call `fetch` directly for domain data
- contain business rules
- contain mutation workflows
- transform backend data inline beyond trivial presentation mapping
- own large modal workflows or complex orchestration

### 5.6 Frontend Communication Rules

- A feature may import from `shared/`.
- A feature may import from another feature only through that feature's public API (`index.js`).
- A feature must never import another feature's internal files.
- Cross-feature orchestration belongs in a page-level composition layer or in a dedicated orchestration hook, never in a random component.
- A feature service must talk only to backend API endpoints.
- A component must never call backend APIs directly.

### 5.7 Frontend Contract Rules

- Feature services consume and return DTO-shaped data.
- Hooks may map DTOs into view models.
- Components receive view models or explicit props, not raw transport responses.
- Form payloads must be explicit types, not ad hoc objects assembled inline in JSX.

### 5.8 Frontend Anti-Patterns

The following must never be introduced:

- feature code placed in generic folders because it was “convenient”
- page files containing fetch, mutation, filtering, formatting, modal control, and rendering all together
- direct use of `fetch` inside components
- domain logic inside `shared/ui` or generic utility folders
- a single `lib/api.js` accumulating all domain endpoints indefinitely
- one hook serving multiple unrelated domains
- components importing database helpers or backend-only code
- exposing another feature's internal hooks, utils, or services
- giant components with mixed layout, state, API, validation, and mutation logic

## 6. Backend Architecture

### 6.1 Backend Rule

The backend must be a **modular monolith**.

A module owns its domain logic, data access, transport mapping, and contracts. Modules live in one deployable application, but their boundaries must be treated as if they were independent services.

### 6.2 Backend Module Structure

```text
server/
  modules/
    tenants/
      controller/
        tenants.controller.js
      service/
        tenants.service.js
      repository/
        tenants.repository.js
      model/
        tenant.model.js
      dto/
        create-tenant.dto.js
        update-tenant.dto.js
        tenant-response.dto.js
      index.js
```

### 6.3 Backend Layer Responsibilities

- `controller`: transport only; parse request; validate input shape; call service; map response to HTTP.
- `service`: business logic only; enforce rules; coordinate use cases; manage transactions and domain workflows.
- `repository`: data access only; SQL, Supabase, or persistence-specific code.
- `model`: domain entities, aggregates, value objects, and invariants that are not transport concerns.
- `dto`: input and output contracts exposed at module boundaries.

### 6.4 Framework Boundary

`app/api/**/route.js` is framework glue, not a business layer.

Route handlers must only:

- build request context
- call the corresponding controller
- return the controller response

Route handlers must not:

- contain SQL
- call Supabase directly
- coordinate workflows across repositories
- send notifications directly
- compute domain rules inline

### 6.5 Request Flow

The request flow is mandatory:

1. `app/api/.../route.js` receives the HTTP request.
2. The route delegates to the module controller.
3. The controller validates and maps the transport payload into DTOs.
4. The service executes the use case.
5. The repository reads or writes persistence data.
6. The service maps domain results into response DTOs.
7. The controller returns the HTTP response.

No layer may skip the layer below it.

### 6.6 Dependency Boundaries

- Controller depends on service and DTOs.
- Service depends on repositories, models, and other modules only through explicit public interfaces.
- Repository depends on database adapters and persistence tooling.
- Repository must not depend on controller.
- Repository must not contain business decisions.
- Controller must not know database details.
- Modules must not reach into another module's repository directly.
- Cross-module access must happen through the other module's exported service facade or through domain events.

### 6.7 Backend Core

`server/core/` contains only cross-cutting technical infrastructure.

Allowed examples:

- database clients
- transaction helpers
- auth context resolution
- error abstractions
- logging
- validation primitives

Forbidden in `server/core/`:

- tenant-specific logic
- property-specific queries
- payment generation rules
- notification policies

### 6.8 Backend Anti-Patterns

The following must never be introduced:

- controller calling repository directly for business use cases
- controller containing workflow logic
- repository sending notifications
- repository performing validation beyond persistence constraints
- service returning raw database rows as API responses
- shared `lib/` becoming the default place for all business logic
- one route handler owning the full use case end to end
- SQL or Supabase logic duplicated across routes
- cross-module writes performed by bypassing the owning module
- database adapter behavior treated as domain behavior

## 7. Frontend and Backend Interaction

- Frontend communicates with backend through HTTP API endpoints only.
- Frontend must never import backend services, repositories, database helpers, or models.
- Backend must expose DTO contracts; frontend consumes those contracts through feature services.
- DTOs must be explicit and stable.
- Backend response mapping must happen before the response leaves the controller boundary.
- Frontend must not rely on hidden fields, database column names, or persistence-only semantics.
- Breaking contract changes require coordinated updates on both sides.

## 8. Domain Ownership

Each business capability has one owner module and one owner feature.

Examples:

- `tenants` owns tenant lifecycle and tenant-facing tenant data
- `properties` owns properties and units
- `payments` owns payment records and payment generation workflows
- `notifications` owns notification creation, preferences, and read state
- `obras` owns obra aggregates, stages, materials, workers, costs, and agenda
- `condominium` owns condominium calculations and distributions

If a rule primarily belongs to one domain, it must live there even if other areas use it.

## 9. Code Rules

- Functions must be small and single-purpose.
- Each file must have one clear reason to change.
- Naming must reflect business intent, not implementation shortcuts.
- Duplication must be removed at the right boundary, not hidden in generic helpers prematurely.
- Complex branching must be extracted into named functions.
- Validation must be explicit.
- Side effects must be isolated.
- Public APIs must be minimal.
- Readability is preferred over cleverness.
- Implicit coupling is forbidden.

## 10. Critical Anti-Patterns

These are explicitly forbidden across the codebase:

- business logic in page components
- business logic in route handlers
- database access in frontend code
- UI rendering in services or repositories
- transport DTOs reused as database models without mapping
- domain logic placed in catch-all folders such as `lib/`, `utils/`, or `helpers/`
- adding new domain code to legacy global files instead of creating a feature or module
- circular dependencies between features or modules
- cross-feature imports into internal folders
- cross-module imports into internal folders
- using shared folders to bypass architectural boundaries
- changing behavior during refactor without explicit requirement

## 11. Refactoring Guidelines for AI

When refactoring, the AI must follow these rules:

- Do not change observable behavior unless explicitly requested.
- Improve structure first, then improve naming, then improve locality of logic.
- Preserve public API contracts unless a contract change is explicitly requested.
- Move code toward the target architecture incrementally.
- Introduce seams before moving logic.
- Split large files by responsibility.
- Extract domain logic out of pages and route handlers first.
- Replace generic shared files with feature or module-local code when ownership is clear.
- Keep framework adapters thin.
- Prefer additive refactors over destructive rewrites.
- Do not collapse multiple domains into one convenience service.
- Do not create new architectural debt while removing old debt.

## 12. Migration Rules for This Codebase

The codebase currently contains legacy structures such as:

- domain-specific UI under `components/`
- multi-domain HTTP calls under `lib/api.js`
- route handlers mixing transport, business logic, and data access
- business utilities under generic `lib/`

All new work must move the codebase toward this target:

- feature-specific UI moves from `components/*` to `features/<feature>/components`
- feature-specific fetching moves from `lib/api.js` to `features/<feature>/services`
- page orchestration moves from large page files to `features/<feature>/hooks`
- route logic moves from `app/api/**/route.js` to `server/modules/<module>`
- persistence code moves into repositories
- domain rules move into services and models

Existing legacy code may remain temporarily, but touched code must be migrated opportunistically when safe.

## 13. Definition of Done for Architecture Compliance

A change is architecturally acceptable only if all statements below are true:

- The owning feature or module is obvious.
- UI, transport, business logic, and persistence are separated.
- No forbidden cross-boundary dependency was introduced.
- API communication uses DTO contracts.
- Shared code is generic and justified.
- The change reduced or did not increase architectural drift.
- The code is easier to reason about after the change.

## 14. Final Rule

If there is a choice between speed and architectural clarity, choose architectural clarity.

If there is a choice between adding to legacy structure and creating the correct boundary, create the correct boundary.

If there is doubt about ownership, do not place code in a generic shared location. Create or extend the correct feature or module.
