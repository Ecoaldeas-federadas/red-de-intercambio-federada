-- Migracion 156: Sincronizar pagina FAQ con los 14 bloques completos del template
-- El seed original solo tenia 1 bloque FAQ con 7 preguntas.
-- El template del frontend tiene 14 bloques FAQ con muchas mas preguntas.
-- Esta migracion actualiza la pagina FAQ existente con el contenido completo.

UPDATE public_pages
SET content = '[
  {
    "type": "hero",
    "badge": "💡 Centro de Respuestas",
    "title": "Preguntas Frecuentes",
    "subtitle": "Información clara sobre cómo comprar, participar, truequear y sumarte a la feria.",
    "image_url": "/placeholder.svg",
    "style": "standard"
  },
  {
    "type": "faq",
    "title": "Para Visitantes y Compradores",
    "items": [
      {
        "question": "¿Necesito ser miembro de la feria para comprar productos?",
        "answer": "¡No! Nuestro evento mensual es un mercado a cielo abierto abierto a todo el público general. Cualquier persona puede venir y comprar hortalizas frescas, tubérculos, quesos, panes, botica natural y comida artesanal directamente de los productores pagando en moneda local."
      },
      {
        "question": "¿Cuándo y en qué horario se realiza el mercado mensual?",
        "answer": "Se realiza el primer sábado de cada mes en el Parque Los Caobos de Caracas (área sur, cerca del estacionamiento y la Fuente Venezuela), desde las 9:00 AM hasta la 1:00 PM aproximadamente."
      },
      {
        "question": "¿Cómo llegar en transporte público?",
        "answer": "Puedes llegar cómodamente en Metro de Caracas bajándote en la estación Bellas Artes o Colegio de Ingenieros (Línea 1). Desde ambas estaciones caminas unos 5 minutos hacia el Parque Los Caobos."
      },
      {
        "question": "¿Por qué está prohibido el uso de bolsas plásticas desechables?",
        "answer": "Porque la agroecología es un compromiso ético de cuidado hacia la Madre Tierra. El plástico contamina suelos y ríos. Te invitamos a traer bolsas reutilizables de tela, morrales, recipientes o canastas."
      },
      {
        "question": "¿Qué actividades culturales y formativas se realizan durante la feria?",
        "answer": "En cada jornada mensual se ofrecen talleres gratuitos de siembra y lombricultura, trueque libre de semillas criollas, intercambio de libros (\"Dona y adopta un libro\"), música popular en vivo y actividades lúdicas para niños y familias."
      },
      {
        "question": "¿Puedo pagar con tarjeta de débito o crédito?",
        "answer": "El comercio exterior (ventas al público general) se realiza en moneda local del país (pesos, bolívares, soles, etc.). Algunos puestos pueden aceptar transferencias o pagos digitales, pero le recomendamos traer efectivo. El trueque interno entre miembros funciona con la moneda TQ, pero eso es solo para miembros registrados."
      },
      {
        "question": "¿Puedo llevar mis propios productos para vender?",
        "answer": "Para vender necesitas ser miembro registrado. Si eres productor agroecológico, artesano o tienes un emprendimiento compatible con los valores de la feria, puedes solicitar admisión. La asamblea evaluará tu solicitud y, si eres aceptado, recibirás un puesto y acceso al sistema de trueque."
      },
      {
        "question": "¿La feria es solo para productores agroecológicos?",
        "answer": "No necesariamente. Aunque la agroecología es nuestro corazón, también hay lugar para artesanos, productores de alimentos procesados (panes, quesos, conservas), herbolaria, productos de higiene natural, y servicios comunitarios. Lo importante es que lo que ofrezcas sea coherente con los valores de cuidado de la tierra y el trueque."
      }
    ]
  },
  {
    "type": "faq",
    "title": "Sobre el Trueque y la Moneda TQ",
    "items": [
      {
        "question": "¿Qué es la moneda TQ?",
        "answer": "TQ es la unidad de medida del trueque interno entre miembros. No es dinero físico ni se puede comprar ni vender por dinero. Es una unidad contable que mide cuánto aportas y cuánto recibes dentro de la comunidad. 1 TQ equivale a 1 kWh de energía, es decir, a una hora de trabajo humano. No tiene inflación porque no está atada al dólar ni al oro, sino a las leyes de la física."
      },
      {
        "question": "¿Por qué el saldo perfecto es cero?",
        "answer": "El objetivo de todo miembro es que su saldo sea cero. Si tu saldo está en cero, significa que has aportado a la comunidad exactamente lo mismo que has recibido de ella. Eso es equilibrio. Si tu saldo está muy negativo, significa que estás recibiendo mucho pero aportando poco: tienes que aportar más para llegar a cero. Si tu saldo está muy positivo, significa que estás aportando mucho pero no aprovechando lo que la comunidad ofrece: tienes que recibir más para llegar a cero. El saldo cero es la meta de todos."
      },
      {
        "question": "¿Es preferible tener saldo positivo o negativo?",
        "answer": "Técnicamente, si tu saldo está en positivo es porque alguien más está en negativo. Lo ideal es que todos tiendan a cero. Pero si vas a estar en un lado, es preferible estar ligeramente en positivo (aportando un poco más de lo que recibes) que en negativo (recibiendo más de lo que aportas). Un saldo muy negativo sostenido significa que la comunidad te está sosteniendo, y eso no es sostenible a largo plazo."
      },
      {
        "question": "¿Qué pasa si mi saldo se va muy negativo?",
        "answer": "Si tu saldo baja demasiado, el sistema te avisa. Tienes que aportar más (vender productos, ofrecer trabajo, dar talleres) para subir tu saldo. Si no logras subirlo, la asamblea puede revisar tu caso. La idea no es castigar, sino ayudarte a encontrar equilibrio. Pero si una persona solo recibe y nunca aporta, la asamblea puede decidir que ya no puede seguir en el sistema."
      },
      {
        "question": "¿Por qué para entrar a la comunidad tengo que tener algo que aportar?",
        "answer": "Porque el trueque funciona así: tú aportas algo que la comunidad necesita, y la comunidad te aporta algo que tú necesitas. Si entras sin nada que aportar, solo estarías recibiendo de los demás sin devolver nada. Eso desequilibra el sistema y no es justo para los demás miembros. Muchas monedas comunitarias fracasan precisamente porque entra mucha gente que solo quiere recibir y poca gente que aporta. Por eso, antes de entrar, tienes que preguntarte: ¿Qué tengo yo que la comunidad pueda necesitar? ¿Qué tiene la comunidad que yo pueda necesecer? Si ambas respuestas son positivas, vale la pena que te integres."
      },
      {
        "question": "¿Qué cosas puedo aportar?",
        "answer": "Puedes aportar productos (frutas, verduras, huevos, panes, artesanías, conservas, medicina natural), servicios (reparaciones, transporte, clases, cuidado de niños, peluquería), trabajo (ayuda en conucos, construcción, limpieza, organización de eventos), o conocimientos (talleres, asesorías, mentorías). Todo lo que la comunidad valore puede ser un aporte. No tiene que ser solo cosas materiales: el tiempo y el talento también cuentan."
      },
      {
        "question": "¿Cómo sé si vale la pena integrarme a la comunidad?",
        "answer": "Hazte estas preguntas antes de solicitar admisión: 1) ¿Tengo algo que aportar que la comunidad pueda necesitar? (productos, trabajo, talentos, servicios). 2) ¿Tiene la comunidad algo que yo necesite o me interese? (alimentos, trabajo, servicios, conexión con otras personas). 3) ¿Estoy dispuesto a participar activamente, no solo a recibir? Si las tres respuestas son sí, entonces vale la pena que te integres. Si solo quieres recibir pero no tienes nada que aportar, el trueque no te va a funcionar."
      },
      {
        "question": "¿La moneda TQ tiene inflación?",
        "answer": "No. La moneda TQ no tiene inflación porque no está atada al dinero de ningún país ni al oro. Está atada a la energía: 1 TQ = 1 kWh. La energía no se devalúa. Una hora de trabajo hoy vale lo mismo que una hora de trabajo dentro de 10 años. Esto significa que lo que ahorras en TQ mantiene su valor real con el tiempo, a diferencia del dinero en el banco que pierde valor cada mes por la inflación."
      },
      {
        "question": "¿Puedo acumular TQ para hacerme \"rico\"?",
        "answer": "El sistema no está diseñado para que nadie se haga rico acumulando números. El objetivo es el equilibrio: aportar y recibir en proporción similar. Acumular mucho TQ significa que estás aportando mucho pero no aprovechando lo que la comunidad ofrece. En lugar de acumular TQ, te invitamos a acumular riqueza real y tangible: tu vivienda, tu conuco, tus herramientas, tus semillas, tus relaciones comunitarias. Eso sí es riqueza de verdad."
      },
      {
        "question": "¿Qué son los límites de crédito?",
        "answer": "Los límites de crédito son como escalones de confianza. Un miembro nuevo inicia con un límite bajo, equivalente a su canasta básica familiar, para proteger a la comunidad. A medida que participas, aportas y demuestras compromiso, la asamblea puede subir tu límite. No es un castigo ni una restricción: es una medida de protección para que nadie entre, reciba mucho y se vaya sin aportar."
      },
      {
        "question": "¿Las ventas al público se mezclan con el trueque?",
        "answer": "¡No! Las ventas al público general son externas y se pagan en moneda local del país (pesos, bolívares, etc.). El trueque TQ es solo entre miembros registrados. Los compradores externos no tienen cuentas TQ ni participan del trueque. Esto es muy importante: no podemos mezclar las ventas al público con el trueque, porque son cosas distintas con reglas distintas."
      },
      {
        "question": "¿Qué pasa si quiero salir de la comunidad?",
        "answer": "Puedes salir cuando quieras. Lo ideal es que antes de salir, tu saldo esté en cero o cercano a cero. Si tu saldo está muy negativo (recibiste más de lo que aportaste), la asamblea puede pedirte que aportes algo antes de irte para equilibrar tu cuenta. Si tu saldo está positivo, simplemente pierdes ese saldo al salir, ya que el TQ no tiene valor fuera de la comunidad."
      }
    ]
  },
  {
    "type": "faq",
    "title": "Para Quienes Quieren Unirse",
    "items": [
      {
        "question": "¿Quiénes pueden solicitar admisión?",
        "answer": "Cualquier persona, familia, cooperativa o colectivo que tenga algo que aportar a la comunidad y que esté dispuesto a participar activamente. Esto incluye productores agroecológicos, artesanos, personas con oficios (carpintería, costura, reparaciones), profesionales que quieran ofrecer servicios, y personas dispuestas a aportar su trabajo y talento."
      },
      {
        "question": "¿Cómo sé si soy apto para integrarme?",
        "answer": "La métrica inicial es simple: ¿Tienes algo que aportar que la comunidad necesite? ¿Tiene la comunidad algo que tú necesites? Si ambas respuestas son positivas, eres un buen candidato. Si solo quieres recibir pero no tienes nada que aportar, el sistema no te va a funcionar. El trueque requiere que ambos lados ganen: tú aportas algo y recibes algo a cambio."
      },
      {
        "question": "¿Qué evalúa la asamblea antes de aceptar a alguien?",
        "answer": "La asamblea evalúa: 1) ¿Qué aporta esta persona a la comunidad? (productos, trabajo, talentos, servicios). 2) ¿Hay interés en la comunidad por lo que esta persona aporta? 3) ¿Hay cosas en la comunidad que esta persona pueda necesecer o recibir? 4) ¿Esta persona entiende y comparte los valores del trueque y la agroecología? 5) ¿Está dispuesta a participar activamente en asambleas y actividades?"
      },
      {
        "question": "¿Necesito tener tierra o un conuco para entrar?",
        "answer": "No necesariamente. Hay miembros que son productores con tierra, pero también hay artesanos, panaderos, herbolarios, personas que ofrecen servicios, y personas que aportan su trabajo en los conucos de otros. Lo importante no es qué tienes, sino qué puedes aportar con lo que tienes."
      },
      {
        "question": "¿Puedo entrar si solo quiero consumir productos sanos?",
        "answer": "Si solo quieres consumir, puedes venir a la feria como visitante y comprar en moneda local. Para ser miembro del trueque interno, necesitas aportar algo. No puedes solo recibir. Si quieres ser miembro pero no tienes productos, puedes aportar trabajo: ayudar en la organización, en los conucos, en la logística, dar talleres, etc."
      },
      {
        "question": "¿Cuánto tiempo toma el proceso de admisión?",
        "answer": "Depende de cada comunidad. Generalmente: llenas la solicitud, la asamblea la revisa en su próxima reunión, te invitan a una entrevista o visita, y luego votan. Puede tomar de unas semanas a un mes. Mientras esperas, puedes participar en las ferias como visitante y conocer a los miembros."
      },
      {
        "question": "¿Qué compromisos asumo al ser miembro?",
        "answer": "Al ser miembro te comprometes a: 1) Aportar algo a la comunidad de forma regular. 2) Mantener tu saldo TQ cercano a cero. 3) Participar en las asambleas (presenciales o digitales). 4) Respetar los valores de agroecología, trueque y cuidado de la tierra. 5) Ser honesto en tus intercambios. 6) No acumular saldo negativo sin plan para recuperarlo."
      },
      {
        "question": "¿Puedo entrar siendo parte de otra comunidad o red?",
        "answer": "Sí, siempre y cuando no haya conflicto de intereses. Muchos miembros participan en varias redes. La idea es sumar, no excluir. Si ya eres parte de otra comunidad de trueque, nos encantará conocer tu experiencia y aprender de ella."
      }
    ]
  },
  {
    "type": "faq",
    "title": "Sobre la Organización y las Asambleas",
    "items": [
      {
        "question": "¿Cómo se organiza la feria más allá del día de mercado?",
        "answer": "La feria tiene una vida organizativa continua: celebramos Asambleas Generales cada 3 meses para la toma de decisiones colectivas, estructuramos comisiones temáticas periódicas (logística, comunicación, bioinsumos, cultura), realizamos talleres formativos presenciales y organizamos cayapas y visitas a los conucos."
      },
      {
        "question": "¿Qué es una asamblea y por qué es importante?",
        "answer": "La asamblea es el espacio donde todos los miembros toman decisiones juntos. No hay un jefe ni un dueño: las decisiones se toman colectivamente, por consenso o por votación. La asamblea decide quién entra, quién sale, cómo se reparten los recursos, qué reglas se cambian, y cómo se resuelven los conflictos. Si no participas en la asamblea, no tienes voz en las decisiones que afectan a la comunidad."
      },
      {
        "question": "¿Tengo que asistir a todas las asambleas?",
        "answer": "Se espera que los miembros participen en las asambleas, pero entendemos que a veces no es posible asistir físicamente. Por eso existe la asamblea digital: puedes participar y votar desde tu teléfono o computadora. Lo importante es que tu voz se escuche, aunque no puedas estar presente."
      },
      {
        "question": "¿Cómo se toman las decisiones en la asamblea?",
        "answer": "Por defecto, las decisiones se toman por consenso: se busca que todos estén de acuerdo. Si no hay consenso, se vota. El umbral de aprobación por defecto es del 100%, lo que significa que una decisión se aprueba solo si nadie se opone. Esto asegura que las decisiones sean verdaderamente colectivas y que nadie quede marginado."
      },
      {
        "question": "¿Qué pasa si no estoy de acuerdo con una decisión?",
        "answer": "Puedes expresar tu desacuerdo en la asamblea. Tu voz cuenta. Si una decisión se aprueba y tú no estás de acuerdo, puedes proponer revisarla en la próxima asamblea. La comunidad escucha a sus miembros. Si un miembro sistemáticamente no está de acuerdo con nada, puede ser que esta comunidad no sea el lugar adecuado para esa persona."
      },
      {
        "question": "¿Quién puede proponer cambios?",
        "answer": "Cualquier miembro puede proponer cambios: nuevos productos, nuevas reglas, nuevos miembros, nuevas actividades. La propuesta se presenta en la asamblea y se discute colectivamente. No hay jerarquías: la palabra de un miembro nuevo vale igual que la de un miembro antiguo."
      },
      {
        "question": "¿Qué son las comisiones?",
        "answer": "Las comisiones son grupos de miembros que se encargan de áreas específicas: logística, comunicación, bioinsumos, cultura, educación, etc. Cada comisión tiene cierta autonomía para tomar decisiones dentro de su área, pero siempre rinde cuentas a la asamblea general. Cualquier miembro puede unirse a una comisión."
      },
      {
        "question": "¿Qué es una cayapa?",
        "answer": "Una cayapa es un trabajo colectivo donde varios miembros se juntan para ayudar a uno de ellos con una tarea grande: preparar un terreno, construir una casa, cosechar, etc. Es una forma de mutualidad: hoy te ayudamos tú, mañana ayudamos a otro. Las cayapas son el corazón del trueque de trabajo."
      }
    ]
  },
  {
    "type": "faq",
    "title": "Sobre la Federación y Otras Comunidades",
    "items": [
      {
        "question": "¿Qué significa que esta comunidad sea parte de una federación?",
        "answer": "Significa que nuestra comunidad no está sola. Somos parte de una red de comunidades que comparten los mismos principios de trueque, agroecología y gobernanza asamblearia. Cada comunidad es autónoma y toma sus propias decisiones internas, pero todas usamos el mismo sistema de trueque, la misma moneda TQ, y los mismos protocolos de comunicación. Esto nos permite comerciar entre comunidades cuando es beneficioso para todos."
      },
      {
        "question": "¿Puedo usar mi saldo TQ en otra comunidad federada?",
        "answer": "Sí, gracias a la piscina global multilateral real. Anteriormente, el sistema solo verificaba límites bilaterales entre pares de nodos, lo que limitaba el intercambio. Ahora existe una piscina global compartida: el saldo que ganas en el nodo B es gastable en el nodo C. Si vas a otra comunidad federada, puedes usar tu tarjeta NFC o tu cuenta para intercambiar. La federación no crea dinero nuevo, solo amplía el espectro de lo que puedes recibir mediante la piscina global multilateral."
      },
      {
        "question": "¿Qué pasa mientras hay pocas comunidades federadas?",
        "answer": "Al principio, con pocas comunidades, el espectro de lo que puedes aportar y recibir es más limitado. Por eso es crucial que cada comunidad que se federé garantice que sus miembros tienen algo real que aportar. A medida que más comunidades se federen, el espectro se amplía: más productos, más servicios, más lugares donde aportar trabajo, más cosas que recibir. La federación se hace más sólida cuantas más comunidades participen."
      },
      {
        "question": "¿Mi comunidad tiene que usar el mismo software?",
        "answer": "Sí, todas las comunidades federadas usan el mismo software base, porque es la única forma de garantizar que los intercambios funcionen correctamente entre comunidades. Pero cada comunidad puede personalizar los colores, textos, idioma, y reglas internas de su plataforma. La base técnica es compartida, pero la identidad de cada comunidad es propia."
      },
      {
        "question": "¿Una comunidad nueva puede crear su propio software?",
        "answer": "El software es de código abierto, lo que significa que cualquiera puede verlo, modificarlo y adaptarlo. Pero para federarse, tiene que usar el mismo protocolo de comunicación. Si alguien quiere desarrollar una versión distinta del software, puede hacerlo, siempre y cuando sea 100% compatible con el protocolo federado. La idea es que todas las comunidades puedan comunicarse e intercambiar sin problemas."
      },
      {
        "question": "¿Quién gobierna la federación?",
        "answer": "La federación se gobierna por votación de todos los nodos federados. Cada comunidad (nodo) tiene un voto. Las decisiones que afectan a toda la federación (como la canasta básica TQ, el límite de crédito global, o la expulsión de un nodo problemático) se toman colectivamente. Ninguna comunidad puede imponer reglas sobre las demás."
      }
    ]
  },
  {
    "type": "faq",
    "title": "Sobre las Piscinas de la Federación (Global vs. Bilateral)",
    "items": [
      {
        "question": "¿Qué es la piscina global multilateral real?",
        "answer": "Es una piscina de saldo compartida por todos los nodos federados. El saldo que ganas intercambiando con el nodo B es gastable con el nodo C. Por ejemplo: si un productor del nodo B vende productos a un usuario del nodo A, el saldo positivo que genera el productor del nodo B puede usarse para comprar productos del nodo C. Esto permite un trueque multilateral real entre todas las comunidades federadas, no solo de par en par."
      },
      {
        "question": "¿Qué son las piscinas bilaterales?",
        "answer": "Cada par de nodos mantiene un saldo bilateral independiente que refleja el intercambio directo entre esos dos nodos. El saldo bilateral con el nodo B es separado del saldo bilateral con el nodo C. Estas piscinas bilaterales coexisten con la piscina global y permiten llevar un registro detallado del intercambio entre cada par de comunidades."
      },
      {
        "question": "¿Antes no existía ya una piscina global?",
        "answer": "No. Anteriormente, el sistema solo verificaba límites bilaterales entre pares de nodos. Es decir, solo se podía intercambiar con un nodo si el saldo bilateral con ese nodo específico estaba dentro del límite. No existía una piscina global real que permitiera gastar en el nodo C el saldo ganado en el nodo B. Ahora la piscina global multilateral real hace posible el trueque multilateral completo entre todos los nodos federados."
      },
      {
        "question": "¿Cómo se relacionan la piscina global y las bilaterales?",
        "answer": "Son independientes. La piscina global permite el multilateralismo: lo que ganas en un nodo lo puedes gastar en cualquier otro. Las piscinas bilaterales llevan el registro del intercambio directo entre cada par de nodos. Ambas coexisten: la piscina global amplía las posibilidades de intercambio, mientras que las bilaterales mantienen la trazabilidad entre pares específicos."
      }
    ]
  },
  {
    "type": "faq",
    "title": "Sobre los Niveles de Nodo Federado",
    "items": [
      {
        "question": "¿Cuáles son los niveles de nodo federado?",
        "answer": "Existen tres niveles: Nivel 1 (Nodo Nuevo) con un límite de 1.000 TQ, sin derecho a voto y sin capacidad de patrocinar nuevos nodos. Nivel 2 (Nodo Aceptado) con un límite de 5.000 TQ, derecho a voto en la federación y capacidad de patrocinar nuevos nodos. Nivel 3 (Nodo Pleno) con un límite de 20.000 TQ, derecho a voto y capacidad de patrocinio, con acceso completo a la piscina global multilateral."
      },
      {
        "question": "¿Cómo se promueve un nodo de Nivel 1 a Nivel 2?",
        "answer": "La promoción a Nivel 2 (Nodo Aceptado) requiere una votación de toda la federación. El nodo debe haber permanecido un mínimo de 90 días como Nodo Nuevo antes de poder ser propuesto para promoción. La votación la realizan todos los nodos que ya tienen derecho a voto (Nivel 2 y Nivel 3). Si la federación aprueba la promoción, el nodo pasa a tener límite de 5.000 TQ, derecho a voto y capacidad de patrocinar."
      },
      {
        "question": "¿Cómo se promueve un nodo de Nivel 2 a Nivel 3?",
        "answer": "La promoción a Nivel 3 (Nodo Pleno) es automática. Se alcanza cuando el nodo cumple los requisitos de reciprocidad y el límite promedio de la federación. No requiere votación: el sistema detecta que el nodo ha mantenido relaciones de intercambio recíprocas con otros nodos y que su actividad justifica un límite mayor de 20.000 TQ."
      },
      {
        "question": "¿Por qué los nodos nuevos no tienen derecho a voto?",
        "answer": "Porque la confianza se construye con el tiempo. Un nodo nuevo (Nivel 1) aún no ha demostrado su compromiso con la federación ni ha establecido relaciones de reciprocidad con los demás nodos. Sin derecho a voto, el nodo puede participar en los intercambios pero no influye en las decisiones colectivas hasta que la federación lo apruebe como Nodo Aceptado (Nivel 2) tras un mínimo de 90 días."
      }
    ]
  },
  {
    "type": "faq",
    "title": "Sobre el Sistema de Padrino (Patrocinador)",
    "items": [
      {
        "question": "¿Qué es el sistema de padrino?",
        "answer": "Cuando un nodo de Nivel 2 (Aceptado) o Nivel 3 (Pleno) patrocina a un nodo nuevo que ingresa a la federación, se convierte en su \"padrino\". El padrino asume responsabilidad solidaria sobre el nodo patrocinado: si el nodo nuevo incumple (default), la deuda se transfiere al padrino. A cambio, el nodo nuevo obtiene acceso a la federación con el respaldo de un nodo establecido."
      },
      {
        "question": "¿Quién puede ser padrino de un nodo nuevo?",
        "answer": "Solo los nodos de Nivel 2 (Nodo Aceptado) o Nivel 3 (Nodo Pleno) pueden ser padrinos. Los nodos de Nivel 1 (Nodo Nuevo) no tienen capacidad de patrocinar. Esto asegura que solo los nodos que ya han demostrado compromiso y han sido aprobados por la federación puedan respaldar a nuevos nodos."
      },
      {
        "question": "¿Qué pasa con el límite del padrino al patrocinar?",
        "answer": "Al patrocinar un nodo nuevo, el límite del padrino se reduce en el monto del límite del nodo patrocinado (1.000 TQ). Por ejemplo, si un nodo de Nivel 2 tiene un límite de 5.000 TQ y patrocina un nodo nuevo, su límite efectivo pasa a 4.000 TQ. El límite se libera automáticamente cuando el nodo patrocinado alcanza el Nivel 2 (Nodo Aceptado)."
      },
      {
        "question": "¿Qué pasa si el nodo patrocinado incumple?",
        "answer": "Si el nodo patrocinado no cumple con sus compromisos (default), la deuda se transfiere al padrino. Esto significa que el padrino debe cubrir el saldo negativo del nodo patrocinado. Por eso es importante que el padrino solo patrocine nodos en los que confía y que conoce bien. El sistema de padrino fomenta relaciones de confianza real entre nodos."
      },
      {
        "question": "¿Cuándo se libera el límite retenido del padrino?",
        "answer": "El límite retenido se libera automáticamente cuando el nodo patrocinado alcanza el Nivel 2 (Nodo Aceptado). Esto significa que el nodo patrocinado ha sido aprobado por votación de toda la federación tras un mínimo de 90 días, demostrando que es confiable. Al liberarse el límite, el padrino recupera su capacidad de crédito completa y puede patrocinar a otros nodos nuevos si lo desea."
      }
    ]
  },
  {
    "type": "faq",
    "title": "Sobre la Verificación de 4 Opciones",
    "items": [
      {
        "question": "¿Qué es la verificación de 4 opciones?",
        "answer": "Es un sistema de seguridad que se utiliza tanto en el emparejamiento de terminales POS como en la incorporación de nuevos nodos a la federación. Cuando un dispositivo o nodo solicita emparejamiento, el confirmador (administrador del nodo receptor) ve 4 opciones de código en pantalla. Solo una de las 4 opciones es el código correcto. El confirmador debe seleccionar el código correcto entre las 4 opciones."
      },
      {
        "question": "¿Por qué se usan 4 opciones en lugar de ingresar el código directamente?",
        "answer": "Porque previene ataques de intermediario. Si un atacante intercepta la comunicación, no puede forzar la aprobación sin conocer visualmente cuál de las 4 opciones es la correcta. El código correcto solo lo muestra el dispositivo solicitante en su pantalla física. El confirmador debe verlo y seleccionar la opción coincidente, lo que requiere acceso visual al dispositivo."
      },
      {
        "question": "¿Qué pasa si selecciono el código equivocado?",
        "answer": "Si el confirmador selecciona el código equivocado, el emparejamiento se rechaza automáticamente. El dispositivo solicitante deberá iniciar un nuevo proceso de emparejamiento con un código nuevo. Esto es una medida de seguridad: es preferible rechazar un emparejamiento válido antes que aprobar uno fraudulento."
      }
    ]
  },
  {
    "type": "faq",
    "title": "Sobre la Integridad Distribuida",
    "items": [
      {
        "question": "¿Qué es la integridad distribuida en las transacciones federadas?",
        "answer": "Es un sistema de seguridad que protege las transacciones entre nodos federados mediante doble firma criptográfica y hashes encadenados. Cada transacción entre nodos requiere la firma de ambos (emisor y receptor), y cada transacción incluye el hash de la anterior, creando una cadena inmutable."
      },
      {
        "question": "¿Qué es la doble firma?",
        "answer": "Cada transacción entre nodos federados requiere la firma criptográfica de ambos nodos: el emisor y el receptor. Ningún nodo puede falsificar una transacción en nombre del otro. Ambas partes deben confirmar criptográficamente la transacción para que sea válida. Esto garantiza que todas las transacciones federadas son consentidas por ambos nodos."
      },
      {
        "question": "¿Qué son los hashes encadenados?",
        "answer": "Cada transacción entre nodos incluye el hash (una huella digital criptográfica) de la transacción anterior. Esto crea una cadena donde cualquier modificación de una transacción pasada invalida todas las posteriores. Permite verificar la integridad completa del historial de intercambios entre dos nodos: si alguien intenta alterar una transacción, la cadena se rompe y la alteración es detectable inmediatamente."
      }
    ]
  },
  {
    "type": "faq",
    "title": "Sobre las Tarjetas NFC y el POS",
    "items": [
      {
        "question": "¿Qué es la tarjeta NFC y cómo funciona?",
        "answer": "La tarjeta NFC es como una tarjeta de identidad del trueque. La acercas al terminal POS y este reconoce quién eres. Cada tarjeta tiene un chip que la hace única e inimitable. Con ella puedes recibir pagos por tus productos, pagar por lo que recibes, y consultar tu saldo. Es más segura que una contraseña porque usa criptografía de nivel bancario."
      },
      {
        "question": "¿Qué pasa si pierdo mi tarjeta?",
        "answer": "Avísale al administrador de la comunidad inmediatamente. El puede desactivar tu tarjeta perdida y emitirte una nueva. Nadie puede usar tu tarjeta perdida una vez que está desactivada. Tu saldo no se pierde: está asociado a tu cuenta, no a la tarjeta física."
      },
      {
        "question": "¿Necesito tener la tarjeta para participar?",
        "answer": "La tarjeta NFC es la forma más fácil y segura de participar en los intercambios. Si no tienes tarjeta, también puedes usar códigos QR desde tu teléfono. La comunidad te puede ayudar a conseguir una tarjeta si eres miembro."
      },
      {
        "question": "¿El terminal POS funciona sin internet?",
        "answer": "El terminal POS puede funcionar sin internet por un tiempo, guardando las transacciones localmente. Cuando recupera conexión, sincroniza con el servidor. Esto es útil para ferias en lugares sin buena señal. Pero es importante que sincronice pronto para evitar problemas."
      },
      {
        "question": "¿Puedo ver mi saldo desde mi teléfono?",
        "answer": "Sí, si la comunidad tiene la aplicación móvil instalada, puedes ver tu saldo, tu historial de transacciones, y participar en asambleas digitales desde tu teléfono. Pregúntale al administrador cómo acceder."
      },
      {
        "question": "¿Qué es el emparejamiento del terminal?",
        "answer": "Cuando un terminal POS nuevo llega a la comunidad, necesita ser \"emparejado\" con el servidor. El administrador genera un código de 6 dígitos que el terminal usa para registrarse. Una vez emparejado, el terminal sabe quién es y puede operar. Si el terminal se pierde o se daña, el administrador puede desactivarlo desde el panel y emparejar uno nuevo."
      }
    ]
  },
  {
    "type": "faq",
    "title": "Preguntas que Debes Hacerte Antes de Entrar",
    "items": [
      {
        "question": "¿Tengo algo que aportar?",
        "answer": "Esta es la pregunta más importante. El trueque funciona porque todos aportan y todos reciben. Si no tienes nada que aportar, el sistema no te va a funcionar. Aportar puede ser: productos de tu conuco o huerta, artesanías, alimentos procesados, servicios (reparaciones, clases, transporte), trabajo (ayuda en conucos, construcción, organización), o conocimientos (talleres, asesorías). Todo cuenta. Lo importante es que la comunidad valore lo que tú aportas."
      },
      {
        "question": "¿Hay algo en la comunidad que yo necesite o me interese?",
        "answer": "La otra cara del trueque: ¿qué tiene la comunidad que tú puedes recibir? Alimentos, trabajo, servicios, productos artesanales, conexión con personas afines, talleres, participación en eventos. Si nada de lo que la comunidad ofrece te interesa, no tiene sentido que te integres. El trueque es bidireccional: tú aportas y recibes."
      },
      {
        "question": "¿Estoy dispuesto a participar activamente?",
        "answer": "Ser miembro no es solo tener una cuenta. Es participar: asistir a asambleas, aportar de forma regular, ayudar en cayapas, respetar los valores de la comunidad. Si solo quieres tener una cuenta para recibir y nunca participar, el sistema no es para ti. La comunidad se sostiene con la participación de todos."
      },
      {
        "question": "¿Comparto los valores de la agroecología y el trueque?",
        "answer": "Nuestra comunidad se basa en el cuidado de la tierra, la agroecología, el trueque, y la mutualidad. Si no compartes estos valores, probablemente no te sentirás cómodo aquí. No es un requisito ser productor agroecológico, pero sí respetar y apoyar estos principios."
      },
      {
        "question": "¿Estoy dispuesto a que mi saldo sea cero?",
        "answer": "El objetivo del trueque no es acumular, sino equilibrar. Si tu meta es acumular mucho TQ para ser \"rico\", este sistema no es para ti. La meta es que tu saldo esté en cero: aportar lo que recibes. Si entiendes y aceptas esto, vas a disfrutar el trueque. Si no, vas a frustrarte."
      },
      {
        "question": "¿Qué hago si mis respuestas son positivas?",
        "answer": "¡Excelente! Si tienes algo que aportar, hay algo que te interesa recibir, y estás dispuesto a participar, puedes solicitar admisión. Llena la solicitud, asiste a una feria como visitante, conoce a los miembros, y presenta tu propuesta en la asamblea. Te recibiremos con los brazos abiertos."
      }
    ]
  },
  {
    "type": "faq",
    "title": "Sobre la Gobernanza del Sistema",
    "items": [
      {
        "question": "¿Cómo funciona exactamente la gobernanza que propone el software?",
        "answer": "La gobernanza se basa en una Asamblea Digital con votos formales. El software no impone una ideología única; su rol es automatizar y hacer cumplir las normas locales (la \"Ley de la Aldea\") que cada comunidad decide establecer en su propio servidor descentralizado. Cada nodo es autónomo y define sus propias reglas de convivencia."
      },
      {
        "question": "¿Cómo se toman las decisiones? ¿Por consenso, votación, delegación? ¿Qué ocurre cuando hay desacuerdos?",
        "answer": "Las decisiones se toman por votación digital donde cada miembro tiene un voto que se firma con criptografía Ed25519 (un sistema de firmas digitales que hace que cada voto sea inalterable y verificable). Cada comunidad configura sus propios porcentajes de aprobación: mayoría simple (51%) para lo cotidiano, consenso alto (90%) para decisiones críticas como admitir nuevos miembros. Para evitar la parálisis, la Asamblea delega tareas administrativas en una Junta Directiva. Si una propuesta no alcanza el porcentaje requerido, el sistema bloquea su aplicación automáticamente. Ante desacuerdos insalvables, cualquier miembro puede retirarse y unirse a otro nodo de la red."
      },
      {
        "question": "¿Qué sucede cuando alguien incumple las reglas?",
        "answer": "Las normas se registran clasificadas por severidad (leves, graves, muy graves) con sus sanciones correspondientes. Ante infracciones graves, la Asamblea General puede votar digitalmente la suspensión temporal o expulsión del miembro, requiriendo 75% de aprobación para la expulsión. El sistema garantiza que las sanciones se apliquen de forma transparente y registrada."
      },
      {
        "question": "¿Cómo evita que una persona o pequeño grupo concentre demasiado poder?",
        "answer": "Tres mecanismos lo evitan: 1) Ningún administrador puede cambiar reglas unilateralmente; todo pasa por la asamblea y queda registrado públicamente. 2) Topes de saldo simétricos: el sistema bloquea automáticamente la cuenta de quien alcanza su techo positivo (igual al límite negativo), impidiendo el acaparamiento y obligando a gastar o reinvertir en la comunidad. 3) Multi-firma: las transacciones grandes requieren la firma conjunta de múltiples signatarios autorizados, neutralizando que un solo individuo controle los activos colectivos."
      }
    ]
  },
  {
    "type": "faq",
    "title": "Sobre la Aplicación Práctica y el Estado del Proyecto",
    "items": [
      {
        "question": "Háblanos más acerca de este software... ¿Qué aplicación concreta tiene en el día a día... para que las comunidades lo quieran instalar?",
        "answer": "Funciona como un sistema operativo de soberanía económica y de convivencia. En el día a día: intercambiar productos en la feria sin dinero convencional (mediante tarjetas NFC y un punto de venta de bajo costo); organizar y recompensar el trabajo comunitario (1 TQ por hora de trabajo base, con multiplicadores según intensidad); desplegar servicios locales con un clic (Matrix para mensajería cifrada que reemplaza WhatsApp, Nextcloud para archivos, Asterisk para llamadas gratuitas); llevar la asamblea en el bolsillo (votar propuestas desde el móvil); y para comunidades religiosas, el \"Sabbath Lock\" congela automáticamente todas las transacciones durante el sábado."
      },
      {
        "question": "¿Qué problemas concretos soluciona?",
        "answer": "1) Parálisis económica por escasez de dinero o inflación: el trueque TQ permite comerciar sin capital previo, anclado a 1 kWh de energía. 2) Burnout y parasitismo: los límites simétricos de saldo obligan a la circularidad. 3) Falta de internet en zonas rurales: funciona 100% off-grid con servidor local. 4) Estancamiento del trueque tradicional: el crédito mutuo diferido permite intercambios multilaterales. 5) Filtración de datos: todo se almacena local y encriptado. 6) Aislamiento entre ecoaldeas: la federación mediante conexiones seguras (mTLS, un sistema de encriptación mutua entre servidores) permite comerciar entre comunidades distantes."
      },
      {
        "question": "¿Hay ecoaldeas que ya lo estén usando?",
        "answer": "Al 30 de agosto de 2026, ninguna ecoaldea está usando el sistema en producción. El proyecto nació hace apenas un mes desde la Feria Conuquera Agroecológica de Caracas, donde los productores tenemos parcelas aisladas y nos reunimos los primeros sábados de cada mes. El sistema está en desarrollo activo y se buscan personas que quieran sumarse a co-crear: ideas, programación, todos los aportes son válidos. El software es de código abierto y 100% adaptable a cada comunidad. Si quieres verlo en acción, podemos organizar una videollamada para mostrar el panel de administración, la app de Android y las tarjetas NFC funcionando."
      }
    ]
  }
]',
    updated_at = NOW()
WHERE slug = 'faq';

-- Si no existe la pagina FAQ, insertarla
INSERT INTO public_pages (node_domain, slug, title, subtitle, content, icon, menu_order, is_published, show_in_menu)
SELECT 'localhost', 'faq', 'Preguntas Frecuentes',
       'Dudas sobre Compras en Moneda Local, Trueque y Asambleas',
       '[
  {
    "type": "hero",
    "badge": "💡 Centro de Respuestas",
    "title": "Preguntas Frecuentes",
    "subtitle": "Información clara sobre cómo comprar, participar, truequear y sumarte a la feria.",
    "image_url": "/placeholder.svg",
    "style": "standard"
  },
  {
    "type": "faq",
    "title": "Para Visitantes y Compradores",
    "items": [
      {
        "question": "¿Necesito ser miembro de la feria para comprar productos?",
        "answer": "¡No! Nuestro evento mensual es un mercado a cielo abierto abierto a todo el público general. Cualquier persona puede venir y comprar hortalizas frescas, tubérculos, quesos, panes, botica natural y comida artesanal directamente de los productores pagando en moneda local."
      },
      {
        "question": "¿Cuándo y en qué horario se realiza el mercado mensual?",
        "answer": "Se realiza el primer sábado de cada mes en el Parque Los Caobos de Caracas (área sur, cerca del estacionamiento y la Fuente Venezuela), desde las 9:00 AM hasta la 1:00 PM aproximadamente."
      },
      {
        "question": "¿Cómo llegar en transporte público?",
        "answer": "Puedes llegar cómodamente en Metro de Caracas bajándote en la estación Bellas Artes o Colegio de Ingenieros (Línea 1). Desde ambas estaciones caminas unos 5 minutos hacia el Parque Los Caobos."
      },
      {
        "question": "¿Por qué está prohibido el uso de bolsas plásticas desechables?",
        "answer": "Porque la agroecología es un compromiso ético de cuidado hacia la Madre Tierra. El plástico contamina suelos y ríos. Te invitamos a traer bolsas reutilizables de tela, morrales, recipientes o canastas."
      },
      {
        "question": "¿Qué actividades culturales y formativas se realizan durante la feria?",
        "answer": "En cada jornada mensual se ofrecen talleres gratuitos de siembra y lombricultura, trueque libre de semillas criollas, intercambio de libros (\"Dona y adopta un libro\"), música popular en vivo y actividades lúdicas para niños y familias."
      },
      {
        "question": "¿Puedo pagar con tarjeta de débito o crédito?",
        "answer": "El comercio exterior (ventas al público general) se realiza en moneda local del país (pesos, bolívares, soles, etc.). Algunos puestos pueden aceptar transferencias o pagos digitales, pero le recomendamos traer efectivo. El trueque interno entre miembros funciona con la moneda TQ, pero eso es solo para miembros registrados."
      },
      {
        "question": "¿Puedo llevar mis propios productos para vender?",
        "answer": "Para vender necesitas ser miembro registrado. Si eres productor agroecológico, artesano o tienes un emprendimiento compatible con los valores de la feria, puedes solicitar admisión. La asamblea evaluará tu solicitud y, si eres aceptado, recibirás un puesto y acceso al sistema de trueque."
      },
      {
        "question": "¿La feria es solo para productores agroecológicos?",
        "answer": "No necesariamente. Aunque la agroecología es nuestro corazón, también hay lugar para artesanos, productores de alimentos procesados (panes, quesos, conservas), herbolaria, productos de higiene natural, y servicios comunitarios. Lo importante es que lo que ofrezcas sea coherente con los valores de cuidado de la tierra y el trueque."
      }
    ]
  },
  {
    "type": "faq",
    "title": "Sobre el Trueque y la Moneda TQ",
    "items": [
      {
        "question": "¿Qué es la moneda TQ?",
        "answer": "TQ es la unidad de medida del trueque interno entre miembros. No es dinero físico ni se puede comprar ni vender por dinero. Es una unidad contable que mide cuánto aportas y cuánto recibes dentro de la comunidad. 1 TQ equivale a 1 kWh de energía, es decir, a una hora de trabajo humano. No tiene inflación porque no está atada al dólar ni al oro, sino a las leyes de la física."
      },
      {
        "question": "¿Por qué el saldo perfecto es cero?",
        "answer": "El objetivo de todo miembro es que su saldo sea cero. Si tu saldo está en cero, significa que has aportado a la comunidad exactamente lo mismo que has recibido de ella. Eso es equilibrio. Si tu saldo está muy negativo, significa que estás recibiendo mucho pero aportando poco: tienes que aportar más para llegar a cero. Si tu saldo está muy positivo, significa que estás aportando mucho pero no aprovechando lo que la comunidad ofrece: tienes que recibir más para llegar a cero. El saldo cero es la meta de todos."
      },
      {
        "question": "¿Es preferible tener saldo positivo o negativo?",
        "answer": "Técnicamente, si tu saldo está en positivo es porque alguien más está en negativo. Lo ideal es que todos tiendan a cero. Pero si vas a estar en un lado, es preferible estar ligeramente en positivo (aportando un poco más de lo que recibes) que en negativo (recibiendo más de lo que aportas). Un saldo muy negativo sostenido significa que la comunidad te está sosteniendo, y eso no es sostenible a largo plazo."
      },
      {
        "question": "¿Qué pasa si mi saldo se va muy negativo?",
        "answer": "Si tu saldo baja demasiado, el sistema te avisa. Tienes que aportar más (vender productos, ofrecer trabajo, dar talleres) para subir tu saldo. Si no logras subirlo, la asamblea puede revisar tu caso. La idea no es castigar, sino ayudarte a encontrar equilibrio. Pero si una persona solo recibe y nunca aporta, la asamblea puede decidir que ya no puede seguir en el sistema."
      },
      {
        "question": "¿Por qué para entrar a la comunidad tengo que tener algo que aportar?",
        "answer": "Porque el trueque funciona así: tú aportas algo que la comunidad necesita, y la comunidad te aporta algo que tú necesitas. Si entras sin nada que aportar, solo estarías recibiendo de los demás sin devolver nada. Eso desequilibra el sistema y no es justo para los demás miembros. Muchas monedas comunitarias fracasan precisamente porque entra mucha gente que solo quiere recibir y poca gente que aporta. Por eso, antes de entrar, tienes que preguntarte: ¿Qué tengo yo que la comunidad pueda necesitar? ¿Qué tiene la comunidad que yo pueda necesecer? Si ambas respuestas son positivas, vale la pena que te integres."
      },
      {
        "question": "¿Qué cosas puedo aportar?",
        "answer": "Puedes aportar productos (frutas, verduras, huevos, panes, artesanías, conservas, medicina natural), servicios (reparaciones, transporte, clases, cuidado de niños, peluquería), trabajo (ayuda en conucos, construcción, limpieza, organización de eventos), o conocimientos (talleres, asesorías, mentorías). Todo lo que la comunidad valore puede ser un aporte. No tiene que ser solo cosas materiales: el tiempo y el talento también cuentan."
      },
      {
        "question": "¿Cómo sé si vale la pena integrarme a la comunidad?",
        "answer": "Hazte estas preguntas antes de solicitar admisión: 1) ¿Tengo algo que aportar que la comunidad pueda necesitar? (productos, trabajo, talentos, servicios). 2) ¿Tiene la comunidad algo que yo necesite o me interese? (alimentos, trabajo, servicios, conexión con otras personas). 3) ¿Estoy dispuesto a participar activamente, no solo a recibir? Si las tres respuestas son sí, entonces vale la pena que te integres. Si solo quieres recibir pero no tienes nada que aportar, el trueque no te va a funcionar."
      },
      {
        "question": "¿La moneda TQ tiene inflación?",
        "answer": "No. La moneda TQ no tiene inflación porque no está atada al dinero de ningún país ni al oro. Está atada a la energía: 1 TQ = 1 kWh. La energía no se devalúa. Una hora de trabajo hoy vale lo mismo que una hora de trabajo dentro de 10 años. Esto significa que lo que ahorras en TQ mantiene su valor real con el tiempo, a diferencia del dinero en el banco que pierde valor cada mes por la inflación."
      },
      {
        "question": "¿Puedo acumular TQ para hacerme \"rico\"?",
        "answer": "El sistema no está diseñado para que nadie se haga rico acumulando números. El objetivo es el equilibrio: aportar y recibir en proporción similar. Acumular mucho TQ significa que estás aportando mucho pero no aprovechando lo que la comunidad ofrece. En lugar de acumular TQ, te invitamos a acumular riqueza real y tangible: tu vivienda, tu conuco, tus herramientas, tus semillas, tus relaciones comunitarias. Eso sí es riqueza de verdad."
      },
      {
        "question": "¿Qué son los límites de crédito?",
        "answer": "Los límites de crédito son como escalones de confianza. Un miembro nuevo inicia con un límite bajo, equivalente a su canasta básica familiar, para proteger a la comunidad. A medida que participas, aportas y demuestras compromiso, la asamblea puede subir tu límite. No es un castigo ni una restricción: es una medida de protección para que nadie entre, reciba mucho y se vaya sin aportar."
      },
      {
        "question": "¿Las ventas al público se mezclan con el trueque?",
        "answer": "¡No! Las ventas al público general son externas y se pagan en moneda local del país (pesos, bolívares, etc.). El trueque TQ es solo entre miembros registrados. Los compradores externos no tienen cuentas TQ ni participan del trueque. Esto es muy importante: no podemos mezclar las ventas al público con el trueque, porque son cosas distintas con reglas distintas."
      },
      {
        "question": "¿Qué pasa si quiero salir de la comunidad?",
        "answer": "Puedes salir cuando quieras. Lo ideal es que antes de salir, tu saldo esté en cero o cercano a cero. Si tu saldo está muy negativo (recibiste más de lo que aportaste), la asamblea puede pedirte que aportes algo antes de irte para equilibrar tu cuenta. Si tu saldo está positivo, simplemente pierdes ese saldo al salir, ya que el TQ no tiene valor fuera de la comunidad."
      }
    ]
  },
  {
    "type": "faq",
    "title": "Para Quienes Quieren Unirse",
    "items": [
      {
        "question": "¿Quiénes pueden solicitar admisión?",
        "answer": "Cualquier persona, familia, cooperativa o colectivo que tenga algo que aportar a la comunidad y que esté dispuesto a participar activamente. Esto incluye productores agroecológicos, artesanos, personas con oficios (carpintería, costura, reparaciones), profesionales que quieran ofrecer servicios, y personas dispuestas a aportar su trabajo y talento."
      },
      {
        "question": "¿Cómo sé si soy apto para integrarme?",
        "answer": "La métrica inicial es simple: ¿Tienes algo que aportar que la comunidad necesite? ¿Tiene la comunidad algo que tú necesites? Si ambas respuestas son positivas, eres un buen candidato. Si solo quieres recibir pero no tienes nada que aportar, el sistema no te va a funcionar. El trueque requiere que ambos lados ganen: tú aportas algo y recibes algo a cambio."
      },
      {
        "question": "¿Qué evalúa la asamblea antes de aceptar a alguien?",
        "answer": "La asamblea evalúa: 1) ¿Qué aporta esta persona a la comunidad? (productos, trabajo, talentos, servicios). 2) ¿Hay interés en la comunidad por lo que esta persona aporta? 3) ¿Hay cosas en la comunidad que esta persona pueda necesecer o recibir? 4) ¿Esta persona entiende y comparte los valores del trueque y la agroecología? 5) ¿Está dispuesta a participar activamente en asambleas y actividades?"
      },
      {
        "question": "¿Necesito tener tierra o un conuco para entrar?",
        "answer": "No necesariamente. Hay miembros que son productores con tierra, pero también hay artesanos, panaderos, herbolarios, personas que ofrecen servicios, y personas que aportan su trabajo en los conucos de otros. Lo importante no es qué tienes, sino qué puedes aportar con lo que tienes."
      },
      {
        "question": "¿Puedo entrar si solo quiero consumir productos sanos?",
        "answer": "Si solo quieres consumir, puedes venir a la feria como visitante y comprar en moneda local. Para ser miembro del trueque interno, necesitas aportar algo. No puedes solo recibir. Si quieres ser miembro pero no tienes productos, puedes aportar trabajo: ayudar en la organización, en los conucos, en la logística, dar talleres, etc."
      },
      {
        "question": "¿Cuánto tiempo toma el proceso de admisión?",
        "answer": "Depende de cada comunidad. Generalmente: llenas la solicitud, la asamblea la revisa en su próxima reunión, te invitan a una entrevista o visita, y luego votan. Puede tomar de unas semanas a un mes. Mientras esperas, puedes participar en las ferias como visitante y conocer a los miembros."
      },
      {
        "question": "¿Qué compromisos asumo al ser miembro?",
        "answer": "Al ser miembro te comprometes a: 1) Aportar algo a la comunidad de forma regular. 2) Mantener tu saldo TQ cercano a cero. 3) Participar en las asambleas (presenciales o digitales). 4) Respetar los valores de agroecología, trueque y cuidado de la tierra. 5) Ser honesto en tus intercambios. 6) No acumular saldo negativo sin plan para recuperarlo."
      },
      {
        "question": "¿Puedo entrar siendo parte de otra comunidad o red?",
        "answer": "Sí, siempre y cuando no haya conflicto de intereses. Muchos miembros participan en varias redes. La idea es sumar, no excluir. Si ya eres parte de otra comunidad de trueque, nos encantará conocer tu experiencia y aprender de ella."
      }
    ]
  },
  {
    "type": "faq",
    "title": "Sobre la Organización y las Asambleas",
    "items": [
      {
        "question": "¿Cómo se organiza la feria más allá del día de mercado?",
        "answer": "La feria tiene una vida organizativa continua: celebramos Asambleas Generales cada 3 meses para la toma de decisiones colectivas, estructuramos comisiones temáticas periódicas (logística, comunicación, bioinsumos, cultura), realizamos talleres formativos presenciales y organizamos cayapas y visitas a los conucos."
      },
      {
        "question": "¿Qué es una asamblea y por qué es importante?",
        "answer": "La asamblea es el espacio donde todos los miembros toman decisiones juntos. No hay un jefe ni un dueño: las decisiones se toman colectivamente, por consenso o por votación. La asamblea decide quién entra, quién sale, cómo se reparten los recursos, qué reglas se cambian, y cómo se resuelven los conflictos. Si no participas en la asamblea, no tienes voz en las decisiones que afectan a la comunidad."
      },
      {
        "question": "¿Tengo que asistir a todas las asambleas?",
        "answer": "Se espera que los miembros participen en las asambleas, pero entendemos que a veces no es posible asistir físicamente. Por eso existe la asamblea digital: puedes participar y votar desde tu teléfono o computadora. Lo importante es que tu voz se escuche, aunque no puedas estar presente."
      },
      {
        "question": "¿Cómo se toman las decisiones en la asamblea?",
        "answer": "Por defecto, las decisiones se toman por consenso: se busca que todos estén de acuerdo. Si no hay consenso, se vota. El umbral de aprobación por defecto es del 100%, lo que significa que una decisión se aprueba solo si nadie se opone. Esto asegura que las decisiones sean verdaderamente colectivas y que nadie quede marginado."
      },
      {
        "question": "¿Qué pasa si no estoy de acuerdo con una decisión?",
        "answer": "Puedes expresar tu desacuerdo en la asamblea. Tu voz cuenta. Si una decisión se aprueba y tú no estás de acuerdo, puedes proponer revisarla en la próxima asamblea. La comunidad escucha a sus miembros. Si un miembro sistemáticamente no está de acuerdo con nada, puede ser que esta comunidad no sea el lugar adecuado para esa persona."
      },
      {
        "question": "¿Quién puede proponer cambios?",
        "answer": "Cualquier miembro puede proponer cambios: nuevos productos, nuevas reglas, nuevos miembros, nuevas actividades. La propuesta se presenta en la asamblea y se discute colectivamente. No hay jerarquías: la palabra de un miembro nuevo vale igual que la de un miembro antiguo."
      },
      {
        "question": "¿Qué son las comisiones?",
        "answer": "Las comisiones son grupos de miembros que se encargan de áreas específicas: logística, comunicación, bioinsumos, cultura, educación, etc. Cada comisión tiene cierta autonomía para tomar decisiones dentro de su área, pero siempre rinde cuentas a la asamblea general. Cualquier miembro puede unirse a una comisión."
      },
      {
        "question": "¿Qué es una cayapa?",
        "answer": "Una cayapa es un trabajo colectivo donde varios miembros se juntan para ayudar a uno de ellos con una tarea grande: preparar un terreno, construir una casa, cosechar, etc. Es una forma de mutualidad: hoy te ayudamos tú, mañana ayudamos a otro. Las cayapas son el corazón del trueque de trabajo."
      }
    ]
  },
  {
    "type": "faq",
    "title": "Sobre la Federación y Otras Comunidades",
    "items": [
      {
        "question": "¿Qué significa que esta comunidad sea parte de una federación?",
        "answer": "Significa que nuestra comunidad no está sola. Somos parte de una red de comunidades que comparten los mismos principios de trueque, agroecología y gobernanza asamblearia. Cada comunidad es autónoma y toma sus propias decisiones internas, pero todas usamos el mismo sistema de trueque, la misma moneda TQ, y los mismos protocolos de comunicación. Esto nos permite comerciar entre comunidades cuando es beneficioso para todos."
      },
      {
        "question": "¿Puedo usar mi saldo TQ en otra comunidad federada?",
        "answer": "Sí, gracias a la piscina global multilateral real. Anteriormente, el sistema solo verificaba límites bilaterales entre pares de nodos, lo que limitaba el intercambio. Ahora existe una piscina global compartida: el saldo que ganas en el nodo B es gastable en el nodo C. Si vas a otra comunidad federada, puedes usar tu tarjeta NFC o tu cuenta para intercambiar. La federación no crea dinero nuevo, solo amplía el espectro de lo que puedes recibir mediante la piscina global multilateral."
      },
      {
        "question": "¿Qué pasa mientras hay pocas comunidades federadas?",
        "answer": "Al principio, con pocas comunidades, el espectro de lo que puedes aportar y recibir es más limitado. Por eso es crucial que cada comunidad que se federé garantice que sus miembros tienen algo real que aportar. A medida que más comunidades se federen, el espectro se amplía: más productos, más servicios, más lugares donde aportar trabajo, más cosas que recibir. La federación se hace más sólida cuantas más comunidades participen."
      },
      {
        "question": "¿Mi comunidad tiene que usar el mismo software?",
        "answer": "Sí, todas las comunidades federadas usan el mismo software base, porque es la única forma de garantizar que los intercambios funcionen correctamente entre comunidades. Pero cada comunidad puede personalizar los colores, textos, idioma, y reglas internas de su plataforma. La base técnica es compartida, pero la identidad de cada comunidad es propia."
      },
      {
        "question": "¿Una comunidad nueva puede crear su propio software?",
        "answer": "El software es de código abierto, lo que significa que cualquiera puede verlo, modificarlo y adaptarlo. Pero para federarse, tiene que usar el mismo protocolo de comunicación. Si alguien quiere desarrollar una versión distinta del software, puede hacerlo, siempre y cuando sea 100% compatible con el protocolo federado. La idea es que todas las comunidades puedan comunicarse e intercambiar sin problemas."
      },
      {
        "question": "¿Quién gobierna la federación?",
        "answer": "La federación se gobierna por votación de todos los nodos federados. Cada comunidad (nodo) tiene un voto. Las decisiones que afectan a toda la federación (como la canasta básica TQ, el límite de crédito global, o la expulsión de un nodo problemático) se toman colectivamente. Ninguna comunidad puede imponer reglas sobre las demás."
      }
    ]
  },
  {
    "type": "faq",
    "title": "Sobre las Piscinas de la Federación (Global vs. Bilateral)",
    "items": [
      {
        "question": "¿Qué es la piscina global multilateral real?",
        "answer": "Es una piscina de saldo compartida por todos los nodos federados. El saldo que ganas intercambiando con el nodo B es gastable con el nodo C. Por ejemplo: si un productor del nodo B vende productos a un usuario del nodo A, el saldo positivo que genera el productor del nodo B puede usarse para comprar productos del nodo C. Esto permite un trueque multilateral real entre todas las comunidades federadas, no solo de par en par."
      },
      {
        "question": "¿Qué son las piscinas bilaterales?",
        "answer": "Cada par de nodos mantiene un saldo bilateral independiente que refleja el intercambio directo entre esos dos nodos. El saldo bilateral con el nodo B es separado del saldo bilateral con el nodo C. Estas piscinas bilaterales coexisten con la piscina global y permiten llevar un registro detallado del intercambio entre cada par de comunidades."
      },
      {
        "question": "¿Antes no existía ya una piscina global?",
        "answer": "No. Anteriormente, el sistema solo verificaba límites bilaterales entre pares de nodos. Es decir, solo se podía intercambiar con un nodo si el saldo bilateral con ese nodo específico estaba dentro del límite. No existía una piscina global real que permitiera gastar en el nodo C el saldo ganado en el nodo B. Ahora la piscina global multilateral real hace posible el trueque multilateral completo entre todos los nodos federados."
      },
      {
        "question": "¿Cómo se relacionan la piscina global y las bilaterales?",
        "answer": "Son independientes. La piscina global permite el multilateralismo: lo que ganas en un nodo lo puedes gastar en cualquier otro. Las piscinas bilaterales llevan el registro del intercambio directo entre cada par de nodos. Ambas coexisten: la piscina global amplía las posibilidades de intercambio, mientras que las bilaterales mantienen la trazabilidad entre pares específicos."
      }
    ]
  },
  {
    "type": "faq",
    "title": "Sobre los Niveles de Nodo Federado",
    "items": [
      {
        "question": "¿Cuáles son los niveles de nodo federado?",
        "answer": "Existen tres niveles: Nivel 1 (Nodo Nuevo) con un límite de 1.000 TQ, sin derecho a voto y sin capacidad de patrocinar nuevos nodos. Nivel 2 (Nodo Aceptado) con un límite de 5.000 TQ, derecho a voto en la federación y capacidad de patrocinar nuevos nodos. Nivel 3 (Nodo Pleno) con un límite de 20.000 TQ, derecho a voto y capacidad de patrocinio, con acceso completo a la piscina global multilateral."
      },
      {
        "question": "¿Cómo se promueve un nodo de Nivel 1 a Nivel 2?",
        "answer": "La promoción a Nivel 2 (Nodo Aceptado) requiere una votación de toda la federación. El nodo debe haber permanecido un mínimo de 90 días como Nodo Nuevo antes de poder ser propuesto para promoción. La votación la realizan todos los nodos que ya tienen derecho a voto (Nivel 2 y Nivel 3). Si la federación aprueba la promoción, el nodo pasa a tener límite de 5.000 TQ, derecho a voto y capacidad de patrocinar."
      },
      {
        "question": "¿Cómo se promueve un nodo de Nivel 2 a Nivel 3?",
        "answer": "La promoción a Nivel 3 (Nodo Pleno) es automática. Se alcanza cuando el nodo cumple los requisitos de reciprocidad y el límite promedio de la federación. No requiere votación: el sistema detecta que el nodo ha mantenido relaciones de intercambio recíprocas con otros nodos y que su actividad justifica un límite mayor de 20.000 TQ."
      },
      {
        "question": "¿Por qué los nodos nuevos no tienen derecho a voto?",
        "answer": "Porque la confianza se construye con el tiempo. Un nodo nuevo (Nivel 1) aún no ha demostrado su compromiso con la federación ni ha establecido relaciones de reciprocidad con los demás nodos. Sin derecho a voto, el nodo puede participar en los intercambios pero no influye en las decisiones colectivas hasta que la federación lo apruebe como Nodo Aceptado (Nivel 2) tras un mínimo de 90 días."
      }
    ]
  },
  {
    "type": "faq",
    "title": "Sobre el Sistema de Padrino (Patrocinador)",
    "items": [
      {
        "question": "¿Qué es el sistema de padrino?",
        "answer": "Cuando un nodo de Nivel 2 (Aceptado) o Nivel 3 (Pleno) patrocina a un nodo nuevo que ingresa a la federación, se convierte en su \"padrino\". El padrino asume responsabilidad solidaria sobre el nodo patrocinado: si el nodo nuevo incumple (default), la deuda se transfiere al padrino. A cambio, el nodo nuevo obtiene acceso a la federación con el respaldo de un nodo establecido."
      },
      {
        "question": "¿Quién puede ser padrino de un nodo nuevo?",
        "answer": "Solo los nodos de Nivel 2 (Nodo Aceptado) o Nivel 3 (Nodo Pleno) pueden ser padrinos. Los nodos de Nivel 1 (Nodo Nuevo) no tienen capacidad de patrocinar. Esto asegura que solo los nodos que ya han demostrado compromiso y han sido aprobados por la federación puedan respaldar a nuevos nodos."
      },
      {
        "question": "¿Qué pasa con el límite del padrino al patrocinar?",
        "answer": "Al patrocinar un nodo nuevo, el límite del padrino se reduce en el monto del límite del nodo patrocinado (1.000 TQ). Por ejemplo, si un nodo de Nivel 2 tiene un límite de 5.000 TQ y patrocina un nodo nuevo, su límite efectivo pasa a 4.000 TQ. El límite se libera automáticamente cuando el nodo patrocinado alcanza el Nivel 2 (Nodo Aceptado)."
      },
      {
        "question": "¿Qué pasa si el nodo patrocinado incumple?",
        "answer": "Si el nodo patrocinado no cumple con sus compromisos (default), la deuda se transfiere al padrino. Esto significa que el padrino debe cubrir el saldo negativo del nodo patrocinado. Por eso es importante que el padrino solo patrocine nodos en los que confía y que conoce bien. El sistema de padrino fomenta relaciones de confianza real entre nodos."
      },
      {
        "question": "¿Cuándo se libera el límite retenido del padrino?",
        "answer": "El límite retenido se libera automáticamente cuando el nodo patrocinado alcanza el Nivel 2 (Nodo Aceptado). Esto significa que el nodo patrocinado ha sido aprobado por votación de toda la federación tras un mínimo de 90 días, demostrando que es confiable. Al liberarse el límite, el padrino recupera su capacidad de crédito completa y puede patrocinar a otros nodos nuevos si lo desea."
      }
    ]
  },
  {
    "type": "faq",
    "title": "Sobre la Verificación de 4 Opciones",
    "items": [
      {
        "question": "¿Qué es la verificación de 4 opciones?",
        "answer": "Es un sistema de seguridad que se utiliza tanto en el emparejamiento de terminales POS como en la incorporación de nuevos nodos a la federación. Cuando un dispositivo o nodo solicita emparejamiento, el confirmador (administrador del nodo receptor) ve 4 opciones de código en pantalla. Solo una de las 4 opciones es el código correcto. El confirmador debe seleccionar el código correcto entre las 4 opciones."
      },
      {
        "question": "¿Por qué se usan 4 opciones en lugar de ingresar el código directamente?",
        "answer": "Porque previene ataques de intermediario. Si un atacante intercepta la comunicación, no puede forzar la aprobación sin conocer visualmente cuál de las 4 opciones es la correcta. El código correcto solo lo muestra el dispositivo solicitante en su pantalla física. El confirmador debe verlo y seleccionar la opción coincidente, lo que requiere acceso visual al dispositivo."
      },
      {
        "question": "¿Qué pasa si selecciono el código equivocado?",
        "answer": "Si el confirmador selecciona el código equivocado, el emparejamiento se rechaza automáticamente. El dispositivo solicitante deberá iniciar un nuevo proceso de emparejamiento con un código nuevo. Esto es una medida de seguridad: es preferible rechazar un emparejamiento válido antes que aprobar uno fraudulento."
      }
    ]
  },
  {
    "type": "faq",
    "title": "Sobre la Integridad Distribuida",
    "items": [
      {
        "question": "¿Qué es la integridad distribuida en las transacciones federadas?",
        "answer": "Es un sistema de seguridad que protege las transacciones entre nodos federados mediante doble firma criptográfica y hashes encadenados. Cada transacción entre nodos requiere la firma de ambos (emisor y receptor), y cada transacción incluye el hash de la anterior, creando una cadena inmutable."
      },
      {
        "question": "¿Qué es la doble firma?",
        "answer": "Cada transacción entre nodos federados requiere la firma criptográfica de ambos nodos: el emisor y el receptor. Ningún nodo puede falsificar una transacción en nombre del otro. Ambas partes deben confirmar criptográficamente la transacción para que sea válida. Esto garantiza que todas las transacciones federadas son consentidas por ambos nodos."
      },
      {
        "question": "¿Qué son los hashes encadenados?",
        "answer": "Cada transacción entre nodos incluye el hash (una huella digital criptográfica) de la transacción anterior. Esto crea una cadena donde cualquier modificación de una transacción pasada invalida todas las posteriores. Permite verificar la integridad completa del historial de intercambios entre dos nodos: si alguien intenta alterar una transacción, la cadena se rompe y la alteración es detectable inmediatamente."
      }
    ]
  },
  {
    "type": "faq",
    "title": "Sobre las Tarjetas NFC y el POS",
    "items": [
      {
        "question": "¿Qué es la tarjeta NFC y cómo funciona?",
        "answer": "La tarjeta NFC es como una tarjeta de identidad del trueque. La acercas al terminal POS y este reconoce quién eres. Cada tarjeta tiene un chip que la hace única e inimitable. Con ella puedes recibir pagos por tus productos, pagar por lo que recibes, y consultar tu saldo. Es más segura que una contraseña porque usa criptografía de nivel bancario."
      },
      {
        "question": "¿Qué pasa si pierdo mi tarjeta?",
        "answer": "Avísale al administrador de la comunidad inmediatamente. El puede desactivar tu tarjeta perdida y emitirte una nueva. Nadie puede usar tu tarjeta perdida una vez que está desactivada. Tu saldo no se pierde: está asociado a tu cuenta, no a la tarjeta física."
      },
      {
        "question": "¿Necesito tener la tarjeta para participar?",
        "answer": "La tarjeta NFC es la forma más fácil y segura de participar en los intercambios. Si no tienes tarjeta, también puedes usar códigos QR desde tu teléfono. La comunidad te puede ayudar a conseguir una tarjeta si eres miembro."
      },
      {
        "question": "¿El terminal POS funciona sin internet?",
        "answer": "El terminal POS puede funcionar sin internet por un tiempo, guardando las transacciones localmente. Cuando recupera conexión, sincroniza con el servidor. Esto es útil para ferias en lugares sin buena señal. Pero es importante que sincronice pronto para evitar problemas."
      },
      {
        "question": "¿Puedo ver mi saldo desde mi teléfono?",
        "answer": "Sí, si la comunidad tiene la aplicación móvil instalada, puedes ver tu saldo, tu historial de transacciones, y participar en asambleas digitales desde tu teléfono. Pregúntale al administrador cómo acceder."
      },
      {
        "question": "¿Qué es el emparejamiento del terminal?",
        "answer": "Cuando un terminal POS nuevo llega a la comunidad, necesita ser \"emparejado\" con el servidor. El administrador genera un código de 6 dígitos que el terminal usa para registrarse. Una vez emparejado, el terminal sabe quién es y puede operar. Si el terminal se pierde o se daña, el administrador puede desactivarlo desde el panel y emparejar uno nuevo."
      }
    ]
  },
  {
    "type": "faq",
    "title": "Preguntas que Debes Hacerte Antes de Entrar",
    "items": [
      {
        "question": "¿Tengo algo que aportar?",
        "answer": "Esta es la pregunta más importante. El trueque funciona porque todos aportan y todos reciben. Si no tienes nada que aportar, el sistema no te va a funcionar. Aportar puede ser: productos de tu conuco o huerta, artesanías, alimentos procesados, servicios (reparaciones, clases, transporte), trabajo (ayuda en conucos, construcción, organización), o conocimientos (talleres, asesorías). Todo cuenta. Lo importante es que la comunidad valore lo que tú aportas."
      },
      {
        "question": "¿Hay algo en la comunidad que yo necesite o me interese?",
        "answer": "La otra cara del trueque: ¿qué tiene la comunidad que tú puedes recibir? Alimentos, trabajo, servicios, productos artesanales, conexión con personas afines, talleres, participación en eventos. Si nada de lo que la comunidad ofrece te interesa, no tiene sentido que te integres. El trueque es bidireccional: tú aportas y recibes."
      },
      {
        "question": "¿Estoy dispuesto a participar activamente?",
        "answer": "Ser miembro no es solo tener una cuenta. Es participar: asistir a asambleas, aportar de forma regular, ayudar en cayapas, respetar los valores de la comunidad. Si solo quieres tener una cuenta para recibir y nunca participar, el sistema no es para ti. La comunidad se sostiene con la participación de todos."
      },
      {
        "question": "¿Comparto los valores de la agroecología y el trueque?",
        "answer": "Nuestra comunidad se basa en el cuidado de la tierra, la agroecología, el trueque, y la mutualidad. Si no compartes estos valores, probablemente no te sentirás cómodo aquí. No es un requisito ser productor agroecológico, pero sí respetar y apoyar estos principios."
      },
      {
        "question": "¿Estoy dispuesto a que mi saldo sea cero?",
        "answer": "El objetivo del trueque no es acumular, sino equilibrar. Si tu meta es acumular mucho TQ para ser \"rico\", este sistema no es para ti. La meta es que tu saldo esté en cero: aportar lo que recibes. Si entiendes y aceptas esto, vas a disfrutar el trueque. Si no, vas a frustrarte."
      },
      {
        "question": "¿Qué hago si mis respuestas son positivas?",
        "answer": "¡Excelente! Si tienes algo que aportar, hay algo que te interesa recibir, y estás dispuesto a participar, puedes solicitar admisión. Llena la solicitud, asiste a una feria como visitante, conoce a los miembros, y presenta tu propuesta en la asamblea. Te recibiremos con los brazos abiertos."
      }
    ]
  },
  {
    "type": "faq",
    "title": "Sobre la Gobernanza del Sistema",
    "items": [
      {
        "question": "¿Cómo funciona exactamente la gobernanza que propone el software?",
        "answer": "La gobernanza se basa en una Asamblea Digital con votos formales. El software no impone una ideología única; su rol es automatizar y hacer cumplir las normas locales (la \"Ley de la Aldea\") que cada comunidad decide establecer en su propio servidor descentralizado. Cada nodo es autónomo y define sus propias reglas de convivencia."
      },
      {
        "question": "¿Cómo se toman las decisiones? ¿Por consenso, votación, delegación? ¿Qué ocurre cuando hay desacuerdos?",
        "answer": "Las decisiones se toman por votación digital donde cada miembro tiene un voto que se firma con criptografía Ed25519 (un sistema de firmas digitales que hace que cada voto sea inalterable y verificable). Cada comunidad configura sus propios porcentajes de aprobación: mayoría simple (51%) para lo cotidiano, consenso alto (90%) para decisiones críticas como admitir nuevos miembros. Para evitar la parálisis, la Asamblea delega tareas administrativas en una Junta Directiva. Si una propuesta no alcanza el porcentaje requerido, el sistema bloquea su aplicación automáticamente. Ante desacuerdos insalvables, cualquier miembro puede retirarse y unirse a otro nodo de la red."
      },
      {
        "question": "¿Qué sucede cuando alguien incumple las reglas?",
        "answer": "Las normas se registran clasificadas por severidad (leves, graves, muy graves) con sus sanciones correspondientes. Ante infracciones graves, la Asamblea General puede votar digitalmente la suspensión temporal o expulsión del miembro, requiriendo 75% de aprobación para la expulsión. El sistema garantiza que las sanciones se apliquen de forma transparente y registrada."
      },
      {
        "question": "¿Cómo evita que una persona o pequeño grupo concentre demasiado poder?",
        "answer": "Tres mecanismos lo evitan: 1) Ningún administrador puede cambiar reglas unilateralmente; todo pasa por la asamblea y queda registrado públicamente. 2) Topes de saldo simétricos: el sistema bloquea automáticamente la cuenta de quien alcanza su techo positivo (igual al límite negativo), impidiendo el acaparamiento y obligando a gastar o reinvertir en la comunidad. 3) Multi-firma: las transacciones grandes requieren la firma conjunta de múltiples signatarios autorizados, neutralizando que un solo individuo controle los activos colectivos."
      }
    ]
  },
  {
    "type": "faq",
    "title": "Sobre la Aplicación Práctica y el Estado del Proyecto",
    "items": [
      {
        "question": "Háblanos más acerca de este software... ¿Qué aplicación concreta tiene en el día a día... para que las comunidades lo quieran instalar?",
        "answer": "Funciona como un sistema operativo de soberanía económica y de convivencia. En el día a día: intercambiar productos en la feria sin dinero convencional (mediante tarjetas NFC y un punto de venta de bajo costo); organizar y recompensar el trabajo comunitario (1 TQ por hora de trabajo base, con multiplicadores según intensidad); desplegar servicios locales con un clic (Matrix para mensajería cifrada que reemplaza WhatsApp, Nextcloud para archivos, Asterisk para llamadas gratuitas); llevar la asamblea en el bolsillo (votar propuestas desde el móvil); y para comunidades religiosas, el \"Sabbath Lock\" congela automáticamente todas las transacciones durante el sábado."
      },
      {
        "question": "¿Qué problemas concretos soluciona?",
        "answer": "1) Parálisis económica por escasez de dinero o inflación: el trueque TQ permite comerciar sin capital previo, anclado a 1 kWh de energía. 2) Burnout y parasitismo: los límites simétricos de saldo obligan a la circularidad. 3) Falta de internet en zonas rurales: funciona 100% off-grid con servidor local. 4) Estancamiento del trueque tradicional: el crédito mutuo diferido permite intercambios multilaterales. 5) Filtración de datos: todo se almacena local y encriptado. 6) Aislamiento entre ecoaldeas: la federación mediante conexiones seguras (mTLS, un sistema de encriptación mutua entre servidores) permite comerciar entre comunidades distantes."
      },
      {
        "question": "¿Hay ecoaldeas que ya lo estén usando?",
        "answer": "Al 30 de agosto de 2026, ninguna ecoaldea está usando el sistema en producción. El proyecto nació hace apenas un mes desde la Feria Conuquera Agroecológica de Caracas, donde los productores tenemos parcelas aisladas y nos reunimos los primeros sábados de cada mes. El sistema está en desarrollo activo y se buscan personas que quieran sumarse a co-crear: ideas, programación, todos los aportes son válidos. El software es de código abierto y 100% adaptable a cada comunidad. Si quieres verlo en acción, podemos organizar una videollamada para mostrar el panel de administración, la app de Android y las tarjetas NFC funcionando."
      }
    ]
  }
]',
       'help-circle', 7, true, true
WHERE NOT EXISTS (SELECT 1 FROM public_pages WHERE slug = 'faq');
