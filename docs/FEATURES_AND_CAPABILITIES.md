# Features & Capabilities Guide

CloudBrain is more than a simple LLM wrapper; it is a sophisticated agentic system designed for production-grade engineering tasks.

## 🧠 The 12 Agent Personas

CloudBrain implements 12 distinct "intelligence layers" to ensure robust and professional task completion.

| Persona | Responsibility |
|---|---|
| **1. Task Decomposer** | Breaks large user prompts into actionable, prioritized subtasks. |
| **2. Priority Ranker** | Assigns P0 (Critical), P1 (High), and P2 (Normal) tags to tasks. |
| **3. Risk Assessor** | Analyzes commands for destructive impact (e.g., file deletion, state changes). |
| **4. Context Understander** | Identifies tech stacks, OS constraints, and local directory structures. |
| **5. Code Generator** | Produces production-ready code and correct shell commands. |
| **6. Error Diagnostician** | Analyzes stack traces and build failures to propose automatic fixes. |
| **7. Intent Detector** | Identifies "non-coding" requests to switch to planning/todo modes. |
| **8. Safety Guard** | Blocks malicious patterns like SSRF, path traversal, and dangerous LOLBins. |
| **9. Approval Gatekeeper** | Manages the human-in-the-loop workflow for plan validation. |
| **10. Progress Reporter** | Provides real-time, professional feedback on every atomic operation. |
| **11. Memory Manager** | Maintains state across multi-turn interactions and sessions. |
| **12. Recovery Agent** | Handles process interruptions and allows resuming failed deployments. |

## 🛡 Security & Resilience

- **YOLO Safety Guard**: A hardened validation layer that blocks SSRF attempts (e.g., Cloud metadata endpoints), path traversal outside the project root, and suspicious egress commands.
- **Sovereign FSM**: The agent follows a strict Finite State Machine to prevent logic loops and ensure session continuity even after terminal crashes.
- **Gold Standard Parser**: Implements 3-phase fallback parsing for command extraction, handling varied LLM outputs with high reliability.

## ⚡ Performance Optimization

- **Professional Progress UX**: Every step is accompanied by human-readable statuses like `"Writing server.js..."` or `"Installing dependencies..."`, similar to premium IDE tools.
- **Smart Retries**: If an LLM response is unparseable, the agent automatically retries with a formatting hint to minimize user interruption.

---
> [!IMPORTANT]
> CloudBrain is certified **Gold Standard** for its ability to block 100% of standard injection and SSRF test cases while maintaining 90%+ task completion across diverse coding frameworks.
