# CloudBrain User Guide

Welcome to CloudBrain! This guide will help you set up and master the CloudBrain CLI for advanced AI-driven coding.

## 📥 Installation

The CloudBrain CLI is distributed as a standalone binary or via Node.js.

### Standalone Binary
Download `brain.exe` (Windows) or `brain` (Mac/Linux) from the latest release and add it to your PATH.

### Via Source
1. Clone the repository.
2. Navigate to `coding-brain-cli/`.
3. Install dependencies: `npm install`.
4. Link the command: `npm link`.

## 🔑 Authentication

Before using the agent, you must authenticate with your CloudBrain API Key.

1. Generate a key from the [CloudBrain Dashboard](https://coding.super25.ai/keys).
2. Run the auth command:
   ```bash
   brain auth
   ```
3. Paste your key when prompted.

## 🛠 Basic Usage

### Standard Command
Ask the agent to perform any coding task:
```bash
brain "Create a basic Express server"
```

### YOLO (Auto-Execute)
For fast iterations, use the `-y` flag to skip confirmation prompts:
```bash
brain -y "Install lodash and use it in utils.js"
```

### Modes
CloudBrain comes with 17 specialized modes:
- `--fix`: Debug and suggest fixes.
- `--review`: High-level code audit.
- `--security`: OWASP security scan.
- `--todo`: (NEW) Intelligent task planning.
- Use `brain modes` to list all available options.

## 📝 Smart Todo & Approval

The **Smart Todo** system allows the agent to break down complex requests into a prioritized task list before writing any code.

### 1. Triggering a List
Simply use the `--todo` flag or mention intent in your prompt:
- `brain --todo "Build a SaaS boilerplate"`
- `brain "Don't code, just show me a list for setting up Docker"`

### 2. Approval Workflow
The agent will present a color-coded task list (P0 Critical, P1 High, P2 Normal). You can then:
- ✅ **Approve**: Execute the full plan step-by-step.
- ✏️ **Edit**: Select specific tasks to run.
- 💬 **Suggest**: Refine the plan with natural language feedback.
- 💾 **Save**: Pause and resume later via `brain todos`.

## 🚦 Interactive Mode

Enter a continuous pair-programming session:
```bash
brain
```
Type `exit` or `quit` to leave.

---
> [!TIP]
> Use the `brain sessions` command to view your recent local task history and states.
