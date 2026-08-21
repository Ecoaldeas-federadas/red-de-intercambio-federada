# Impuestos y Cuenta de la Asamblea

## Concepto

Cada transaccion interna aplica una tasa de impuesto (`tax_rate`) definida por el nivel del remitente. El impuesto se debita adicionalmente al remitente y se acredita a la **cuenta de la Asamblea**.

## Modelo

### Cuenta de la Asamblea (predefinida)

- La cuenta de la Asamblea **ya existe**, no hay que configurarla.
- Los impuestos llegan **automaticamente** a esta cuenta.
- Lo que se decide en asamblea es **a donde distribuir** el dinero (salida), no la entrada.
- Para gastar el dinero, se crea una propuesta de "Distribucion de fondos" indicando la cuenta destino y el monto.

### Resolucion de la tasa de impuesto

El handler de transferencias (`internal/api/handlers.go`) resuelve la tasa de impuesto en este orden de precedencia:

1. **Override del usuario** (`users.tax_rate`): si es positivo, se usa ese.
2. **Nivel del miembro** (`member_levels.tax_rate`): si el emisor es persona, se busca el tax_rate de su nivel.
3. **Nivel de organizacion** (`organization_levels.tax_rate`): si el emisor es organizacion, se busca el tax_rate de su nivel.
4. **Configuracion global** (`tax_config`): si no hay tasa por nivel, se usa la configuracion del nodo.

### Destino del impuesto

El impuesto se envia a la cuenta destino en este orden:

1. **Cuenta de la Asamblea** (`username = 'asamblea'`): destino preferido.
2. **Cuenta de impuestos** (`username = 'impuestos'`): fallback si no hay asamblea.
3. **`tax_config.tax_account_id`**: ultimo fallback.

### Tasas por nivel en el demo seed

| Nivel de miembro | Tasa | Rationale |
|-----------------|------|-----------|
| raiz | 0.5% | Fundadores aportan poco, ya contribuyen mucho |
| tronco | 1.0% | Miembros con mas de 2 anos |
| rama | 1.5% | Miembros con mas de 6 meses |
| brote | 2.0% | Nuevos aportan mas, incentivo a ascender |

| Nivel de organizacion | Tasa |
|----------------------|------|
| org_produccion | 2.0% |
| org_consumo | 1.0% |
| org_publica | 0.0% (exenta) |
| org_cooperativa | 1.0% |

### Reglas de distribucion

| Scope | Puede transferir a | No puede transferir a |
|-------|-------------------|---------------------|
| Asamblea del nodo | Organizaciones, Departamentos | **Personas** (nunca directamente) |
| Organizacion | Organizaciones, Departamentos, Personas | — |
| Departamento | Organizaciones, Departamentos, Personas | — |

### Ejemplo del flujo

1. Las transacciones generan impuestos que llegan a la cuenta de la Asamblea.
2. La asamblea decide transferir 1000 TQ al "Departamento de Pagos".
3. El Departamento de Pagos decide pagar a los trabajadores.
4. El depto crea una propuesta de distribucion a una persona.
5. Se ejecuta la transferencia a la persona.

## Configuracion

### Por Nivel de Miembro
- `member_levels.tax_rate`: tasa de impuesto (DECIMAL 5,4)
- El demo seed configura: raiz=0.5%, tronco=1%, rama=1.5%, brote=2%
- Configurable por asamblea

### Por Nivel de Organizacion
- `organization_levels.tax_rate`: tasa especifica del nivel de organizacion
- org_publica: 0% (exenta)
- Configurable por asamblea

### Por Usuario (override)
- `users.tax_rate`: override personal
- Si es positivo, prevalece sobre el nivel
- Por defecto es 0 (sin override)

### Tabla `tax_config`
- `node_domain`: nodo al que pertenece
- `tax_account_id`: cuenta de la asamblea (predefinida)
- `tax_rate`: tasa actual
- `is_active`: si el impuesto esta activo
- `min_amount`: monto minimo de transaccion para aplicar impuesto
- `applies_to`: a que tipo de transacciones aplica (all, exchange, external)

### Tabla `tax_distributions`
- Registra las distribuciones de fondos aprobadas en asamblea
- `from_account`: cuenta de la asamblea
- `to_account`: cuenta destino (org, depto)
- `amount`: monto
- `status`: pending, executed, rejected

## Permisos del Administrador

El administrador es la autoridad maxima durante el arranque del sistema. Puede:
- Cambiar la tasa de impuesto directamente
- Admitir miembros
- Tomar todas las decisiones iniciales

Una vez que el sistema esta funcionando y la asamblea esta activa, el admin se inhabilita. A partir de ahi, los cambios se hacen por votacion en asamblea.

## Flujo de Impuesto

1. Transaccion: remitente envia X unidades a receptor
2. Resolver tasa: users.tax_rate > member_levels.tax_rate > organization_levels.tax_rate > tax_config
3. Impuesto = X * tasa
4. Debit remitente: X + impuesto
5. Credit receptor: X
6. Credit cuenta de la Asamblea: impuesto
7. Ledger entries:
   - debit (remitente, user_balance, X + impuesto)
   - credit (receptor, user_balance, X)
   - credit (asamblea, fund, impuesto)

## Tablas Relacionadas

- `tax_config` - Configuracion de impuestos por nodo (fallback)
- `tax_distributions` - Distribuciones aprobadas en asamblea
- `member_levels.tax_rate` - Tasa por nivel de miembro
- `organization_levels.tax_rate` - Tasa por nivel de organizacion
- `users.tax_rate` - Override personal
- `transactions.tax_amount`: monto del impuesto
- `transactions.tax_target_account`: cuenta de la asamblea
- `ledger_entries` con `account_category = 'fund'`: entradas de impuesto

## Migraciones

- `007_tax_board_votes.sql` - Tabla `tax_config` inicial
- `056_assembly_advance_tax.sql` - Tabla `tax_config` (UNIQUE), `tax_distributions`, tiempos minimos
- Demo seed: configura `tax_rate` en `member_levels` y `organization_levels`

## Archivos Relevantes

- `internal/taxes/calculator.go` - Calculadora de impuestos (GetTaxRate, GetFundAccount)
- `internal/api/handlers.go` - Handler de transferencias (resolucion de tasa por nivel)
- `internal/api/tax.go` - API de configuracion de impuestos
- `internal/db/demo_seed.go` - Seed con tasas por nivel
