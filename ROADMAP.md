# Roadmap

Nothing on this page is built yet. These are the planned improvements, in the order they are meant to be done.

## 0. Prove the quality first

Everything so far was verified against a mock model. Before building more, run real screenshots through real models (starting with a shadcn/ui example, which is the same stack) and write down where the output is good and where it is weak. The items below should be chosen and tuned from those results.

## 1. Automatic correction by comparison

The app already renders the generated code next to the original screenshot. The next step is to close the loop:

1. Render the generated UI.
2. Compare the render with the screenshot and list the differences (layout, spacing, colours, missing or extra elements).
3. Send the original, the render and the current code back to the model and ask it to fix those differences only.
4. Repeat for a few rounds and stop when the result stops improving.

Why it matters: a plain chat with a vision model does not do this, and it is the biggest step towards output that actually matches the screenshot.

Things to settle when building it:

- The preview runs in a sandboxed iframe with an opaque origin, so the page cannot read its pixels directly. The render has to be captured from inside the iframe and sent out with `postMessage`.
- Every round costs more model calls, so the number of rounds is capped and visible to the user, and it can be stopped at any time. Free-tier limits are a real constraint.
- A numeric similarity score (or the model's own judgement of the two images) is needed to know when to stop.

## 2. Edit by instruction

After the first result, the user types a change such as "make the header darker" or "add a third card", and the model edits its existing files instead of writing everything again.

- Send the current files plus the instruction, and ask for only the files that change.
- Keep a short history so a change can be undone.
- Keep the before/after compare working for edits.

## 3. Separate models for reading and for writing code

Today one model does both steps. The plan is to let the user pick a different model for each:

- **Reading** (step 1, analysis): any model that sees images well, ideally a cheap and fast one.
- **Writing** (step 2, code): a model that is strong at code. Once the analysis exists it may not need the image at all, so a text-only coding model could be enough.

This lowers cost, makes free tiers go further, and lets people combine the best vision model with the best coding model. In the settings: a model per step, with "use the same model for both" as the default so setup stays simple.

## 4. A model trained for this task

The long-term goal: a model trained specifically for "screenshot to clean UI code", so that quality becomes the product's own advantage and not only convenience. It would plug into the app through the existing custom (OpenAI-compatible) endpoint, so no app changes are needed to use it.

This is expensive and slow, so it comes last. It needs a dataset of screenshot and code pairs (with licences that allow training on them), an evaluation set to measure progress, and compute for fine-tuning an open vision-language model. Items 1 and 2 also produce useful data: every comparison and correction round is an example of what "better" looks like.
