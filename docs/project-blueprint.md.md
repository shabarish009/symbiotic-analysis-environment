Symbiotic Analysis Environment - Final Project Blueprint & Development Handoff

    Project Status: Planning Complete. "Conditional GO" is resolved. Development is unblocked.

    Current Phase: Phase 1 - The Core Engine & The Killer App.

    Next Action: Handoff to Scrum Master (Bob) for backlog creation in the IDE.

1. Executive Summary & Strategic Mandate

This blueprint outlines the execution plan for Phase 1 of the 

"Symbiotic Analysis Environment." Our guiding philosophy is to create a tool that is not a passive application, but an active, intelligent partner for the "Frustrated Data Artisan".

The plan is to build the "Grand Vision" in four distinct phases. This document details the execution of 

Phase 1. The core technical challenge—the communication between the Frontend, the Rust Shell, and the Python AI Core—has been resolved with the Hybrid Multi-Process Architecture detailed herein. With this architecture finalized, the development blocker on Epics 2 and 3 is lifted, and the full scope of Phase 1 can now be implemented.

2. The Finalized Plan: Phase 1 Scope (from PRD)

This is the definitive "what to build" for Phase 1, consisting of three epics and 19 user stories.

Epic 1: The Core Application Shell & UX

    1.1: One-click installer for Windows, macOS, and Linux.

1.2: Authentic Windows XP look and feel.

1.3: Ability to open, close, move, and resize windows on the canvas.

1.4: Application remembers window layout between sessions.

1.5: UI elements (buttons, menus) conform to XP design.

1.6: UI complies with WCAG AA accessibility standards.

Epic 2: The Core AI Engine

    2.1: AI engine starts and runs seamlessly in the background.

2.2: Consensus Engine uses multiple models to generate a trustworthy answer.

2.3: User can see a simplified view of the AI's "thought process".

2.4: AI remembers project context (schemas, query history).

2.5: AI learns from user corrections during a session.

2.6: AI engine runs entirely locally with open-source LLMs.

Epic 3: The SQL Analyst Application

    3.1: Securely connect to various databases.

3.2: SQL editor with syntax highlighting and line numbers.

3.3: Execute query and see results in a sortable, filterable table.

3.4: Schema explorer to view database tables and columns.

3.5: AI generates draft SQL from a natural language goal.

3.6: AI can explain, optimize, or check a user's SQL query.

3.7: Output of one query can be used as input for another (Reactive Dataflow).

3. The User Experience Blueprint (from UI/UX Spec)

This is the "how it should look and feel," guided by these core principles.

    Core Principle: Adaptive Authenticity. The primary goal is a high-fidelity Windows XP aesthetic, but modern accessibility and usability standards (WCAG AA) will always take precedence in any conflict .

Visual Benchmark: The interactive website https://mitchivin.com/ is the functional and aesthetic target for the core shell.

Core Interaction Model: Inter-app communication will be handled via a "Copy as Live Data Source" / "Paste Live Data Source" metaphor that feels authentic to the XP environment while enabling a modern, reactive dataflow .

4. The Technical Blueprint (from Full-Stack Architecture)

This is the definitive "how to build it."

    Core Architecture: A Hybrid Multi-Process Architecture is mandatory.

        Frontend: React/TS in a Tauri WebView.

        Shell: Rust/Tauri manages the application and acts as a message broker.

        AI Core: A headless Python process performs all heavy computation.

    Inter-Process Communication (IPC): Communication between the Shell and AI Core will use Standard I/O (stdin/stdout) with a strict JSON-RPC protocol. This is secure, performant, and self-contained.

    Data & Security:

        The AI's memory (Project Cortex) will be stored in a local SQLite database.

        UI session state will be persisted in a simple JSON file.

        Sensitive credentials (database passwords) will only be stored in the native OS Keychain.

    Test Strategy: We will follow the Testing Pyramid model, with a strong foundation of unit tests, supported by integration and end-to-end tests.

5. Implementation Order & First Steps

Development of Phase 1 will proceed in the following strategic order to mitigate risk and ensure a solid foundation.

    Foundational Setup (Sprint Zero):

        Top Priority: Implement the IPC Validation Spike (Story 0.1) to prove the communication chain between the Frontend, Shell, and AI Core works.

        Set up the project repository and initial build pipelines.

    Build the Shell (Epic 1): Develop the core UI components of the XP environment.

    Build the Brain (Epic 2): Develop the headless Python AI Core process.

    Integrate and Deliver the Killer App (Epic 3): Build the SQL Analyst application, connecting all previously built parts.

6. Formal Handoff Command

This blueprint is complete. The project now transitions from planning to implementation.

Next Agent: Bob (Scrum Master).

Handoff Command for New Session:

    Bob, the finalized PRD and the completed Full-Stack Architecture document are ready. Please begin creating the detailed story files in the docs/stories/ directory, starting with Story 0.1 (IPC Spike), followed by the stories in Epic 1 as per the implementation plan.