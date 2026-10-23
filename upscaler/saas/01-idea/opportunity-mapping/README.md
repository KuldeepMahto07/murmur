# Opportunity mapping

| Opportunity | Value to users | Effort | Priority |
|---|---|---|---|
| Hosted cloud rendering (pay per minute) for users without a GPU | High | High (infra + billing) | **P1** |
| Social presets: "IG Reel 4K60", "TikTok 1080p60", "YouTube 4K" | High | Low (maps to existing settings) | **P1** |
| RIFE interpolation (smoother 60 fps than minterpolate) | High | Medium | **P1** |
| Deinterlace + denoise preset for VHS/DV | High for archivists | Low (ffmpeg `bwdif` + existing models) | P2 |
| TensorRT / ONNX export for 2-3x speed | Lowers cost per minute | Medium | P2 |
| Desktop installer (Tauri) | Removes setup friction | Medium | P2 |
| Public API for e-commerce batches | Recurring B2B revenue | Medium | P3 |
| Diffusion "creative" upscale | Competes with Topaz Starlight/Astra | High (needs a 16 GB+ GPU) | P3 (cloud only) |

The full roadmap is in [product roadmap](../../03-planning/product-roadmap/README.md).
