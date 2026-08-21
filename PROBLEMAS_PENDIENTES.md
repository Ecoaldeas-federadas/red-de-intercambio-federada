# PROBLEMAS PENDIENTES - DEMO Y NODO

## ESTADO: [ ] PENDIENTE / [x] RESUELTO

---

### 1. [ ] Mi Balance = 0 TQ
- El usuario demo no tiene transacciones propias
- Necesita transacciones donde el usuario 'demo' sea sender o receiver
- El balance se calcula de ledger_entries

### 2. [ ] Pestaña "Historial de Transacciones" no sirve
- No muestra de quién ni a quién
- No muestra si es débito o crédito
- Debe eliminarse o reemplazarse por historial por cuenta
- Cada cuenta debe tener su propia pestaña de transacciones

### 3. [ ] No hay billetera/wallet por cuenta
- No se puede ver saldo + transacciones de una cuenta específica
- Debe existir para: personas, organizaciones, departamentos, asamblea
- Debe mostrar transacciones con débito/crédito claramente
- Debe permitir transferir desde esa cuenta si estás autorizado

### 4. [ ] No se ven cuentas de organizaciones/departamentos
- Como superadmin debería ver todas las cuentas
- Cada usuario debería ver cuentas que puede manejar
- Falta UI para ver y gestionar cuentas de organizaciones

### 5. [ ] Productos pendientes de aprobación no tienen pestaña visible
- Backend: /api/products/pending existe
- Frontend: no hay pestaña/sección para mostrarlos

### 6. [ ] Mi Tienda vacía
- El usuario demo no tiene store_items
- Necesita seed de store_items para usuario 'demo'

### 7. [ ] Todas las Tiendas vacía
- No hay store_items en la BD
- Necesita reset de BD con seed actualizado

### 8. [ ] Nodos federados no muestran saldos
- Solo muestra nombres y estado
- No muestra balance positivo/negativo con cada nodo
- No hay botón para ver historial de transacciones con ese nodo

### 9. [ ] Reportes de Paridad vacío
- No hay reportes generados
- Necesita transacciones federadas + reportes simulados

### 10. [ ] /api/organizations sigue dando 500
- El contenedor no tiene el código nuevo
- Necesita reconstruir

### 11. [ ] Departamentos no muestran cuenta ni movimientos
- Solo muestra lista de departamentos
- No hay vista de cuenta por departamento

### 12. [ ] Asamblea: no hay propuestas
- Seed de assembly_decisions no se ejecutó
- Necesita reset de BD

### 13. [ ] Informes de Votación: todo en cero
- No hay votos simulados
- Necesita reset de BD

### 14. [ ] Asambleas pasadas: minuta vacía
- Las sesiones se crearon pero sin minuta (acta)
- Necesita llenar minutas con decisiones simuladas
- El botón debe abrir en modo "ver" no "editar"

### 15. [ ] Configuración de Asamblea: "No hay configuración cargada"
- assembly_config vacío
- Necesita seed de assembly_config

### 16. [ ] Auditoría vacía
- No hay audit_log
- Necesita reset de BD con seed actualizado

### 17. [ ] Comercio Externo vacío
- No hay external_bridge_operations
- Necesita reset de BD

### 18. [ ] Solicitudes de Admisión vacías
- No hay admission_requests
- Necesita reset de BD

### 19. [ ] Fondo Comunitario = 0 TQ
- No hay impuestos recaudados
- No hay propuestas de distribución
- Necesita reset de BD

### 20. [ ] /api/external/fc 404
- GetCurrentFC devuelve error cuando no hay datos
- Debería devolver un valor por defecto

### 21. [ ] /api/accounts/pending 400
- Error de bad request, investigar

### 22. [ ] Configuración de impuestos confusa
- Muestra 1% a "all" pero no explica cómo configurar por tipo
- No coincide con impuestos por nivel/organización
- Necesita UI para configurar impuestos por tipo de cuenta

### 23. [ ] Límites bilaterales: todos dicen "Confirmar"
- Deberían aparecer como confirmados en el demo
- remote_confirmed=true en seed

### 24. [ ] icon.svg 404 + Service Worker error
- Manifest con ruta relativa ya arreglado en código
- Necesita rebuild del frontend

---

## NOTAS
- La mayoría de problemas se resuelven reconstruyendo el demo + reset BD
- Los seeds ya están en el código pero no se han ejecutado
- Problemas estructurales (billetera por cuenta, historial por cuenta) requieren cambios de UI
