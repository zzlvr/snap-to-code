# Roadmap

Planned, not built yet.

1. **Test on real screenshots** with several models, and tune the prompts from the results.
2. **Auto-correction.** Render the result, compare it with the screenshot, ask the model to fix the differences, repeat a few rounds. The preview runs in a sandboxed iframe, so the render has to be captured from inside it and sent out with `postMessage`. Rounds are capped and visible, because each one is another model call.
3. **Edit by instruction.** "Make the header darker", "add a third card": the model changes its existing files instead of writing everything again, with undo.
4. **Separate models for reading and writing.** One model reads the image, another writes the code. A model per step in the settings, "same model for both" by default.
5. **A model trained for this task.** It would plug in through the custom OpenAI-compatible endpoint, so the app needs no changes. Needs a dataset of screenshot and code pairs with suitable licences, an evaluation set and compute for fine-tuning.
