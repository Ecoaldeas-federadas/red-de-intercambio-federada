; pjsip.conf - Configuracion SIP de Asterisk para la aldea
; Generado por el nodo de la aplicacion
;
; Codigo de aldea: {{VILLAGE_CODE}}
; Dominio: {{NODE_DOMAIN}}
; Puerto SIP: {{SIP_PORT}}

[transport-udp]
type=transport
protocol=udp
bind=0.0.0.0:{{SIP_PORT}}

[transport-tcp]
type=transport
protocol=tcp
bind=0.0.0.0:{{SIP_PORT}}

; === Extensiones locales ===
; Cada extension se configura como un endpoint PJSIP
; Reemplazar EXTENSION, DISPLAY_NAME y PASSWORD con los valores de la BD

{{#EXTENSIONS}}
[{{EXTENSION}}]
type=endpoint
context=from-internal
disallow=all
allow=ulaw,alaw,g722
auth={{EXTENSION}}-auth
aors={{EXTENSION}}
callerid={{DISPLAY_NAME}} <{{EXTENSION}}>

[{{EXTENSION}}-auth]
type=auth
auth_type=userpass
username={{EXTENSION}}
password={{PASSWORD}}

[{{EXTENSION}}]
type=aor
max_contacts=3
{{/EXTENSIONS}}

; === Trunks federados a otras aldeas ===
; Cada aldea remota se configura como un trunk SIP
; Reemplazar REMOTE_CODE, REMOTE_ENDPOINT y REMOTE_DOMAIN

{{#ROUTES}}
[aldea-{{REMOTE_CODE}}]
type=endpoint
context=from-internal
disallow=all
allow=ulaw,alaw
aors=aldea-{{REMOTE_CODE}}
callerid=Aldea {{REMOTE_CODE}} <{{REMOTE_CODE}}>

[aldea-{{REMOTE_CODE}}]
type=aor
contact=sip:{{REMOTE_ENDPOINT}}:{{SIP_PORT}}
{{/ROUTES}}
