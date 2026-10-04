# TqApp — cliente Matrix con UI estilo WhatsApp

## Arquitectura

- **Capa Matrix**: `org.matrix.rustcomponents:sdk-android` (Matrix Rust SDK, mismo motor que
  Element X). El SDK es la fuente única de verdad: sesión, sliding sync, store local cifrado,
  timelines, E2EE, verificación SAS y respaldo de claves.
- **Room** (`data/local`): solo datos puramente locales sin equivalente Matrix — historias
  (`stories`) y registro de llamadas (`calls`). Los chats/mensajes NO viven en Room.
- **UI models** (`data/model/UiModels.kt`): clases planas `RoomEntity`, `MessageEntity`,
  `ContactEntity`, `UserSessionEntity` que desacoplan Compose del SDK.
- **Retrofit** (`data/matrix/MatrixApiClient/Service`): solo login con token SSO y registro
  interactivo (UIA/reCAPTCHA), que el SDK no cubre. El logging usa `Level.BASIC` +
  `redactHeader("Authorization")` — nunca loguear tokens.

## Flujo principal

- `MatrixSessionManager`: construye `Client` (sessionPaths persistentes, cross-signing y
  backups automáticos), login, `restoreSession`, `syncService().withOfflineMode()`.
- **initPlatform()**: el SDK exige `initPlatform(TracingConfiguration, useLightweightRuntime)`
  una vez por proceso antes de cualquier operación de red — inicializa tokio y el verificador
  TLS. `MatrixSessionManager.ensurePlatformInitialized()` lo garantiza.
- **rustls-platform-verifier**: el AAR del SDK NO incluye la clase JVM
  `org.rustls.platformverifier.CertificateVerifier` (falta → `ClassNotFoundException` en
  `ClientBuilder.build()`). Se empaqueta `app/libs/rustls-platform-verifier-0.1.1.aar`,
  extraído del crate `rustls-platform-verifier-android` (crates.io, no está en Maven Central).
- `MatrixRepository`: escucha `roomListService().allRooms()` (entriesWithDynamicAdapters +
  loadingState), `RoomInfo` por sala, `Timeline` por conversación (paginateBackwards al hacer
  scroll arriba), `SessionVerificationController` (delegate → `VerificationUiState`),
  `Encryption` (verificationState/backupState, `recover`, `resetRecoveryKey`, `enableBackups`).
- `WhatsAppMatrixViewModel`: expone StateFlows a Compose. NO hay polling — todo via SDK flows.

## Build

```bash
gradle :app:assembleDebug   # no hay gradlew wrapper; gradle 9.7.1 via scoop
```

- `debug.keystore` en la raíz del repo es requerido por el `signingConfig` custom (alias
  `androiddebugkey` / pass `android`). Generar con `keytool` si falta.
- minSdk 24 (SDK requiere 21), compileSdk 36.
- El APK debug pesa ~250 MB por las libs nativas Rust de las 4 ABIs; usar ABI splits en release.

## Notas

- No loguear headers HTTP completos: los tokens Bearer quedarían expuestos en logcat.
- `VerificationUiState` en `MatrixRepository.kt` modela el diálogo SAS de emojis.
- La app es pre-release: `fallbackToDestructiveMigration()` descarta el viejo esquema Room
  (sessions/rooms/messages) automáticamente.
