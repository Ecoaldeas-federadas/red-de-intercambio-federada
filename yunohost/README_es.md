# Red de Intercambio Federada para YunoHost

*[Read this README in English.](./README.md)*

> *Este paquete te permite instalar **Red de Intercambio Federada** de forma rápida y sencilla en un servidor YunoHost.*  
> *Si aún no tienes YunoHost, consulta [la guía de instalación](https://yunohost.org/install).*

## Descripción general

**Red de Intercambio Federada** es un sistema de contabilidad descentralizada y crédito mutuo de suma cero ("Mano Vuelta") para redes de trueque federadas. Funciona sobre HTTPS normal: la federación viaja cifrada de extremo a extremo por el mismo puerto web, sin necesidad de IP pública ni puertos adicionales.

**Versión incluida:** 1.0.0~ynh1

> **Nota:** esta aplicación aún **no está en el catálogo oficial de YunoHost**, por lo que se instala como "aplicación personalizada". El botón público `install-app.yunohost.org` solo funciona para apps del catálogo; no uses esa URL.

## Instalación en YunoHost

### Desde la interfaz web de YunoHost (recomendado)

1. Entra a tu webadmin → **Aplicaciones → + Instalar**.
2. Baja hasta el final del catálogo y pega la URL en el campo **"Aplicación personalizada"**:

```text
https://github.com/discapacidad5/red-intercambio_ynh
```

3. Acepta el aviso de aplicación de terceros, completa el formulario (dominio, administrador, contraseña, nombre del nodo, idioma) e instala.

### Desde la línea de comandos (SSH)

```bash
sudo yunohost app install https://github.com/discapacidad5/red-intercambio_ynh
```

Si pide confirmación de aplicación no catalogada, escribe `Yes, I understand` (o añade `--force`).

### Actualizar la aplicación

```bash
sudo yunohost app upgrade red-intercambio -u https://github.com/discapacidad5/red-intercambio_ynh
```
