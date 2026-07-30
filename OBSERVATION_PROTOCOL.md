# TTS Generation Observation Protocol

## Purpose

The observation path records enough local provenance to compare generation
conditions without changing the request sent to audio.cpp or the WAV returned
to the caller. It is an engineering diagnostic interface, not a model-control
interface.

Observation is opt-in per request. Records are written only under the ignored
`runtime/observations/` directory on the user's PC. The generated WAV is not
copied into the record.

## Request

Add an `observation` object to the normal
`POST /api/audio-cpp/speech` request:

```json
{
  "model": "irodori-vdes",
  "input": "これは観測用の発話です。",
  "seed": 20260730,
  "num_inference_steps": 20,
  "options": {
    "caption": "自然で聞き取りやすい日本語音声。",
    "caption_guidance_scale": 2.0,
    "duration_scale": 1.0
  },
  "observation": {
    "enabled": true,
    "label": "identity-baseline",
    "include_text": false,
    "analyze_f0": true,
    "capture_internal_conditions": true,
    "latent_snapshot_steps": [4, 8, 12, 16, 20]
  }
}
```

The bridge removes `observation` before forwarding the request to audio.cpp.
The response remains `audio/wav`. A successfully persisted record adds:

```text
X-CVD-Observation-ID: 20260730T013352.366878Z-88eeeb0625cb
```

Read that record from:

```text
GET /api/runtime/observations/{observation_id}
```

Runtime capabilities and model dimensions are available from:

```text
GET /api/runtime/observation-capabilities?model=irodori-vdes
```

## Stored Fields

The current schema is `cvd_tts_observation_0.2`. It stores:

- model id, model-config SHA-256, model weight size, and architecture fields;
- seed, inference steps, language, conditioning scales, and postprocess settings;
- SHA-256 and length of input text and caption;
- upstream, postprocess, and total elapsed time;
- upstream and returned WAV SHA-256, PCM format, duration, and optional WORLD
  F0 statistics, kept separate when waveform postprocessing is enabled;
- expected Speaker, Caption, and audio-latent dimensions;
- managed speaker-condition artifact hash, canonical float32 state hash,
  native-consumed state hash, shape, mode, and exact-match result when direct
  Speaker Inversion is selected;
- requested latent snapshot steps and whether each internal value was observed.

`include_text` defaults to `false`. When false, neither the input text nor the
caption value is stored. The generated WAV is never stored by this protocol.

## Native Runtime Boundary

The patched audio.cpp runtime exposes a digest, shape, and mode for the
Speaker-condition state, but not its raw tokens. Caption-condition tokens,
initial audio latent, intermediate latent snapshots, and Duration Predictor
output remain unavailable. The record therefore distinguishes
`capture_requested` from `observed` for every field.

The bridge accepts these native response headers:

- `X-AudioCpp-Predicted-Duration-Seconds`
- `X-AudioCpp-Predicted-Duration-Frames`
- `X-AudioCpp-Speaker-Condition-SHA256`
- `X-AudioCpp-Speaker-Condition-Shape`
- `X-AudioCpp-Speaker-Condition-Mode`
- `X-AudioCpp-Caption-Condition-SHA256`
- `X-AudioCpp-Initial-Latent-SHA256`

The speaker digest is SHA-256 over the exact contiguous float32 little-endian
state consumed by inference. Designer computes the same canonical digest while
validating a managed artifact and records `matches_input_state`. Hashes prove
transport parity and condition reuse without placing raw model tensors in HTTP
headers. Raw tensor export is intentionally not implemented.

## Parity Test

With audio.cpp running locally:

```powershell
runtime\mm\Scripts\python.exe tests\observation_runtime_smoke.py --steps 4
```

```bash
runtime/mm/bin/python tests/observation_runtime_smoke.py --steps 4
```

The smoke test generates the same seed and conditions once without observation
and once with observation, then requires byte-identical WAV output.

To verify a managed Speaker Inversion artifact and the patched native state
path on Ubuntu:

```bash
runtime/mm/bin/python tests/observation_runtime_smoke.py \
  --steps 4 \
  --speaker-condition character-a.speaker.safetensors
```

The command additionally requires `speaker_inversion` mode and
`matches_input_state: true`. The artifact must already be directly under
`runtime/speaker_conditions/`.
