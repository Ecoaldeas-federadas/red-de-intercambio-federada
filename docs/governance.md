# Gobernanza - Ley de la Aldea

## Resumen

El sistema incluye un modulo de gobernanza completo que define las reglas de convivencia de la ecoaldea: la "Ley de la Aldea". Estas reglas son editables por el administrador y se muestran a los visitantes en la pagina publica, a los aspirantes en el formulario de admision (con aceptacion obligatoria) y a los miembros en el panel de administracion.

## Componentes

### 1. Tabla `governance_rules`

Almacena las reglas de gobernanza con las siguientes categorias:

| Categoria | Descripcion |
|-----------|-------------|
| `estructura` | Como se gobierna la aldea (asamblea, circulos, junta) |
| `deberes` | Obligaciones de los miembros (cayapa, agroecologia, TQ) |
| `permitido` | Lo que se puede hacer |
| `prohibido` | Lo que no se puede hacer |
| `faltas_leves` | Infracciones leves y sanciones |
| `faltas_graves` | Infracciones graves y sanciones |
| `faltas_muy_graves` | Causales de expulsion |
| `admision` | Proceso para unirse (3 fases) |
| `salida` | Proceso de retiro y FRNE |
| `impuestos` | Como funcionan los impuestos |
| `tierra` | Tenencia de la tierra (fideicomiso) |

Cada regla tiene:
- `severity`: info, leve, grave, muy_grave
- `icon`: icono de la libreria lucide
- `sort_order`: orden dentro de la categoria
- `is_active`: se puede desactivar sin eliminar

### 2. Endpoints API

#### Publicos (sin auth)
- `GET /api/public/governance` - Lista todas las reglas activas

#### Privados (requieren auth)
- `GET /api/governance/rules` - Lista todas las reglas
- `POST /api/governance/rules` - Crear regla (requiere `governance.manage`)
- `PUT /api/governance/rules/{id}` - Actualizar regla (requiere `governance.manage`)
- `DELETE /api/governance/rules/{id}` - Eliminar regla (requiere `governance.manage`)

### 3. Pagina Publica

La pagina `/p/gobernanza` muestra todas las reglas agrupadas por categoria:
- Estructura de Gobernanza (asamblea, circulos, junta, doble enlace, organizaciones, departamentos)
- Deberes de los Miembros (agroecologia, cayapa, TQ, semillas, asambleas)
- Lo Que Esta Permitido (bioconstruccion, banos secos, microrred, comercio TQ, organizaciones, federacion)
- Lo Que Esta Prohibido (agroquimicos, venta de tierra, usura, acumulacion, quema, quimicos)
- Faltas y Sanciones (leves, graves, muy graves)
- Proceso de Admision (3 fases: aspirante, provisional, pleno)
- Proceso de Salida y Restitucion (FRNE, pago diferido, expulsion)
- Tenencia de la Tierra (fideicomiso, usufructo, no venta)
- Impuestos y Fondo Comunitario

### 4. Interfaz Admin

La pagina `/app/governance` permite:
- Ver todas las reglas agrupadas por categoria
- Filtrar por categoria
- Crear nuevas reglas
- Editar reglas existentes
- Eliminar reglas
- Requiere permiso `governance.manage` o `config.manage`

### 5. Integracion con Admision

El formulario de admision publica (`DynamicAdmissionForm`) carga las reglas de gobernanza desde `/api/public/governance` y muestra:
- Un resumen de cuantas reglas hay
- Un boton "Leer reglas" que despliega todas las reglas con su severidad
- Un checkbox de aceptacion obligatoria: "He leido y acepto la Ley de la Aldea"
- Si no se acepta, no se puede enviar la solicitud

## Estructura de Gobernanza

### Asamblea General
Organo maximo de decision. Se reune mensualmente. Todos los miembros plenos tienen voz y voto. Las decisiones se toman por consentimiento sociocratico.

### Circulos Operativos
- Circulo de Agua y Tierra
- Circulo de Habitabilidad
- Circulo de Agroecologia
- Circulo de Economia Solidaria
- Circulo de Convivencia y Admisiones

### Junta Directiva del Nodo
Organo ejecutivo: Coordinador General, Tesorero, Secretario y Coordinadores de cada circulo. Cargos de 1 ano, revocables.

### Doble Enlace Sociocratico
Cada circulo elige dos personas que lo conectan con la Asamblea: un Coordinador y un Delegado.

## Proceso de Admision (3 Fases)

1. **Aspirante (1-3 meses)**: Vive en area de visitantes, participa en cayapas, acceso limitado a TQ
2. **Residente Provisional (6-12 meses)**: Asignacion de espacio temporal, voz pero no voto
3. **Miembro Pleno**: Consentimiento del Circulo de Convivencia, firma del Acuerdo de Vida Conuquera, parcela y conuco, limites completos (-500/+500 TQ)

## Formula de Restitucion No Especulativa (FRNE)

```
R_neto = I_ini - D_desgaste - C_restauracion +/- B_TQ - T_salida
```

- `I_ini`: Inversion en materiales (adobes, madera, paneles solares)
- `D_desgaste`: Amortizacion anual (3-4% sobre valor de construccion)
- `C_restauracion`: Costo de reparar danos al territorio
- `B_TQ`: Balance contable TQ (negativo se resta, positivo se suma)
- `T_salida`: 15% de retencion solidaria para el Fondo Comunitario

Pago diferido en cuotas mensuales (12-24 meses) para no desestabilizar la economia del nodo.

## Tenencia de la Tierra

- **Fideicomiso Comunitario**: La tierra es colectiva, indivisible e inalienable
- **Derecho de Usufructo**: Se otorga mientras la membresia este activa
- **Prohibicion de Venta**: No se puede vender a terceros en el mercado abierto

## Migracion

- `048_governance_rules.sql` - Crea la tabla y inserta el seed inicial con ~40 reglas
- Permiso `governance.manage` para gestionar las reglas

## Archivos Relevantes

- `internal/db/migrations/048_governance_rules.sql` - Migracion y seed
- `internal/api/system.go` - Endpoints API CRUD
- `internal/db/seed.go` - Pagina publica "gobernanza"
- `web/src/pages/Governance.tsx` - Interfaz admin
- `web/src/components/public-site/DynamicAdmissionForm.tsx` - Aceptacion en admision
- `web/src/App.tsx` - Ruta `/app/governance`
- `web/src/components/Layout.tsx` - Enlace en sidebar
