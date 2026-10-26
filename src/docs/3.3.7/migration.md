---
title: Migration
order: 9
description: "Short migration guide for updating CommandBridge scripts to the latest schema with /cb migrate."
---

This page is for migrating **older scripts** to the current script schema.

Short version: maybe? make a backup, run `/cb migrate`, then test your commands.

---

## What `/cb migrate` does

- It scans `plugins/commandbridge/scripts/`
- It migrates script files to the latest schema (`version: 4`)
- It prints a result per file: `MIGRATED`, `SKIPPED`, or `ERROR`
- It does **not** migrate `config.yml`

Current built-in migration steps:

- `2 -> 3`
- `3 -> 4`

---

## Recommended flow

1. Stop and create a backup of your scripts folder.
2. Start Velocity and run `/cb migrate`.
3. Run `/cb reload`.
4. Test the important commands manually.

If a script shows `ERROR`, fix that script and run migrate again.

---

{% hint "warning" %}
Migration is best-effort. For bigger custom scripts, you may still need manual cleanup.
{% endhint %}

If you need to fix things manually, use:

- [Scripting](/docs/scripting/)
- [Syntax](/docs/scripting/syntax/)
- [Troubleshooting](/docs/troubleshooting/)
