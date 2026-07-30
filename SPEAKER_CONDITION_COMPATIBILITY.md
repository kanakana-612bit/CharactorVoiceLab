# Speaker Condition And Speaker Inversion Compatibility

## Purpose

CharacterVoiceDesigner treats a speaker condition as a model-dependent
intermediate representation. It is not an anatomical measurement, a direct
encoding of appearance, or proof of speaker identity.

The reference implementation validates four independent layers:

1. model structure;
2. Speaker Inversion file format;
3. native inference input path;
4. semantic compatibility with the exact checkpoint.

Passing one layer does not imply that the later layers pass.

## Upstream Contract

The Irodori-TTS Speaker Inversion implementation defines:

- file suffix: `.speaker.safetensors`;
- tensor key: `speaker_embedding`;
- tensor shape: `(tokens, speaker_dim)`;
- reference token count: 16;
- reference initialization standard deviation: 0.02;
- training behavior: freeze the base model and optimize only the speaker
  embedding;
- inference behavior: supply the optimized tensor as the speaker state instead
  of encoding a reference waveform.

Primary sources:

- [Irodori-TTS repository](https://github.com/Aratako/Irodori-TTS)
- [speaker_inversion.py](https://github.com/Aratako/Irodori-TTS/blob/main/irodori_tts/speaker_inversion.py)
- [inference_runtime.py](https://github.com/Aratako/Irodori-TTS/blob/main/irodori_tts/inference_runtime.py)
- [VoiceDesign Speaker Inversion config](https://github.com/Aratako/Irodori-TTS/blob/main/configs/train_500m_v3_speaker_inversion.yaml)

## Verified Local Result

The installed `Irodori-TTS-600M-v3-VoiceDesign` checkpoint reports:

- `use_speaker_condition: true`;
- `speaker_dim: 768`;
- speaker encoder and normalization weights;
- speaker key/value projections from 768 to the model width;
- model JSON equal to the checkpoint `config_json` metadata.

A deterministic, non-semantic format fixture produces a 49,264-byte
Safetensors file containing one `float32` tensor with shape `(16, 768)`. It
passes the upstream storage contract and the installed model's dimensional
contract. The fixture is random initialization, contains no learned voice, and
must never be used as evidence of voice compatibility.

The original inspected audio.cpp release accepts reference audio and internally
encodes its speaker condition, but does not expose a direct speaker-state
override. CharacterVoiceDesigner now carries a pinned source patch that loads
the official `speaker_embedding` tensor, creates an all-valid mask, and feeds
the existing `IrodoriSpeakerCondition` path without running the reference
encoder. Capability reporting scans the installed binary, so the presence of a
patched source tree alone cannot produce a false ready state.

## Local Tools

Run:

```powershell
.\verify_speaker_inversion.bat --create-format-fixture
```

or:

```bash
./verify_speaker_inversion.sh --create-format-fixture
```

The ignored `speaker_condition_results/` directory receives:

- `compatibility.json`: machine-readable compatibility layers;
- `SPEAKER_INVERSION_COMPATIBILITY_REPORT.md`: review summary;
- `speaker_inversion_voice_design.reference.yaml`: target-model training
  configuration reference;
- optional deterministic format fixture and provenance sidecar.

Supply an existing artifact with repeated `--embedding` arguments. Use
`--hash-model` only when a full checkpoint hash is required; it reads the
complete multi-gigabyte weights file.

The reports include tensor statistics and hashes but never raw embedding
values. Sidecars distinguish deterministic format fixtures from semantically
trained artifacts and bind artifacts to the model configuration or full
checkpoint hash when available.

`state_f32le_sha256` is defined as SHA-256 over the tensor converted to
contiguous float32 values and serialized in row-major little-endian order.
audio.cpp computes the same digest after loading and validating the tensor.
Shape is reported separately, so this digest is a transport/consumption check,
not a portable model identity or semantic voice identifier. It can still link
repeated use of the same state, so a digest derived from a real person's
consented voice data remains local research metadata and must not be published
without an appropriate consent and provenance basis.

## Native Integration Acceptance Criteria

Direct inference is available only in a binary for which all of the following
are satisfied:

1. audio.cpp accepts a bounded local `.speaker.safetensors` path or validated
   tensor payload; implemented;
2. the loader checks suffix, key, rank, finite floating values, token count, and
   exact `speaker_dim`; implemented;
3. reference audio and direct embedding inputs are mutually exclusive;
   implemented;
4. the direct tensor bypasses the speaker encoder and reaches the existing
   speaker-state branch; implemented;
5. normal inference remains unchanged when no direct condition is supplied;
   request-path regression tests implemented and Ubuntu real-audio operation
   confirmed;
6. native and Designer-side canonical state hashes are compared without
   serializing raw values; implemented, Ubuntu GPU observation pending;
7. held-out texts evaluate cross-text voice stability and acoustic drift;
   deferred;
8. the artifact was optimized against the exact checkpoint recorded in its
   provenance sidecar.

Appearance-derived physical controls may guide a later optimization objective,
but CharacterVoiceDesigner must not fabricate the 12,288 latent values from
external appearance measurements. Any training audio, real-person embedding
evaluator, or identity claim requires separate consent, ethics, and provenance
review.
