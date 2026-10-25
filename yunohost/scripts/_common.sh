#!/bin/bash

#=================================================
# COMMON VARIABLES AND CUSTOM HELPERS
#=================================================

UPSTREAM_REPO="https://github.com/discapacidad5/red-de-intercambio-federada.git"

_setup_app_sources() {
    mkdir -p "$install_dir"

    # Si se instala directamente desde el repositorio completo, usar los archivos locales
    if [ -f "$YNH_APP_BASEDIR/go.mod" ] && [ -d "$YNH_APP_BASEDIR/cmd/node" ]; then
        for item in cmd internal web firmware go.mod go.sum LICENSE config.demo.yaml config.satellite.yaml; do
            if [ -e "$YNH_APP_BASEDIR/$item" ]; then
                rm -rf "$install_dir/$item"
                cp -a "$YNH_APP_BASEDIR/$item" "$install_dir/$item"
            fi
        done
        if [ -d "$YNH_APP_BASEDIR/.git" ]; then
            git -C "$YNH_APP_BASEDIR" rev-parse --short HEAD > "$install_dir/BUILD_COMMIT" 2>/dev/null || echo "yunohost" > "$install_dir/BUILD_COMMIT"
        else
            echo "yunohost" > "$install_dir/BUILD_COMMIT"
        fi
    else
        # Si se instala desde la carpeta yunohost/ o un repositorio _ynh separado, clonar el repo principal
        local tmp_clone
        tmp_clone=$(mktemp -d)
        git clone --depth 1 "$UPSTREAM_REPO" "$tmp_clone"
        for item in cmd internal web firmware go.mod go.sum LICENSE config.demo.yaml config.satellite.yaml; do
            if [ -e "$tmp_clone/$item" ]; then
                rm -rf "$install_dir/$item"
                cp -a "$tmp_clone/$item" "$install_dir/$item"
            fi
        done
        git -C "$tmp_clone" rev-parse --short HEAD > "$install_dir/BUILD_COMMIT" 2>/dev/null || echo "yunohost" > "$install_dir/BUILD_COMMIT"
        ynh_safe_rm "$tmp_clone"
    fi

    # Enlazar directorios persistentes desde $data_dir
    mkdir -p "$data_dir/uploads" "$data_dir/backups" "$data_dir/secrets" "$data_dir/html"
    ln -sfn "$data_dir/uploads" "$install_dir/uploads"
    ln -sfn "$data_dir/backups" "$install_dir/backups"
    ln -sfn "$data_dir/secrets" "$install_dir/secrets"
    ln -sfn "$data_dir/html" "$install_dir/html"
}

_generate_ed25519_keys() {
    local key_gen_file
    key_gen_file=$(mktemp --suffix=.go)
    cat > "$key_gen_file" << 'GOEOF'
package main
import (
	"crypto/ed25519"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"fmt"
)
func main() {
	pub, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		panic(err)
	}
	fmt.Println(hex.EncodeToString(pub))
	fmt.Println(base64.StdEncoding.EncodeToString(priv))
}
GOEOF
    local tmp_cache output
    tmp_cache=$(mktemp -d)
    output=$(env HOME="$tmp_cache" GOCACHE="$tmp_cache/gocache" GOPATH="$tmp_cache/gopath" go run "$key_gen_file")
    rm -f "$key_gen_file"
    ynh_safe_rm "$tmp_cache"

    node_public_key=$(echo "$output" | head -n 1 | tr -d '\r\n')
    node_private_key=$(echo "$output" | tail -n 1 | tr -d '\r\n')

    ynh_app_setting_set --key=node_public_key --value="$node_public_key"
    ynh_app_setting_set --key=node_private_key --value="$node_private_key"

    cat > "$data_dir/secrets/node_keys.txt" << EOF
# Claves Ed25519 del nodo para federacion ($domain)
node_public_key: $node_public_key
node_private_key: $node_private_key
EOF
    chmod 600 "$data_dir/secrets/node_keys.txt"
}

_build_app() {
    chown -R "$app:$app" "$install_dir" "$data_dir"

    pushd "$install_dir" >/dev/null
        ynh_hide_warnings ynh_exec_as_app env PATH="$PATH" HOME="$install_dir" CGO_ENABLED=0 go build -o "$install_dir/fmc-node" ./cmd/node
    popd >/dev/null

    pushd "$install_dir/web" >/dev/null
        ynh_hide_warnings ynh_exec_as_app env PATH="$PATH" HOME="$install_dir" npm ci --silent
        ynh_hide_warnings ynh_exec_as_app env PATH="$PATH" HOME="$install_dir" npm run build
        ynh_safe_rm "$install_dir/web/node_modules"
    popd >/dev/null

    chown -R "$app:$app" "$install_dir" "$data_dir"
    chmod 750 "$install_dir" "$data_dir"
    chmod +x "$install_dir/fmc-node"
}

# Instala el logo de la app para el webadmin y el portal SSO aunque la app no
# este aun en el catalogo oficial. YunoHost usa dos mecanismos (src/app.py):
#  - webadmin/app_info: /usr/share/yunohost/applogos/<app>.png si existe
#  - portal SSO: 'logo_hash' en _permissions.main de settings.yml, servido
#    como applogos/<sha256>.png (mismo mecanismo que usa el config panel)
_install_app_logo() {
    local logo_src="" candidate
    for candidate in \
        "${YNH_APP_BASEDIR:-}/doc/logo.png" \
        "${YNH_APP_BASEDIR:-}/logo.png" \
        "/etc/yunohost/apps/$app/doc/logo.png" \
        "$install_dir/doc/logo.png"; do
        if [ -n "$candidate" ] && [ -f "$candidate" ]; then
            logo_src="$candidate"
            break
        fi
    done
    if [ -z "$logo_src" ]; then
        ynh_print_warn "App logo not found; the default placeholder icon will be shown"
        return 0
    fi
    mkdir -p /usr/share/yunohost/applogos
    cp -f "$logo_src" "/usr/share/yunohost/applogos/$app.png"

    local logo_hash
    logo_hash=$(sha256sum "$logo_src" | cut -d' ' -f1)
    cp -f "$logo_src" "/usr/share/yunohost/applogos/$logo_hash.png"

    python3 - "$app" "$logo_hash" <<'PYEOF'
import sys, yaml
app, logo_hash = sys.argv[1], sys.argv[2]
path = f"/etc/yunohost/apps/{app}/settings.yml"
with open(path) as f:
    settings = yaml.safe_load(f) or {}
settings.setdefault("_permissions", {}).setdefault("main", {})["logo_hash"] = logo_hash
with open(path, "w") as f:
    yaml.safe_dump(settings, f)
PYEOF

    # Regenerar los JSON del portal para que el tile tome el logo nuevo
    ynh_hide_warnings yunohost app ssowatconf || true
}
