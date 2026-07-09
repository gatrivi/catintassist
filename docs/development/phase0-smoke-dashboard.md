# Phase 0 Smoke Dashboard (v4.83.0)

Operator checklist that **proves** v4.81 STT harness + v4.82 translation ledger on the **real stack**. Does not re-implement those systems.

## Where

Settings → Behavior → **Phase 0 Smoke**

Gate: non-prod, or `REACT_APP_DEV_TEST_HARNESS=true`.

## What it does

1. Lists Phase 0 ROADMAP items (split translate, revenant, phones, weak>empty, connect thrash, EN/ES, harness visibility).
2. **Live stack strip** — DG key, paid translate keys, call/revenant, caption/final/sealed-translation counts, fake-phone hint, STT counters.
3. Operator marks: pass / fail / skip / unchecked → `localStorage catint_phase0_smoke_v1`.
4. Probes **never auto-pass**. GREEN only when you mark all blocking items pass.

## How to run a smoke

1. Confirm live strip: DG key yes, paid translate yes (medical).
2. Test Harness → `phone-number` → mark **phone digits**.
3. Live long utterance or bilingual fixture → mark **split both translated** / **EN/ES**.
4. Mid-call refresh → re-attach → mark **revenant**.
5. Connect once watching status strip → mark **no thrash**.
6. `npm run test:translation` + sealed IDB check → mark **translate harness**.
7. When strip + marks agree → Phase 0 GREEN.

## Files

- `src/utils/phase0SmokeChecklist.js`
- `src/components/Phase0SmokeDashboard.js`
