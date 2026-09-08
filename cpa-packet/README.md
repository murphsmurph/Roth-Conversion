# CPA Tax Coordination Packet — Track B

Read in this order:

| File | What it is |
|---|---|
| `CPA-PACKET-SPEC.md` | The packet spec. Ledger model, provenance, compliance gate, page rules. |
| `INHERITANCE-MODULE-SPEC.md` | Module 2. Inheritance & beneficiary assets, with 13 verified tax rules. |
| `types/packet-types.ts` | Core data model. Split at the marked line into src/ledger + src/packet. |
| `types/inheritance-types.ts` | Inheritance model. `BasisModel` is the load-bearing type. |
| `fixtures/inheritance/` | 16 independent checks (INH-01..16) + INDEX.json |
| `tools/build_inheritance_fixtures.py` | Regenerates them. Must never import from src/. |
| `sample/specimen-packet.html` | Design target. Synthetic data, watermark on. |

Session prompts: `../SESSION-PROMPTS.md`, Track B section.

## The two fixtures to read by hand

- **INH-02** — an inherited traditional IRA gets no step-up at all. IRC 1014(c). The IRD branch
  of `BasisModel` has no `taxBasis` field; adding one must break the build.
- **INH-16** — the same inherited-IRA distribution appears in the inheritance section and on
  page 4. If the household total comes back doubled, the module kept its own copy.

## Regenerate

```
python3 tools/build_inheritance_fixtures.py
```
