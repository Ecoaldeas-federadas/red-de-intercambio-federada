# PROBLEMAS PENDIENTES - DEMO Y NODO

## INSTRUCCIONES
- Marca [x] cuando un problema esté resuelto
- Marca [~] cuando esté en progreso
- Marca [ ] cuando esté pendiente
- El usuario confirmará cuando algo esté arreglado

---

## SEEDS DE DATOS (Backend)

### 1. [x] Mi Balance = 0 TQ
- FIXED: Agregadas 8 transacciones del usuario demo
- FIXED: SQL interval corregido con make_interval()
- Commit: 130f034

### 2. [x] Transacciones simuladas no se ejecutaban
- FIXED: demoSeedTransactions ahora usa make_interval(hours => $N)
- FIXED: Ledger entries creados correctamente
- Commit: 130f034

### 3. [x] Seeds faltantes no se llamaban
- FIXED: Agregadas llamadas a demoSeedBoardMembers, demoSeedAdmissionRequests, demoSeedExternalOps, demoSeedFundProposals, demoSeedParityReports
- Commit: 130f034

### 4. [x] DemoAutoSetup no limpiaba todas las tablas
- FIXED: Ahora limpia 25+ tablas incluyendo las sin node_domain
- Commit: d576536

### 5. [x] assembly_decisions fallaba (required_signatures NOT NULL)
- FIXED: Agregado required_signatures=1 en INSERT
- Commit: 130f034

### 6. [x] Actas de asamblea vacías
- FIXED: Agregadas minutas completas con decisiones, votos, quorum
- Commit: 130f034

### 7. [x] Tienda vacía o con precios en cero
- FIXED: Store items ahora copian price_per_unit, unit, category del producto
- Commit: pendiente (este commit)

---

## FRONTEND (Arreglado en este commit)

### 8. [x] Pestaña "Historial de Transacciones" no sirve
- FIXED: Reemplazada por página "Billetera" (Wallet.tsx)
- Muestra transacciones con débito/crédito claro
- Muestra de quién a quién
- Muestra salidas (rojo, negativo) y entradas (verde, positivo)
- Resumen contable al final

### 9. [x] No hay billetera/wallet por cuenta
- FIXED: Nueva página Wallet.tsx
- Muestra saldo de la cuenta
- Selector de cuenta (personal, organizaciones, departamentos)
- Botones para transferir y pagar con QR
- Resumen de entradas y salidas

### 10. [x] Productos pendientes de aprobación no tienen pestaña visible
- FIXED: Agregado botón "Pendientes" en Products.tsx
- Muestra productos no aprobados con botones Aprobar/Rechazar
- Badge con contador de pendientes

### 11. [x] Nodos federados no muestran saldos
- FIXED: FederationPeers.tsx ahora carga y muestra saldo bilateral
- Muestra si te deben (+) o debes (-)
- Endpoint nuevo: /api/federation/balances

### 12. [x] /api/external/fc 404
- FIXED: Devuelve FC por defecto (5.0) si no hay datos
- Commit: pendiente

### 13. [x] /api/accounts/pending 400
- FIXED: Frontend cambiado a /api/admission/requests
- Commit: pendiente

### 14. [x] /api/organizations 500
- FIXED: COALESCE en organization_subtype y public_key (nullable)
- Commit: pendiente

### 15. [x] Endpoint reject product no existía
- FIXED: Agregado /api/products/{id}/reject
- Commit: pendiente

---

## PENDIENTE (Necesita trabajo adicional)

### 16. [ ] Departamentos no muestran cuenta ni movimientos
- Solo muestra lista de departamentos
- No hay vista de cuenta por departamento

### 17. [ ] Asambleas completadas: botón abre editar en vez de ver
- Debería abrir en modo "ver" con botón "editar" dentro

### 18. [ ] Configuración de Asamblea: "No hay configuración cargada"
- assembly_config vacío
- Necesita seed de assembly_config o cargar desde quorum_config

### 19. [ ] Service Worker error (sw.js addAll failed)
- sw.js no tolera fallos de assets individuales

### 20. [ ] Reportes de Paridad vacío
- Backend: seed creado en demoSeedParityReports
- Frontend: necesita verificar que muestre los datos

---

## NOTAS
- Commits anteriores: 130f034, d576536 (seeds)
- Este commit: Wallet, productos pendientes, saldos federados, fixes endpoints
- El usuario necesita: git pull + update.ps1
- Los problemas 16-20 necesitan trabajo adicional
