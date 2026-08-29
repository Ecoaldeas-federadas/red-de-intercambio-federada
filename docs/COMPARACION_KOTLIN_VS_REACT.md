# Comparación: Kotlin Nativo vs React Native para POS Android

## Contexto
La app del POS Android ya está implementada en **Kotlin nativo con Jetpack Compose**.
La documentación vieja (`docs/android-app-spec.md`) mencionaba React Native como opción principal, pero la realidad es que se construyó en Kotlin nativo.

## Comparación

| Criterio | Kotlin Nativo (actual) | React Native |
|----------|----------------------|--------------|
| Rendimiento | Excelente (bytecode nativo) | Bueno pero con overhead JS |
| Acceso NFC | Directo, APIs nativas | Requiere plugins de terceros |
| Android Keystore | Integración nativa directa | Complicado desde JS |
| Tamaño APK | Menor (~15-20 MB menos) | Mayor (incluye runtime JS) |
| Batería | Óptimo | Overhead del motor JS |
| Multiplataforma | Solo Android | Android + iOS |
| Criptografía Ed25519 | BouncyCastle integrado | Librerías limitadas |
| Feedback sonoro/háptico | AudioTrack, Vibrator directos | APIs limitadas |
| Hot reload | No (Compose Preview ayuda) | Sí |
| Curva de aprendizaje | Kotlin + Android | React/JS (más conocido) |

## Recomendación
Para un POS que maneja **pagos NFC, criptografía Ed25519, Android Keystore y feedback sonoro**, Kotlin nativo es superior. La app ya funciona con todas estas características de forma nativa.

La documentación debe actualizarse para reflejar que la app es Kotlin nativo con Jetpack Compose.
