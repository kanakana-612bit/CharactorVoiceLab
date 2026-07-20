# Third-Party Software and Model Notices

CharacterVoiceDesigner does not redistribute the following runtime packages or model weights in this repository. The setup scripts download them into the ignored `runtime/` directory from their upstream distribution sources. Users who redistribute a populated runtime directory must comply with each upstream license and preserve the corresponding license notices.

| Component | Role | License / conditions | Upstream |
| --- | --- | --- | --- |
| 0xShug0/audio.cpp | Local native audio-model inference server | Apache License 2.0. Preserve the license and applicable attribution/NOTICE material when redistributing its binaries or source. | https://github.com/0xShug0/audio.cpp |
| Aratako/Irodori-TTS-600M-v3-VoiceDesign | Japanese caption-conditioned TTS model | MIT. The model card additionally prohibits impersonation without explicit consent and synthetic speech intended to mislead or spread misinformation. | https://huggingface.co/Aratako/Irodori-TTS-600M-v3-VoiceDesign |
| pyworld / WORLD | Local F0 measurement | pyworld is MIT. Cite Morise et al. (2016), DOI `10.1587/transinf.2015EDP7457`, in research use. | https://github.com/JeremyCCHsu/Python-Wrapper-for-World-Vocoder |
| praat-parselmouth / Praat | Local waveform-preserving PSOLA F0 correction | praat-parselmouth and the complete Praat distribution are GPL-3.0-or-later. They are installed and invoked as external runtime dependencies; their source is not copied into this repository. Preserve GPL notices and provide corresponding source as required when redistributing binaries. | https://github.com/YannickJadoul/Parselmouth |

The setup environment also installs Python, NumPy, PyTorch, safetensors, PyYAML, setuptools, pip, and platform-specific build/download tooling. Their exact versions and transitive dependencies can differ by platform and installation date. Before redistributing `runtime/`, generate and review an inventory from that populated environment and include every license file shipped by those packages. The unpopulated source repository does not redistribute those binaries.

Model-use safeguard: CharacterVoiceDesigner uses caption-only VoiceDesign by default and does not accept reference-speaker audio through its public adapter. Generated speech must not be represented as a real person's speech and must not be used for impersonation, deception, or evasion of consent.
