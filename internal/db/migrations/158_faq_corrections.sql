-- Migracion 158: Corregir 3 FAQs incorrectas y anadir FAQ sobre limite excedido
-- Las FAQs se guardan como JSON en public_pages.content (tipo 'faq').
-- Esta migracion usa jsonb_replace para actualizar los textos exactos.

-- 1. FAQ "¿Qué pasa si pierdo mi tarjeta?" — corregir
UPDATE public_pages
SET content = REPLACE(
  content,
  'Avísale al administrador de la comunidad inmediatamente. El puede desactivar tu tarjeta perdida y emitirte una nueva. Nadie puede usar tu tarjeta perdida una vez que está desactivada. Tu saldo no se pierde: está asociado a tu cuenta, no a la tarjeta física.',
  'Puedes bloquearla tú mismo inmediatamente desde tu perfil en la web (Mi Perfil → Mis Tarjetas NFC → Desactivar). Nadie podrá usar la tarjeta bloqueada. Tu saldo no se pierde: está asociado a tu cuenta, no a la tarjeta física. Para obtener una tarjeta nueva, sí necesitas comunicarte con el administrador, quien verificará tu identidad y emitirá una nueva tarjeta.'
)
WHERE content LIKE '%Avísale al administrador de la comunidad inmediatamente%';

-- 2. FAQ "¿El terminal POS funciona sin internet?" — corregir
UPDATE public_pages
SET content = REPLACE(
  content,
  'El terminal POS puede funcionar sin internet por un tiempo, guardando las transacciones localmente. Cuando recupera conexión, sincroniza con el servidor. Esto es útil para ferias en lugares sin buena señal. Pero es importante que sincronice pronto para evitar problemas.',
  'El terminal POS requiere conexión al servidor del nodo (por intranet o internet). Sin conexión no puede procesar pagos porque necesita validar el saldo del usuario y registrar la transacción en la base de datos. Solo el cierre de turno puede hacerse sin conexión y sincronizarse después. Para ferias en lugares sin señal, existe el modo Nodo Satélite (consultá la documentación).'
)
WHERE content LIKE '%El terminal POS puede funcionar sin internet por un tiempo%';

-- 3. FAQ "¿Puedo ver mi saldo desde mi teléfono?" — corregir
UPDATE public_pages
SET content = REPLACE(
  content,
  'Sí, si la comunidad tiene la aplicación móvil instalada, puedes ver tu saldo, tu historial de transacciones, y participar en asambleas digitales desde tu teléfono. Pregúntale al administrador cómo acceder.',
  'Sí. Entra desde el navegador de tu teléfono a la dirección del nodo (pregúntasela al administrador). Puedes ver tu saldo, historial de transacciones, participar en asambleas digitales y gestionar tu tarjeta NFC. No necesitas instalar nada — es una aplicación web. Si en el futuro existe una app móvil nativa, el administrador te informará cómo acceder.'
)
WHERE content LIKE '%Sí, si la comunidad tiene la aplicación móvil instalada%';

-- 4. Anadir nueva FAQ "¿Qué pasa si me paso de mi límite de crédito?" despues de "¿Puedo ver mi saldo desde mi teléfono?"
-- Solo si no existe ya
UPDATE public_pages
SET content = REPLACE(
  content,
  '"¿Puedo ver mi saldo desde mi teléfono?","answer":"Sí. Entra desde el navegador de tu teléfono a la dirección del nodo (pregúntasela al administrador). Puedes ver tu saldo, historial de transacciones, participar en asambleas digitales y gestionar tu tarjeta NFC. No necesitas instalar nada — es una aplicación web. Si en el futuro existe una app móvil nativa, el administrador te informará cómo acceder."}',
  '"¿Puedo ver mi saldo desde mi teléfono?","answer":"Sí. Entra desde el navegador de tu teléfono a la dirección del nodo (pregúntasela al administrador). Puedes ver tu saldo, historial de transacciones, participar en asambleas digitales y gestionar tu tarjeta NFC. No necesitas instalar nada — es una aplicación web. Si en el futuro existe una app móvil nativa, el administrador te informará cómo acceder."},{"question":"¿Qué pasa si me paso de mi límite de crédito?","answer":"Si tu saldo queda por debajo de tu límite de crédito (por ejemplo, por compras offline concurrentes en un nodo satélite que se sincronizaron después), tu cuenta se marca como \"sobre límite\". No podrás hacer nuevas compras hasta que recibas suficientes TQ (vendiendo o recibiendo transferencias) para volver a estar dentro de tu límite. Eres responsable de no exceder tu límite. Si te excedes, regulariza lo antes posible. La asamblea puede penalizar a miembros que excedan su límite repetidamente."}'
)
WHERE content LIKE '%¿Puedo ver mi saldo desde mi teléfono?%'
  AND content NOT LIKE '%¿Qué pasa si me paso de mi límite de crédito?%';
