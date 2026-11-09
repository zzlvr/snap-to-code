# Roadmap

Today the app runs entirely in your browser. Some items below need a server and will be added later.

## Done

- **Auto-correction.** After the code is written, the page is drawn, compared with your screenshot, and the model fixes the differences it sees. Off, or 1 to 3 rounds, and one click undoes the corrections.
- **Your design system.** Add your theme CSS, Tailwind config and UI components, and the code uses your colours, radius and components.
- **Compare models.** Run one screenshot through up to four models at once and compare the results side by side.

## Now: better results

What comes first.

1. **Edit by instruction.** "Make the header darker", "add a third card": the model changes its existing files instead of writing everything again, with undo.

2. **Responsive generation.** Generate layouts that adapt to desktop, tablet, and mobile screen sizes, while preserving the original design.

3. **Multi-reference generation.** Generate interfaces using multiple screenshots, reference images, and design examples instead of relying on a single screenshot.

4. **Separate models for reading and writing.** One model reads and interprets the image, another writes the code. A model per step in the settings, with "same model for both" as the default.

5. **Visual evaluation and benchmarking.** A measured similarity score between the screenshot and the result, so models and settings can be compared by numbers as well as by eye. Also covers code quality, responsive behavior, and animation accuracy.

## Next: fits your project

After that.

6. **Deeper design system support.** Tailwind v3 configs, component variants, and tokens imported from other sources.

7. **Existing project integration.** Work with existing codebases instead of generating standalone projects. Understand project structure, dependencies, components, and conventions before making changes.

8. **GitHub integration.** Connect repositories, import projects, apply generated changes, and export results through branches or pull requests.

## Later: new inputs and teams

When the above is done, in no fixed order. Several of these need a server.

9. **Video-to-Code.** Upload a video of a website or interface and reproduce its animated elements, transitions, and interactions in code.

10. **Figma and URL import.** Use Figma designs or existing websites as input references for code generation.

11. **Project management.** Save generations, references, previews, and iterations in persistent projects. Allow users to return to previous work and continue where they left off.

12. **Team collaboration.** Shared projects, team workspaces, reusable design systems, and collaboration features for agencies and development teams.

13. **A model trained for this task.** Develop a specialized model for visual-to-code generation. It would plug in through the custom OpenAI-compatible endpoint, so the app needs no changes. Requires a dataset of screenshot/video and code pairs with suitable licences, an evaluation set, and compute for fine-tuning.
