# Public Release Audit

Audit date: 2026-10-07 (Asia/Tokyo)

## Release target

- Repository: `kanakana-612bit/CharactorVoiceLab`
- Public workflow branch: `public/jxiv-reader-workflow`
- Intended audience: readers of the concept paper at <https://doi.org/10.51094/jxiv.4033>

## Privacy and identity checks

- Tracked text files were checked for personal email addresses, known local user names, Windows/Linux home paths, private-network addresses, and common credential formats.
- All Git commit authors visible in the repository use the repository-owner handle and a GitHub noreply address.
- Current branch heads and repository history were checked for the known development-machine user name, local absolute paths, and private-network address used during development.
- The tracked sample archive contains a synthetic character profile and Stable Diffusion-generated character images. Its prompts, model identifiers, hashes, and seeds are retained as provenance. It contains no real-person record or participant identifier.
- The tracked sample WAV and benchmark WAVs are generated audio. They are not recordings of a real speaker.
- Runtime directories, local outputs, source PDFs, logs, temporary files, and local server manifests are excluded by `.gitignore`.

No personal name, personal email address, authentication token, private key, development-machine absolute path, or private-network endpoint was found in the public release contents covered by this audit.

## Functional checks without ML speech generation

- JavaScript syntax and static UI-contract tests
- Python syntax for repository-owned scripts
- Shell launcher syntax where the local shell supports it
- Unique HTML IDs and DOM-to-script element references
- Public workflow navigation and physical-model workspace layout
- Profile/control schema compatibility tests
- Browser checks for the physical-model tab and the expandable advanced-settings section

Model download, Speaker Inversion training, native `audio.cpp` inference, official v4 inference, and final ML speech generation are excluded from this local release check. They require the separately prepared runtime and supported hardware.

## Ethical and licensing scope

- Evidence roles and excluded clinical/data sources are documented in [`SOURCE_ETHICS_AUDIT.md`](SOURCE_ETHICS_AUDIT.md).
- Runtime and model dependencies are documented in [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).
- The repository does not redistribute downloaded model weights or populated runtime environments.
- The repository currently has no project-wide open-source license. Public visibility permits review of the research prototype but does not by itself grant broad reuse or redistribution rights.

## Publication rule

Future releases should repeat this audit whenever samples, generated reports, profiles, reference data, training material, or repository history are changed. Any ambiguous personal, clinical, biometric, or credential-bearing material must be excluded until its provenance and permission are established.
