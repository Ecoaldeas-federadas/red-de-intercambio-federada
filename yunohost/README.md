# Red de Intercambio Federada for YunoHost

*[Leer este README en español.](./README_es.md)*

> *This package allows you to install **Red de Intercambio Federada** quickly and simply on a YunoHost server.*  
> *If you don't have YunoHost, please consult [the guide](https://yunohost.org/install) to learn how to install it.*

## Overview

**Red de Intercambio Federada** is a decentralized mutual-credit accounting system (zero-sum "Mano Vuelta" ledger) designed for federated community barter networks. It runs over plain HTTPS: federation traffic travels end-to-end encrypted on the same web port — no public IP or extra ports required.

**Shipped version:** 1.0.0~ynh1

> **Note:** this app is **not yet in the official YunoHost catalog**, so it must be installed as a "custom app". The public `install-app.yunohost.org` badge only works for cataloged apps; do not use that URL.

## Installing on YunoHost

### From the YunoHost Webadmin (recommended)

1. Open your webadmin → **Applications → + Install**.
2. Scroll to the bottom of the catalog and paste the URL into the **"Custom app"** field:

```text
https://github.com/discapacidad5/red-intercambio_ynh
```

3. Accept the third-party app warning, fill in the form (domain, administrator, password, node name, language) and install.

### From the command line (SSH)

```bash
sudo yunohost app install https://github.com/discapacidad5/red-intercambio_ynh
```

If it asks for confirmation of an uncataloged app, type `Yes, I understand` (or add `--force`).

### Upgrading

```bash
sudo yunohost app upgrade red-intercambio -u https://github.com/discapacidad5/red-intercambio_ynh
```

## Documentation and resources

- Upstream app code repository: <https://github.com/discapacidad5/red-de-intercambio-federada>
- Official YunoHost documentation: <https://yunohost.org/>
