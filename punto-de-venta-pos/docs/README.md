# Red de Intercambio Federada / Sistema TQ - POS Android

## Overview

The **Red de Intercambio Federada** (Federated Exchange Network) is a federated community barter and reciprocal-credit system. It enables communities to issue and manage their own local currency (**TQ**), perform peer-to-peer transfers, NFC card payments, QR-code charges, and multi-signature (mancomunada) transactions across multiple independently-operated nodes.

The system is **not** a conventional banking platform. It implements a **zero-sum community credit model** where member balances can be positive (credit) or negative (debit) within community-defined limits (`credit_limit` and `debit_limit`). There is no external backing or fractional reserve — all accounts sum to zero across the community. The internal monetary unit is the **centavo** (1/100 of a TQ), stored as `int64` in all layers.

The **POS Android** application (`punto-de-venta-pos/`) is a Kotlin/Jetpack Compose Android app that serves as a physical point-of-sale terminal. It communicates with a federated Go backend via encrypted REST APIs, supports NFC card payments (single, community/multi-vendor, and multi-signature), QR code charges, shift management, and terminal pairing.

---

## Documentation Index

| File | Description |
|------|-------------|
| [01-arquitectura-plataforma.md](01-arquitectura-plataforma.md) | Full platform architecture: federated Go backend, web apps, POS Android, ESP32 terminals, federation protocol, database, and community credit model. |
| [02-pos-android-arquitectura.md](02-pos-android-arquitectura.md) | Internal Android POS architecture: package structure, data flow, Room database, cryptography, UI state management, and file inventory. |
| [03-flujos-pago.md](03-flujos-pago.md) | Detailed payment flows: NFC simple, NFC community/multi-vendor, QR, and multi-signature (mancomunada) with ASCII sequence diagrams. |
| [04-api-endpoints.md](04-api-endpoints.md) | Complete API reference: every endpoint with method, path, auth, request/response bodies, grouped by functional area. |
| [05-modelo-datos.md](05-modelo-datos.md) | Data model: backend PostgreSQL/YugabyteDB tables, Android Room entities, FormatSettings, relationships, and monetary representation. |
| [06-criptografia.md](06-criptografia.md) | Cryptography: Ed25519 terminal identity, ECDH shared key, AES-256-GCM payload encryption, Keystore, CryptoEngine, MIFARE Classic certificados dinamicos. |
| [07-formato-configurable.md](07-formato-configurable.md) | Configurable formatting: server-driven FormatSettings, locale/number/date/time preferences, Room persistence, MIGRATION_2_3. |
| [08-modo-demo.md](08-modo-demo.md) | Demo mode: isDemoNode detection, DemoWatermarkOverlay, local simulations, server isolation, offline operation. |
| [09-feedback-sonoro.md](09-feedback-sonoro.md) | Sound and haptic feedback: FeedbackHelper, PCM synthesis, playKeyClick vs playButtonClick, volume control, feedbackClickable modifier. |
| [10-build-deploy.md](10-build-deploy.md) | Build and deployment: requirements, commands, Room migrations, OTA updates, terminal registration and pairing flows. |

---

## Architecture Diagram

```
                            ┌─────────────────────────────────────────────────┐
                            │           FEDERATED NETWORK (Internet)          │
                            │                                                 │
                            │   Node A ◄──── federation ────► Node B          │
                            │  (nodo-a.example.org/main)   (nodo-b.example.org)│
                            │       │                            │             │
                            │       │ gossip / mTLS              │ gossip/mTLS │
                            │       ▼                            ▼             │
                            └───────┼────────────────────────────┼─────────────┘
                                    │                            │
                    ┌───────────────┼───────────────┐            │
                    │    GO BACKEND (internal/)     │            │
                    │   Federated Node Server       │            │
                    │                               │            │
                    │  ┌─────────┐  ┌────────────┐  │            │
                    │  │ REST API│  │ Federation │  │            │
                    │  │ (chi)   │  │ Protocol   │  │            │
                    │  └────┬────┘  └─────┬──────┘  │            │
                    │       │             │         │            │
                    │  ┌────▼────┐  ┌─────▼──────┐  │            │
                    │  │ Ledger  │  │  Gossip    │  │            │
                    │  │ Hash-   │  │  Reconcile │  │            │
                    │  │ Chain   │  │  Pairing   │  │            │
                    │  └────┬────┘  └────────────┘  │            │
                    │       │                       │            │
                    │  ┌────▼────────────────────┐  │            │
                    │  │  PostgreSQL / YugabyteDB │  │            │
                    │  │  (users, transactions,   │  │            │
                    │  │   nfc_terminals, cards,  │  │            │
                    │  │   pos_charges, multisig) │  │            │
                    │  └─────────────────────────┘  │            │
                    └───────┬──────────┬────────────┘            │
                            │          │                         │
              ┌─────────────┘          └──────────────┐          │
              │                                       │          │
     ┌────────▼────────┐                   ┌──────────▼────────┐ │
     │  WEB APP (web/) │                   │  POS WEB (pos/)   │ │
     │  React/TS/Vite  │                   │  React/TS/Vite    │ │
     │  Member portal  │                   │  QR charge POS    │ │
     │  /main or /demo │                   │  /main or /demo   │ │
     └─────────────────┘                   └───────────────────┘ │
                                                   ▲
                                                   │ REST API (JWT)
                                                   │
     ┌─────────────────────────────────────────────┘
     │
     │  ┌──────────────────────────────────────────────────────┐
     │  │           POS ANDROID (punto-de-venta-pos/)          │
     │  │           Kotlin / Jetpack Compose                    │
     │  │                                                      │
     │  │  ┌──────────┐  ┌───────────┐  ┌───────────────────┐  │
     │  │  │ UI Layer │  │ ViewModel │  │  Data Layer       │  │
     │  │  │ Compose  │─►│ StateFlow │─►│  Repository       │  │
     │  │  │ Screens  │  │ PosUiState│  │  ├ API (Retrofit) │──┼──► REST API (encrypted)
     │  │  │ Components│ │           │  │  ├ Crypto(Ed25519)│  │
     │  │  └──────────┘  └───────────┘  │  ├ DB (Room)      │  │
     │  │                               │  └ Keystore       │  │
     │  │  NFC Reader ◄── Android NFC   └───────────────────┘  │
     │  └──────────────────────────────────────────────────────┘
     │
     │  ┌──────────────────────────────────────────────────────┐
     │  │         ESP32 / FLASH POS (firmware)                 │
     │  │         Hardware NFC terminal                        │
     │  │  Ed25519 identity · AES-256-GCM payload              │
     │  │  Compiled firmware per-chip (chip_id locked)         │
     │  └──────────────────────────────────────────────────────┘
     │
     └──────────────────────────────────────────────────────────────
```

### Key Data Flows

```
NFC Payment:
  Card → Android NFC Reader → ViewModel → Repository
       → CryptoEngine.encrypt(AES-256-GCM + Ed25519 sign)
       → Retrofit POST /api/nfc/terminal/payment
       → Go backend (decrypt, verify, ledger, encrypt response)
       → Repository.decrypt → ViewModel → UI

QR Charge:
  POS creates charge → POST /api/pos/charge → QR URL displayed
  Customer scans QR → Web app → POST /api/pos/charge/{token}/pay
  POS polls GET /api/pos/charge/{id}/status → "paid" → receipt

Federation:
  Node A transfers TQ to user on Node B
  → Federation protocol (mTLS, gossip)
  → Bilateral balance sync between nodes
  → Hash-chain ledger entries on both nodes
```
