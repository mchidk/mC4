# Components

- **Status:** draft
- **Owner:** VERIFY: assign architecture owner
- **Last reviewed:** 2026-01-01

Decomposition of the main runtime container into its key logical components and source files.

```mermaid
C4Component
    title Components - Application
    Container_Boundary(app, "Application") {
        Component(entrypoint, "Entrypoint", "Module", "Parses input and routes requests")
        Component(core, "Domain Core", "Module", "Applies validation and business rules")
        Component(adapter, "Storage Adapter", "Module", "Reads and writes persistent state")
    }
    ContainerDb(store, "Data Store", "Database Engine", "Durable state")
    Rel(entrypoint, core, "Invokes")
    Rel(core, adapter, "Persists via")
    Rel(adapter, store, "Queries", "TCP / SQL")
```

## Key Components

### Entrypoint

- **Owner:** VERIFY: assign component owner
- **Source:** `planned: src/entrypoint`
- **Interface:** HTTP routes, CLI commands, or event handlers
- **Failure behavior:** Rejects malformed or unauthorized input before reaching core logic

### Domain Core

- **Owner:** VERIFY: assign component owner
- **Source:** `planned: src/core`
- **Interface:** Typed service functions and domain errors
- **Failure behavior:** Fails closed on invariant violations or missing dependencies
