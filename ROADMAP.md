# Roadmap

Today the app runs entirely in your browser. Some items below need a server and will be added later.

## Now: better results

What comes first.

1. **Auto-correction.** Render the result, compare it with the screenshot, ask the model to fix the differences, and repeat for a few rounds. The preview runs in a sandboxed iframe, so the render has to be captured from inside it and sent out with `postMessage`. Rounds are capped and visible, because each one is another model call.

2. **Edit by instruction.** "Make the header darker", "add a third card": the model changes its existing files instead of writing everything again, with undo.

3. **Responsive generation.** Generate layouts that adapt to desktop, tablet, and mobile screen sizes, while preserving the original design.

4. **Multi-reference generation.** Generate interfaces using multiple screenshots, reference images, and design examples instead of relying on a single screenshot.

5. **Separate models for reading and writing.** One model reads and interprets the image, another writes the code. A model per step in the settings, with "same model for both" as the default.

6. **Visual evaluation and benchmarking.** Build a consistent evaluation system to measure visual similarity, code quality, responsive behavior, and animation accuracy across models and generations.

## Next: fits your project

After that.

7. **Design System integration.** Let users provide their design tokens, colors, typography, reusable components, and styling rules. Generated code should follow their existing design system.

8. **Existing project integration.** Work with existing codebases instead of generating standalone projects. Understand project structure, dependencies, components, and conventions before making changes.

9. **GitHub integration.** Connect repositories, import projects, apply generated changes, and export results through branches or pull requests.

## Later: new inputs and teams

When the above is done, in no fixed order. Several of these need a server.

10. **Video-to-Code.** Upload a video of a website or interface and reproduce its animated elements, transitions, and interactions in code.

11. **Figma and URL import.** Use Figma designs or existing websites as input references for code generation.

12. **Project management.** Save generations, references, previews, and iterations in persistent projects. Allow users to return to previous work and continue where they left off.

13. **Team collaboration.** Shared projects, team workspaces, reusable design systems, and collaboration features for agencies and development teams.

14. **A model trained for this task.** Develop a specialized model for visual-to-code generation. It would plug in through the custom OpenAI-compatible endpoint, so the app needs no changes. Requires a dataset of screenshot/video and code pairs with suitable licences, an evaluation set, and compute for fine-tuning.
