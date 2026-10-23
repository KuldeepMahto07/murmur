# CI/CD

**Today:** none.

**Plan (GitHub Actions)**
1. Lint: ruff + eslint
2. Unit tests on CPU (see [unit testing](../../07-testing/unit-testing/README.md))
3. Build the front end
4. Build and push the worker image
5. Nightly GPU smoke test, running `scripts/e2e.py` against a staging worker
6. Deploy the API on merge to main; deploy workers by image tag
