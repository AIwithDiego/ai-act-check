# Agent instructions

- Read `docs/brief.md` and `docs/contract.md` before any code. The contract is fixed.
- Only edit the files your prompt says you own.
- Never edit `data/` or `fixtures/`. If you think they're wrong, say so in your PR.
- No secrets in code, tests or commits. Tests use dummy `sk_test_` values and no network.
- Exact package versions, no `^`, no `latest`. `mppx` is pinned to 0.17.1.
- Never store the request body (use case or answers) anywhere.
- One PR per prompt, small, with the test output in the description.
- After two failed attempts at the same problem, stop and explain in the PR.
