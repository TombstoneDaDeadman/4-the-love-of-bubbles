# Validation

October 13, 2026; Unity 6000.5.3f1; URP 17.5.0.

- Unity project import and C# compilation succeeded.
- `Bubbles.Editor.Validation.RunAll`: 29 deterministic assertions passed, covering stock reservations, exact yields, shipment payments, repeat payment prevention, cancellation refunds, capacity, supplier purchases, pause/speed, upgrade timing, economy reconciliation, deadlines, milestone rules, save round-trip, backup recovery and incompatible-version rejection.
- Repository source validator: 91 unique Unity GUIDs, required scenes/data/settings present, and no machine-local package dependencies.

Full compile and test logs and disposable save fixtures are under ignored local validation output. GitHub Actions checks repository integrity; it does not claim a hosted Unity compiler or player build.

- Opened the registered D: project from Unity Hub and entered Play mode in the Home Workshop scene.
- `Bubbles > Play-test UI with Unity input (Play mode)`: eight assertions passed through the actual runtime input module and Button callbacks: new business, queueing, completion, shipping, supplier purchase, upgrade, pause and ledger reconciliation.
- Desktop automation did not deliver raw mouse input to Unity in this session; UI validation therefore queued Unity Input System mouse states over separate frames. This is recorded as the test method, not a claim of a manual human playthrough.
- Captured and visually inspected the running UI and 3D workshop after the tests. [Preview](workshop-preview.png).

A full 20-30 minute balance review and a standalone Windows player build remain outside this initial validation. Founder likeness, animation, final packaging, audio and retail systems remain future work.
