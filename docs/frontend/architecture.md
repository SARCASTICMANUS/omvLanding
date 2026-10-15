# VAYY Frontend Architecture

This structure is migration-safe. Existing pages and components remain in place; new folders define the target ownership model for future work.

## Target Folders

- `src/app`: app bootstrap, Redux store, provider setup.
- `src/routes`: route constants, route config, route guards.
- `src/layouts`: shared shells such as nav-wrapped and fullscreen layouts.
- `src/redux`: root reducer, RTK Query API, feature-neutral slices.
- `src/services/api`: Axios service modules that wrap backend endpoints.
- `src/services/sockets`: central WebSocket manager.
- `src/sockets`: socket keys and endpoint subscription factories.
- `src/hooks`: shared React hooks.
- `src/maps`: shared map utilities, hooks, map-specific components.
- `src/tracking`: live tracking UI and domain hooks.
- `src/passenger`: passenger-owned modules.
- `src/driver`: driver-owned modules.
- `src/admin`: admin-owned modules.
- `src/components`: legacy and shared components during migration.
- `src/components/ui`: reusable UI primitives.
- `src/constants`: routes, roles, API paths, app constants.
- `src/config`: environment and runtime config.
- `src/utils`: framework-agnostic utilities.

## Migration Rules

1. Do not move a working component until its imports are covered by tests or a build check.
2. Keep route paths and API paths in constants before migrating callers.
3. Prefer service modules for Axios workflows already used by components.
4. Prefer RTK Query for new server-cache workflows.
5. Use normalized Redux slices for live entities such as buses and routes.
6. Use `useSocketSubscription` for new WebSocket subscriptions and migrate existing component-owned sockets gradually.
7. Keep only `auth` persisted unless a product workflow explicitly needs offline persistence.

## Responsive System

Tailwind screens:

- `xs`: 375px
- `sm`: 640px
- `md`: 768px
- `lg`: 1024px
- `xl`: 1280px
- `2xl`: 1536px
- `3xl`: 1920px
- `4k`: 2560px

Use `.vayy-container` and `.vayy-container-wide` for page-level content. Fullscreen tracking and map screens can use `min-h-screen-dvh`, `h-screen-dvh`, and explicit overflow rules.

