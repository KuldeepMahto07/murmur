# 04 · Design

**Status: in progress.** The UI went straight to code (no Figma). It's consistent and responsive, but there are no formal wireframes or prototype for upcoming screens, the design system isn't documented as a page, and there's no accessibility audit yet.

| Sub-item | Built | Missing |
|---|---|---|
| [Wireframes](wireframes/) | ASCII record of the 3 shipped screens | First-run, settings, licence/upgrade screens |
| [UI design](ui-design/) | Paper/ink/coral palette, serif transcript type, responsive layout, demo banner | Dark mode, contrast fixes, logo set |
| [UX flows](ux-flows/) | Transcribe, fix and export, translate, bulk, demo | Model-download progress, undo, async translation, finish notification |
| [Prototype](prototype/) | Working local app + Vercel demo | Clickable mock of installer, first run and upgrade |
| [Design system](design-system/) | Tokens + components in `styles.css` | Styleguide page, spacing scale, dark tokens |

**Next action:** an accessibility pass (contrast of `--muted`, focus rings, space-to-play shortcut) before any new screens.
