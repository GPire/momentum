# iOS release verification — 11 September 2026

## Actual status

Not verified on iOS 27 or iPhone Duo. The current workstation is Windows and no macOS/Xcode runner has executed this working tree. Responsive Chrome checks are not native compatibility evidence.

The repository contains an iOS Capacitor project, iPhone/iPad device families, portrait/landscape support and a SceneDelegate. No deployment-target increase or invented device breakpoint was applied. Native build workflow now records its actual SDK/runtime inventory and retains the Xcode result bundle; a generic simulator build alone does not establish iOS 27 or Duo support.

Local production build still fails before compilation: esbuild child-process spawn EPERM. Release/push remains pending, rather than bypassing the sandbox.

## Required evidence before release

1. Build this exact commit on a Mac with the required Xcode/SDK. Run npm ci, npm run build, npx cap sync ios, then xcodebuild -showdestinations for ios/App/App.xcodeproj and scheme App.
2. Record the chosen device, iOS runtime, Xcode version and commit. If an iPhone Duo runtime is not installed/available, mark Duo untested, never silently substitute another device.
3. Run on a simulator and a physical device: cold/warm launch, onboarding with/without optional budget, all profile/Free/Pro gates, each form, back/close, keyboard, paste, VoiceOver, text enlargement, reduced motion and orientation/window changes while a form has an unsaved draft.
4. Check calendars, start/end dates, installments and decimal separators; verify edits don't reuse values from a previous record. Test offline reopening, import/backup restore with disposable fixtures, sharing and denied permissions.
5. Review the privacy report of the final native archive, required-reason APIs in dependencies, privacy disclosures, opt-out persistence, entitlements, signing, build number and assets. No blanket assertion about collection or a fabricated privacy manifest has been added.
6. Archive a signed Release build, use Validate App, then TestFlight and final device checks. No upload or App Store submission was performed here.

## References

- https://www.apple.com/newsroom/2026/09/apple-unveils-iphone-duo/ — the announcement describes upcoming iPhone Duo support in Xcode Device Hub.
- https://developer.apple.com/documentation/Xcode/running-your-app-on-simulated-or-physical-devices
- https://developer.apple.com/documentation/xcode/distributing-your-app-for-beta-testing-and-releases

## Field review

See form-fields-audit.md for the reproducible source inventory, generated with node scripts/audit-form-fields.mjs. It covers source controls, including dynamic templates and comment false positives. A complete visual/native review is still required; source labels alone are not WCAG certification. Existing hardcoded-language fields and remaining native select controls are not declared finished.
