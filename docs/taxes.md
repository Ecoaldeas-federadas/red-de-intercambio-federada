# Impuestos y Cuenta de la Asamblea

## Concepto

Cada transaccion interna aplica una tasa de impuesto (`tax_rate`) definida por el nivel de miembro del remitente. El impuesto se debita adicionalmente al remitente y se acredita a la **cuenta de la asamblea**.

## Modelo

### Cuenta de la asamblea (predefinida)

- La cuenta de la asamblea **ya existe**, no hay que configurarla.
- Los impuestos llegan **automaticamente** a esta cuenta.
- Lo que se decide en asamblea es **a donde distribuir** el dinero (salida), no la entrada.
- Para gastar el dinero, se crea una propuesta de "Distribucion de fondos" indicando la cuenta destino y el monto.

### Reglas de distribucion

| Scope | Puede transferir a | No puede transferir a |
|-------|-------------------|---------------------|
| Asamblea del nodo | Organizaciones, Departamentos | **Personas** (nunca directamente) |
| Organizacion | Organizaciones, Departamentos, Personas | — |
| Departamento | Organizaciones, Departamentos, Personas | — |

### Ejemplo del flujo

1. Las transacciones generan impuestos que llegan a la cuenta de la asamblea.
2. La asamblea decide transferir 1000 TQ al "Departamento de Pagos".
3. El Departamento de Pagos decide pagar a los trabajadores.
4. El depto crea una propuesta de distribucion a una persona.
5. Se ejecuta la transferencia a la persona.

## Configuracion

### Por Nivel de Miembro
- `member_levels.tax_rate`: tasa de impuesto (DECIMAL 5,4)
- Default: 0.0 (sin impuesto para nivel `new`)
- Configurable por asamblea

### Por Organizacion
- `users.tax_rate`: tasa especifica de organizacion
- Instituciones publicas: tax_rate = 0 (exentas)

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
2. Impuesto = X * tax_rate
3. Debit remitente: X + impuesto
4. Credit receptor: X
5. Credit cuenta de la asamblea: impuesto
6. Ledger entries:
   - debit (remitente, user_balance, X + impuesto)
   - credit (receptor, user_balance, X)
   - credit (asamblea, tax, impuesto)

## Tablas Relacionadas

- `tax_config` - Configuracion de impuestos por nodo
- `tax_distributions` - Distribuciones aprobadas en asamblea
- `transactions.tax_amount`: monto del impuesto
- `transactions.tax_target_account`: cuenta de la asamblea
- `ledger_entries` con `account_category = 'tax'`: entradas de impuesto

## Migraciones

- `056_assembly_advance_tax.sql` - Tabla `tax_config`, `tax_distributions`, tiempos minimos de anticipacion
