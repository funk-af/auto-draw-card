# auto-draw-card

## About this project

`auto-draw-card` implements an Algorand card-management system. A **Main** contract "generates" a rekeyed account for each card it creates, and all minimum balance requirements (box storage, account minimums, asset opt-in MBR) are pre-funded by the contract owner — the **Partner** operating the platform. Callers never attach MBR payments.

On top of the Main contract, two auxiliary components enable an opt-in automated debit ("AutoDraw") flow that card holders can disable at any time:

- **Main** — the card-management application (create/close/recover cards, debits, withdrawals).
- **Killswitch** — an application tracking which accounts have opted in to AutoDraw delegation.
- **AutoDraw** — a delegated `LogicSig` that authorizes an automatic debit from a card, gated by the Killswitch.

## Repository layout

This is an [AlgoKit](https://github.com/algorandfoundation/algokit-cli) workspace. The smart contracts live in [`projects/auto-draw-card`](projects/auto-draw-card/README.md) — see that project's README for setup instructions and the full contract reference, role model, and lifecycle diagrams.
