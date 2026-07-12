# Character Voice Lab API Boundary

The WebUI is intentionally independent from Open WebUI and from the eventual TTS runtime.
It owns only:

- image and manual landmark input
- anthropometric feature fusion
- voice constraint editing
- experiment profile import/export

The TTS core should be connected later through a small HTTP API or local adapter.

## Preview Synthesis

`POST /api/synthesis/preview`

Request:

```json
{
  "vowel": "a",
  "voice_constraints": {
    "vocal_tract_length_cm": { "center": 15.4, "min": 14.8, "max": 16.0 },
    "pharyngeal_length_scale": { "center": 1.03, "min": 0.96, "max": 1.1 },
    "pharyngeal_area_scale": { "center": 0.98, "min": 0.9, "max": 1.06 },
    "larynx_height_offset_mm": { "center": -1.0, "min": -4.5, "max": 2.5 },
    "nasal_cavity_volume_cm3": { "center": 18.0, "min": 15.0, "max": 21.0 },
    "maximum_respiratory_pressure_pa": { "center": 900, "min": 720, "max": 1080 },
    "glottal_closure": { "center": 0.5, "min": 0.0, "max": 1.0 }
  },
  "render_options": {
    "duration_s": 1.35,
    "sample_rate": 22050,
    "backend": "auto"
  }
}
```

Response:

- `200 audio/wav`
- or `200 application/json` when returning metadata plus a URL:

```json
{
  "audio_url": "/api/synthesis/artifacts/preview_a.wav",
  "backend": "vtl",
  "warnings": []
}
```

## Profile Export

`POST /api/profiles`

The request body should be the same JSON emitted by `character_voice_profile.json`.
The server may persist it, validate it, or pass it to a training/material-generation pipeline.

## Irodori-TTS Integration Target

Irodori-TTS should not be coupled to the WebUI directly.
Use a separate core service that accepts either:

- `voice_constraints` for preview/material generation
- curated WAV/material paths for cloning or fine-tuning
- a saved `character_voice_profile.json` as the reproducible experiment record

The WebUI should remain useful even when no synthesis backend is available. In that mode it exports constraints and uses the browser fallback formant preview.
