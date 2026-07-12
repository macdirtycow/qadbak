<!--
Thanks for the PR! A few quick notes:

1. Qadbak is licensed for panel use only (see LICENSE). External PRs for bug
   fixes and documentation are welcome; new features should be scoped via
   a GitHub issue first. See CONTRIBUTING.md for the full guidelines.
2. Run `npm run lint && npm run test-api` before pushing.
3. Tick the checkboxes below so a maintainer can review faster.
-->

## Summary

<!-- One paragraph: what does this change and why? -->

## Type of change

- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] Documentation update (no code change)
- [ ] Refactor / cleanup (no behaviour change)
- [ ] New feature (please link the issue that scoped it first)
- [ ] Breaking change (please describe migration steps)

## Related issue

<!-- Closes #123 — required for new features. -->

## How was this tested?

- [ ] `npm run lint`
- [ ] `npm run test-api`
- [ ] `npm run build`
- [ ] Manual test on a VPS / dev box (describe steps below)

<!-- Describe the manual test, including any seed data you used. -->

## Screenshots (UI changes)

<!-- Drag screenshots or short clips here for any visible UI change. -->

## Checklist

- [ ] I have read [CONTRIBUTING.md](../CONTRIBUTING.md).
- [ ] I did NOT include any secrets, license keys, customer data or `.env*` files.
- [ ] If this affects install/uninstall, I ran `bash -n install/qadbak-install.sh` / `qadbak-uninstall.sh`.
- [ ] If this affects sudoers, I ran the matching `configure-*-sudo.sh` and confirmed `visudo -c` passes.
