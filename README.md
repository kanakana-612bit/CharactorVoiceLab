# Character Voice Lab

This is a dependency-free MVP for the character-oriented voice design experiment.

Open `index.html` in a browser. It is intentionally independent from the Open WebUI runtime so the experimental data model can evolve without coupling to the main app. Future TTS integration should happen through the API boundary described in `API_CONTRACT.md`, not by embedding Irodori-TTS or VocalTractLab directly in this UI.

Implemented:

- full-body and face image loading
- heuristic body/face landmark extraction in the browser
- manual body/face landmark correction by direct dragging
- basic measurements converted to cm from height or interpupillary prior
- source-tagged cohort priors, z-scores, image/statistical fusion
- low-poly inferred body model
- voice constraint JSON export and reload
- `/a i u e o/` previews using a fallback formant synthesizer
- WAV export

Image extraction assumptions:

- Full-body extraction uses foreground silhouette detection from alpha or simple background color.
- Body landmarks are estimated from silhouette proportions: head top, approximate chin, shoulder span, pelvis span, and foot positions.
- Face extraction uses face foreground plus dark/red feature clouds to estimate pupils, mouth corners, jaw span, nose proxy, and chin.
- This works best for front-facing images with simple backgrounds. It is intentionally a replaceable layer for future SMPL-X, MediaPipe Face Mesh, or custom anime landmark models.

Not implemented in this MVP:

- SMPL-X, MediaPipe Face Mesh, DensePose, or robust background removal
- VocalTractLab adapter
- final TTS or Irodori-TTS integration
- validated anthropometric database

Reference status:

- VTL, F0 and formant priors are extracted from Pisanski et al. 2016 Table 1.
- Adult height and weight references are extracted from Pisanski et al. 2014.
- Dediu et al. 2022, Honda 2001, and the source-map notes are used to shape the variable split and uncertainty handling.
- Head/face/body dimensional priors are still marked as placeholders where the bundle references a dataset, such as AIST Japanese Head Dimensions Database 2001, but does not include the numeric table.

Do not treat placeholder head/face/body priors as validated research data. Replace them with the selected source table before publication-grade analysis.
