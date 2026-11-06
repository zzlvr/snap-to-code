# Roadmap

1. **Auto-correction.** Render the result, compare it with the screenshot, ask the model to fix the differences, repeat a few rounds. The preview runs in a sandboxed iframe, so the render has to be captured from inside it and sent out with `postMessage`. Rounds are capped and visible, because each one is another model call.
2. **Edit by instruction.** "Make the header darker", "add a third card", "make a phone version": the model changes its existing files instead of writing everything again, with undo.
3. **Responsive layouts from several widths.** Add a desktop and a phone screenshot of the same page; the model sees both and writes one responsive layout.
4. **Separate models for reading and writing.** One model reads the image, another writes the code. A model per step in the settings, "same model for both" by default.
5. **Your own design system.** Upload your component library and the model builds with your components instead of plain shadcn/ui, so the result fits teams and agencies that already have one.
6. **Work with an existing project.** Paste your `package.json` and `tsconfig`, or connect a repository: files are placed in your project's structure and use what is already installed.
7. **Pull request export.** Connect GitHub with a token and the app opens a branch and a pull request straight from the browser, no server needed.
8. **Video and scroll recordings.** Frames are sampled in the browser and treated as several screenshots of one page.
9. **Animations.** Change an animation in a generated component by instruction.
10. **A model trained for this task.** It would plug in through the custom OpenAI-compatible endpoint, so the app needs no changes. Needs a dataset of screenshot and code pairs with suitable licences, an evaluation set and compute for fine-tuning.
