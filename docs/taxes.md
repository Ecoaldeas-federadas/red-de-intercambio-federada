# Impuestos y Fondo Comunitario

## Concepto

Cada transaccion interna aplica una tasa de impuesto (`tax_rate`) definida por el nivel de miembro del remitente. El impuesto se debita adicionalmente al remitente y se acredita al fondo comunitario.

## Configuracion

### Por Nivel de Miembro
- `member_levels.tax_rate`: tasa de impuesto (DECIMAL 5,4)
- Default: 0.0 (sin impuesto para nivel `new`)
- Configurable por asamblea

### Por Organizacion
- `users.tax_rate`: tasa especifica de organizacion
- Instituciones publicas: tax_rate = 0 (exentas)

## Fondo Comunitario

### Cuenta del Fondo
- Tipo: `fund` en tabla `users`
- Recibe los debitos de impuesto de todas las transacciones
- Gestionado con multi-firma (required_signatures, authorized_signers)

### Uso del Fondo
- Gasto aprobado por asamblea o consejo
- Propuestas multi-firma para ejecutar gastos
- Tipicos: infraestructura, servicios publicos, ayuda mutual

## Flujo de Impuesto

1. Transaccion: remitente envia X unidades a receptor
2. Impuesto = X * tax_rate
3. Debit remitente: X + impuesto
4. Credit receptor: X
5. Credit fondo comunitario: impuesto
6. Ledger entries:
   - debit (remitente, user_balance, X + impuesto)
   - credit (receptor, user_balance, X)
   - credit (fondo, tax, impuesto)

## Tablas Relacionadas

- `transactions.tax_amount`: monto del impuesto
- `transactions.tax_target_account`: cuenta del fondo
- `ledger_entries` con `account_category = 'tax'`: entradas de impuesto
