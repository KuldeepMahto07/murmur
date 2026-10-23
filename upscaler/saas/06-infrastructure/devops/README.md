# DevOps

**Today:** manual. A venv plus `npm run build`; the C: drive is nearly full, so pip needs `TEMP` pointed at D:.

**To do:**
- A Dockerfile for the GPU worker (CUDA 12.8 runtime base)
- Infrastructure as code (Terraform or the Modal/RunPod config file)
- Separate `.env` files for each environment
- Pinned dependencies (`pip-tools`)
- A model weight cache in the image, with SHA-256 checks (`download_models.py` already prints hashes)
