-- /usr/share/luci/dns-api.lua - API REST para registro de subdominios
--
-- Este script se ejecuta via LuCI CGI en OpenWrt.
-- Permite que los servicios de la aldea registren sus subdominios
-- automaticamente en el DNS (dnsmasq).
--
-- Endpoints:
--   GET  /cgi-bin/luci/rpc/dns?token=XXX          -> listar subdominios
--   POST /cgi-bin/luci/rpc/dns                     -> registrar subdominio
--   DELETE /cgi-bin/luci/rpc/dns                    -> eliminar subdominio

local json = require "luci.jsonc"
local uci = require "luci.model.uci".cursor()
local io = require "io"
local os = require "os"

-- Leer configuracion
local function get_config()
    local domain = uci:get("api", "main", "domain") or "aldea.local"
    local token = uci:get("api", "main", "token") or ""
    return domain, token
end

-- Verificar token
local function check_token(provided_token)
    local _, expected_token = get_config()
    if expected_token == "" then
        return false, "API token no configurado"
    end
    if provided_token ~= expected_token then
        return false, "Token invalido"
    end
    return true
end

-- Listar todos los subdominios registrados
local function list_domains()
    local domains = {}
    uci:foreach("dns", "domain", function(s)
        table.insert(domains, {
            name = s.name or s[".name"],
            ip = s.ip,
            domain = s.domain or get_config()
        })
    end)
    return domains
end

-- Registrar un subdominio
local function register_domain(name, ipv6)
    if not name or not ipv6 then
        return false, "name e ipv6 son obligatorios"
    end

    -- Validar nombre (solo alfanumerico y guiones)
    if not name:match("^[%w%-]+$") then
        return false, "nombre invalido (solo letras, numeros y guiones)"
    end

    -- Validar IPv6 (formato basico)
    if not ipv6:match("^[%x:]+$") then
        return false, "IPv6 invalido"
    end

    -- Eliminar si ya existe
    uci:foreach("dns", "domain", function(s)
        if s.name == name then
            uci:delete("dns", s[".name"])
        end
    end)

    -- Crear nuevo registro
    local sid = uci:add("dns", "domain")
    uci:set("dns", sid, "name", name)
    uci:set("dns", sid, "ip", ipv6)
    uci:save("dns")
    uci:commit("dns")

    -- Recargar dnsmasq
    os.execute("/etc/init.d/dnsmasq restart")

    local domain = get_config()
    return true, string.format("%s.%s -> %s", name, domain, ipv6)
end

-- Eliminar un subdominio
local function delete_domain(name)
    if not name then
        return false, "name es obligatorio"
    end

    local found = false
    uci:foreach("dns", "domain", function(s)
        if s.name == name then
            uci:delete("dns", s[".name"])
            found = true
        end
    end)

    if not found then
        return false, "subdominio no encontrado"
    end

    uci:save("dns")
    uci:commit("dns")
    os.execute("/etc/init.d/dnsmasq restart")

    return true, "subdominio eliminado"
end

-- Handler principal
local function handle_request()
    local method = os.getenv("REQUEST_METHOD") or "GET"
    local query = os.getenv("QUERY_STRING") or ""

    -- Leer body para POST/DELETE
    local body = ""
    if method == "POST" or method == "DELETE" then
        body = io.read("*all") or ""
    end

    -- Parsear body JSON
    local data = {}
    if body and body ~= "" then
        data = json.parse(body) or {}
    end

    -- Parsear query string para GET
    if method == "GET" and query ~= "" then
        for k, v in query:gmatch("([^&=]+)=([^&=]+)") do
            data[k] = v
        end
    end

    -- Verificar token
    local token_ok, token_err = check_token(data.token)
    if not token_ok then
        return json.stringify({ error = token_err }), 401
    end

    -- Routing
    if method == "GET" then
        local domains = list_domains()
        return json.stringify({ domains = domains, domain = get_config() }), 200
    elseif method == "POST" then
        local ok, msg = register_domain(data.name, data.ipv6)
        if ok then
            return json.stringify({ success = true, message = msg }), 200
        else
            return json.stringify({ error = msg }), 400
        end
    elseif method == "DELETE" then
        local ok, msg = delete_domain(data.name)
        if ok then
            return json.stringify({ success = true, message = msg }), 200
        else
            return json.stringify({ error = msg }), 400
        end
    end

    return json.stringify({ error = "method not allowed" }), 405
end

-- Ejecutar
local response, status = handle_request()

-- Headers
print("Content-Type: application/json")
print("Access-Control-Allow-Origin: *")
print("Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS")
print("Access-Control-Allow-Headers: Content-Type")
print(string.format("Status: %d", status))
print("")
print(response)
