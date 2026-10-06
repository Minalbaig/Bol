# Bol

**Keep your words. See what AI changed.**

Bol is a human-centered AI prototype about a common interaction problem: AI can make a messy account sound polished while quietly adding certainty, assumptions or details that were never stated.

Instead of asking someone to trust one fluent summary, Bol breaks the AI output into small suggestions, connects each suggestion to the original words and lets the person keep, rewrite, remove or mark it as uncertain.

Bol is not a reporting tool, truth detector, legal service or finished product. It is a demo of an HCI idea: making AI output easier to inspect and correct.

## What the demo shows

The visible experience has three stages:

1. **Tell it** — speak, type, upload audio or open a fictional sample.
2. **Review AI** — compare AI suggestions with the original words. Suggestions are labelled direct, approximate or unsupported.
3. **Your version** — create an output only from suggestions the person kept or rewrote.

The clearest demo moment is intentionally simple:

- Original words: `Main bus stop par thi.`
- AI suggestion: `The person was waiting for a bus.`
- Bol marks the suggestion unsupported because being at a bus stop does not necessarily mean waiting for a bus.

This is the human problem Bol addresses: fluent AI output can be easy to accept and hard to verify. The interface reduces the effort required to notice, understand and correct that drift.

## What AI does

When live API keys are configured, AI:

- turns audio into text;
- proposes small, structured claims from the confirmed transcript;
- compares those claims with cited source words; and
- produces a conventional summary for comparison.

The person still makes every final decision. The last screen is assembled in code from their choices; it does not ask a model to rewrite the story again.

For a reliable presentation, the repository includes two fictional scenarios with precomputed output. They are clearly labelled in the interface. You do not need API keys to present the main interaction.

## Why it is HCI-related

Bol changes the interaction between a person and an AI system. It explores three interface ideas:

- **Traceability:** show the source words beside each AI suggestion.
- **Uncertainty:** preserve phrases such as “around”, “maybe” and “I do not remember”.
- **Human control:** make keep, rewrite and remove decisions explicit before producing a final version.

This prototype does not prove that the interface improves trust or accuracy. That would require user research. It gives you a concrete, testable design question: does evidence-linked review help people notice AI assumptions and feel more in control than reviewing one polished paragraph?

## Quick start

Requires Node.js 20 or later.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), then choose **Try a fictional story**.

The project works without API keys in precomputed demo mode.

## Optional live APIs

Copy the example environment file and add only the services you want to use:

```bash
cp .env.example .env.local
```

| Variable | Used for |
| --- | --- |
| `ANTHROPIC_API_KEY` | Live summary and evidence-linked claim analysis |
| `OPENAI_API_KEY` | Speech-to-text |
| `ANTHROPIC_SUMMARY_MODEL` | Optional summary model override |
| `ANTHROPIC_EXTRACTION_MODEL` | Optional extraction model override |
| `ANTHROPIC_VERIFIER_MODEL` | Optional checking model override |
| `OPENAI_TRANSCRIPTION_MODEL` | Optional transcription model override |

Keep `.env.local` private. Do not upload it to GitHub.

## Demo script

1. On the first screen, say: “AI is good at making language sound clean, but clean language can hide assumptions.”
2. Choose **Try a fictional story**. Explain that the content and output are precomputed so the stage demo is reliable.
3. Point to the original Roman Urdu words and the three suggestion labels.
4. Open the unsupported suggestion about “waiting for a bus”. Say: “The sentence sounds reasonable, but the person never said it.”
5. Remove that suggestion, rewrite another one and use **Keep supported suggestions** for the rest.
6. Select **Build my version**. Point out that the final screen contains only what the person approved.
7. End with: “Bol does not decide what is true. It makes the AI's interpretation easier for a person to inspect and control.”

## Useful commands

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run check
```

## Project structure

```text
src/
  app/                 Next.js pages and API routes
  components/          The three-stage interface
  lib/
    fixtures.ts        Fictional presentation scenarios
    clientApi.ts       Live and precomputed client calls
    sourceValidation.ts
    guards.ts          Conservative text checks
    narrative.ts       Final output assembly from user choices
    session.ts         In-memory session state
    server/            Prompts and service clients
tests/                 Unit tests for the text and state logic
```

## Honest limitations

- The prototype checks whether AI wording is supported by the provided text; it does not establish whether an event happened.
- The AI and the text checks can both be wrong.
- The fictional precomputed output was written for the demo and is not evidence of model performance.
- No user study has been run, so the prototype makes no claim about improved trust, accuracy or wellbeing.
- Mixed-language transcription and analysis need broader testing.
- Identifying-detail detection is pattern-based and can miss information.
- This is not ready for real sensitive reporting workflows.

## Privacy in this prototype

Session content stays in browser memory and is cleared when the tab is closed or **Delete session** is used. Live API requests are sent only after transcript confirmation. Third-party AI services process those requests under their own policies.
