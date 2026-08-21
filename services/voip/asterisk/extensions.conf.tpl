; extensions.conf - Plan de marcacion de Asterisk para la aldea
; Generado por el nodo de la aplicacion
;
; Codigo de aldea: {{VILLAGE_CODE}}
; Dominio: {{NODE_DOMAIN}}
;
; Para llamar a otra aldea: marca CODIGO_ALDEA + EXTENSION
; Ejemplo: 105-2001 llama a la extension 2001 de la aldea 105

[general]
static=yes
writeprotect=yes

; === Extensiones locales ===
[local-extensions]
; Cada extension puede llamar a otra extension local
exten => _2XXX,1,Dial(PJSIP/${EXTEN},30)
exten => _2XXX,n,Voicemail(${EXTEN})
exten => _2XXX,n,Hangup()

; === Llamadas entre aldeas federadas ===
[federated-calls]
; Marcar CODIGO_ALDEA + EXTENSION (ej: 1052001)
exten => _XXX2XXX,1,NoOp(Llamada federada a aldea ${EXTEN:0:3} extension ${EXTEN:3:4})
; Buscar la ruta en la base de datos o configuracion
exten => _XXX2XXX,n,Set(REMOTE_CODE=${EXTEN:0:3})
exten => _XXX2XXX,n,Set(REMOTE_EXT=${EXTEN:3:4})
; Enrutar via SIP trunk a la aldea remota
exten => _XXX2XXX,n,Dial(PJSIP/${REMOTE_EXT}@aldea-${REMOTE_CODE})
exten => _XXX2XXX,n,Hangup()

; === Buzon de voz ===
[voicemail]
exten => *97,1,VoicemailMain(${CALLERID(num)})
exten => *97,n,Hangup()

; === Contexto por defecto ===
[from-internal]
include => local-extensions
include => federated-calls
include => voicemail
