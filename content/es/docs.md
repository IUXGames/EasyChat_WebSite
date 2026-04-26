<!-- doc-shell:page slug="overview" -->

# EasyChat

[![Godot 4](https://img.shields.io/badge/Godot-4.x-478cbf?logo=godotengine&logoColor=white)](https://godotengine.org/)
[![Version](https://img.shields.io/badge/version-2.0.0-5aafff)](./plugin.cfg)

**EasyChat** es un addon para **Godot 4** que añade un nodo de interfaz reutilizable para **chat en juego** y **consola de comandos** con autocompletado. Funciona en **modo offline** (un solo jugador o sin sesión de red) y en **multijugador en tiempo real** cuando se combina con el addon **LinkUx**, que abstrae backends LAN u online y mantiene el mismo flujo lógico independientemente del backend activo.

Este documento describe **todas** las piezas del addon: propiedades exportadas, la API del singleton, el sistema de comandos con guías paso a paso y ejemplos de código, comportamiento en runtime y orientación para **escalar** el sistema o **modificarlo** internamente.

---

## Tabla de contenidos

1. [Características](#features)
2. [Requisitos y dependencias](#requirements)
3. [Instalación](#installation)
4. [Arquitectura del addon](#architecture)
5. [Primer uso paso a paso](#first-use)
6. [Nodo `EasyChat` (Control)](#node-easychat)
7. [Recurso `EasyChatConfig`](#config-resource)
8. [Recurso `ChatCommand`](#chatcommand-resource)
9. [Singleton global `EasyChat`](#singleton)
10. [Señales](#signals)
11. [Entrada de teclado y foco](#keyboard)
12. [Mensajes, formato y colores](#messages)
13. [Comandos (`/`) y autocompletado](#commands)
14. [Multijugador con LinkUx](#multiplayer)
15. [Animaciones](#animations)
16. [Notificaciones flotantes](#notifications)
17. [Sonidos](#sounds)
18. [Vista previa en el editor](#editor-preview)
19. [Limitaciones y convenciones](#limitations)
20. [Escalar el chat en producción](#scaling)
21. [Modificar el addon internamente](#modifying)
22. [Solución de problemas](#troubleshooting)
23. [Créditos](#credits)

---

<!-- doc-shell:page slug="features" -->

## Características

- **Nodo personalizado** registrado en el editor como tipo **EasyChat** (hereda de `Control`), con icono propio.
- **Singleton `EasyChat`** registrado automáticamente al activar el plugin; API global para abrir/cerrar, inyectar mensajes y establecer el nombre de jugador desde cualquier script.
- **Sistema de personalización simplificado y robusto**: `EasyChatConfig` concentra apariencia, comportamiento, layout, sonidos, comandos y animaciones en un único `.tres`.
- **StyleBox por elemento**: historial, autocompletado, filas de sugerencia, input, botón enviar y notificaciones aceptan recursos `StyleBox` con fallback visual predeterminado.
- **Animaciones expandidas**: todos los bloques animables soportan `NONE`, `FADE`, `FADE_UP`, `FADE_DOWN`, `FADE_LEFT`, `FADE_RIGHT`, `SLIDE_*` y `SCALE`.
- **Slide Distance por subgrupo**: `History Panel`, `Input Row`, `History messages` y `Notification` tienen su propia distancia en píxeles.
- **Recurso `ChatCommand`**: nombre, alias, descripción, documentación de uso y señal `executed(args)`. Conecta la señal desde cualquier script de tu proyecto.
- **Historial** con límite configurable; los mensajes más antiguos se eliminan automáticamente al superar el máximo.
- **Overlay no bloqueante**: el nodo raíz usa `mouse_filter = IGNORE` y nunca absorbe clics del juego; solo al abrir el chat se fuerza el cursor visible y se liberan acciones del `InputMap`.
- **Autocompletado** de comandos al escribir `/`, con navegación por teclado (↑↓ Tab) y clic de ratón.
- **Notificaciones flotantes** cuando llega un mensaje con el panel cerrado (o al enviar con `close_on_send`), con cantidad simultánea, duración y animación de entrada configurables.
- **Vista previa avanzada en editor**: nueva sección **Preview** con botones interactivos para reconstruir, alternar visibilidad y reproducir animaciones/mensajes/notificaciones en tiempo real.
- **Multijugador opcional** vía **LinkUx**: registro de RPC, broadcast al enviar, nombre local desde `LinkUx.get_local_player_name()`, visibilidad ligada al estado de sesión y cierre forzado al terminar la sesión.

---

<!-- doc-shell:page slug="requirements" -->

## Requisitos y dependencias

| Componente | Obligatorio | Notas |
|------------|-------------|-------|
| **Godot 4.x** | Sí | El código usa sintaxis y APIs de Godot 4 (`@export`, señales tipadas, `Tween`, etc.). |
| **LinkUx** | No | Solo necesario si `multiplayer_enabled` está activo en el nodo y se desea chat en red en tiempo real. El autoload **`/root/LinkUx`** debe existir. |

Ruta esperada del addon: `res://addons/easychat/` (coherente con `plugin.gd` y rutas `preload` internas).

---

<!-- doc-shell:page slug="installation" -->

## Instalación

### Paso 1 — Copiar el addon

Copia la carpeta `easychat` dentro de `res://addons/easychat/`. La ruta final debe ser:

```plaintext
res://addons/easychat/plugin.cfg
res://addons/easychat/plugin.gd
res://addons/easychat/easychat.gd
res://addons/easychat/easychat_node.gd
res://addons/easychat/easychat_config.gd
res://addons/easychat/chat_command.gd
```

### Paso 2 — Activar el plugin

Abre el proyecto en Godot 4, ve a **Project → Project Settings → Plugins**, localiza **EasyChat** en la lista y haz clic en **Enable**.

Al activarse el plugin:
- Se registra el autoload **`EasyChat`** (singleton) apuntando a `res://addons/easychat/easychat.gd`.
- Se registra el tipo de nodo personalizado **EasyChat** en el diálogo de añadir nodos (bajo `Control`).

### Paso 3 — Añadir el nodo a una escena

1. Abre la escena donde quieras el chat (p. ej. `main.tscn` o una escena de HUD dedicada).
2. Añade un nodo **`CanvasLayer`** como hijo de tu raíz (recomendado para que el chat siempre se renderice encima).
3. Dentro del `CanvasLayer`, añade un nodo **EasyChat**. Lo encontrarás en el buscador de nodos bajo **Control → EasyChat**.

### Paso 4 — (Opcional) Instalar LinkUx para multijugador

Si quieres chat en red, instala y activa también **LinkUx**. EasyChat lo espera en `/root/LinkUx`. Una vez instalado:

1. En el inspector del nodo **EasyChat**, activa `multiplayer_enabled`.
2. Inicia una sesión a través de LinkUx; EasyChat registrará automáticamente el RPC y empezará a hacer broadcast de mensajes.

---

<!-- doc-shell:page slug="architecture" -->

## Arquitectura del addon

| Archivo | Rol |
|---------|-----|
| `plugin.cfg` | Metadatos del plugin (nombre, versión, script del plugin). |
| `plugin.gd` | `EditorPlugin`: al habilitar/deshabilitar gestiona el autoload; al entrar/salir del árbol del editor registra el tipo **EasyChat**. |
| `easychat.gd` | Singleton **EasyChat**: fachada que delega cada llamada en la instancia activa del nodo. |
| `easychat_node.gd` | Nodo **EasyChat**: construye toda la UI por código, gestiona input, comandos, animaciones, notificaciones, sonidos e integración con LinkUx. |
| `easychat_config.gd` | `class_name EasyChatConfig` — recurso de configuración con todos los ajustes visuales y de comportamiento. |
| `chat_command.gd` | `class_name ChatCommand` — recurso por comando con señal `executed(args)`. |
| `icon.svg` | Icono del nodo y del script en el editor. |

### Flujo de registro

```plaintext
_ready() [solo en juego]
  └─ EasyChat._register(self)       ← el nodo se registra en el singleton
        └─ el singleton guarda la referencia y conecta sus señales

_exit_tree()
  └─ EasyChat._unregister(self)     ← el nodo se desregistra
```

Solo puede haber **una** instancia EasyChat activa por escena a la que el singleton delega. Una segunda instancia genera **warning** y es ignorada por el singleton (ambos nodos siguen funcionando de forma independiente, pero solo el primero en registrarse controla `EasyChat.*`).

El nodo también se añade al grupo `"easychat"`, útil para búsquedas o herramientas: `get_tree().get_nodes_in_group("easychat")`.

---

<!-- doc-shell:page slug="first-use" -->

## Primer uso paso a paso

### Solo offline / sin LinkUx

1. Activa el plugin **EasyChat** (ver [Instalación](#installation)).
2. Añade un `CanvasLayer` a tu escena de juego y, dentro de él, un nodo **EasyChat**.
3. Deja `multiplayer_enabled` en `false` (valor por defecto).
4. Ejecuta la escena. Pulsa **T** (la `open_key` por defecto) para abrir el chat; **Escape** para cerrarlo.
5. Escribe cualquier texto y pulsa **Enter** o el botón de enviar para publicar un mensaje.
6. Para comandos, escribe `/` seguido del nombre del comando y argumentos opcionales.

### Asignar el nombre del jugador local

Antes o después de que el nodo entre en el árbol de escena:

```gdscript
func _ready() -> void:
    EasyChat.set_player_name("CaballeroVerde")
```

Este nombre sustituye `{sender}` en el formato de mensaje al enviar. En multijugador se sobreescribe por `LinkUx.get_local_player_name()` cuando esté disponible.

### Usar un recurso de configuración compartido

1. En el panel **FileSystem**: clic derecho → **New Resource** → busca `EasyChatConfig` → guarda como p. ej. `res://ui/chat_config.tres`.
2. Ajusta colores, fuentes, animaciones, sonidos y comandos en el inspector.
3. En el inspector del nodo **EasyChat**, arrastra tu `.tres` al campo **Config**.
4. Reutiliza el mismo `.tres` en otras escenas (lobby, partida, etc.) para un estilo coherente.

Si no se asigna ningún config en runtime, el nodo crea automáticamente `EasyChatConfig.new()` con valores por defecto.

### Multijugador (LinkUx)

1. Instala **LinkUx** y verifica que esté registrado como autoload en `/root/LinkUx`.
2. En el nodo **EasyChat** activa `multiplayer_enabled = true`.
3. Inicia una sesión con LinkUx (consulta la documentación de ese addon). EasyChat hará lo siguiente al iniciarse la sesión:
   - Registrará dos RPCs: `easychat_message` (chat de jugadores) y `easychat_system` (mensajes de sistema).
   - Usará `LinkUx.get_local_player_name()` como nombre del remitente.
   - Hará broadcast de cada mensaje no-comando a todos los peers.
   - Forzará el cierre del chat y limpiará el estado cuando la sesión termine.

---

<!-- doc-shell:page slug="node-easychat" -->

## Nodo `EasyChat` (Control)

Este es el **nodo principal** que añades a tu escena. Construye toda la UI del chat de forma programática dentro de un `Control` a pantalla completa anclado con `PRESET_FULL_RECT`. El layout del chat se posiciona en la esquina inferior-izquierda del viewport usando los offsets de `EasyChatConfig`.

### Propiedades exportadas (inspector)

#### `config` — `EasyChatConfig`

Recurso con toda la personalización visual y de comportamiento. Si se deja vacío en runtime, el nodo crea `EasyChatConfig.new()` con valores por defecto. En el editor, al asignar o cambiar el recurso se reconecta `config.changed` para refrescar la vista previa en tiempo real.

#### Grupo Multiplayer

| Propiedad | Tipo | Por defecto | Descripción |
|-----------|------|-------------|-------------|
| `multiplayer_enabled` | `bool` | `false` | Activa la integración con LinkUx. Si LinkUx no está disponible, se registra un **error** en consola y el comportamiento de red queda inactivo. |

#### Grupo Controls

| Propiedad | Tipo | Por defecto | Descripción |
|-----------|------|-------------|-------------|
| `open_key` | `Key` | `KEY_T` | Tecla para **abrir** el chat (procesada en `_unhandled_key_input` cuando el chat está cerrado y habilitado). Sustituye el token `{key}` en el texto placeholder del campo de entrada. |
| `close_key` | `Key` | `KEY_ESCAPE` | Con el chat **abierto**: cierra primero el panel de sugerencias si está visible, luego cierra el chat. Procesada en `_input` para consumir el evento antes que el resto. |

### API pública del nodo

Disponible cuando tienes una referencia directa al nodo EasyChat. La mayoría del tiempo usarás el **singleton** en su lugar.

| Método | Comportamiento |
|--------|----------------|
| `is_open() -> bool` | `true` si el panel de historial está abierto o siendo animado. |
| `enable()` | Marca el chat como habilitado y lo muestra según las reglas de visibilidad internas. |
| `disable()` | Fuerza el cierre si estaba abierto, limpia el historial, luego deshabilita y oculta el nodo. |
| `clear_history()` | Elimina inmediatamente todos los labels de mensajes de la lista del historial. |
| `set_player_name(name: String)` | Establece el nombre del jugador local usado como remitente. |

```gdscript
# Ejemplo: habilitar/deshabilitar el chat según el estado del juego
func _on_game_started() -> void:
    EasyChat.enable()

func _on_game_paused() -> void:
    EasyChat.disable()
```

---

<!-- doc-shell:page slug="config-resource" -->

## Recurso `EasyChatConfig`

`class_name EasyChatConfig extends Resource`. Agrupa todas las opciones en bloques `@export_group` / `@export_subgroup`.

### Enumeración `AnimType`

Controla cómo animan el **panel de historial**, la **fila de entrada**, los **mensajes de historial** y las **notificaciones**.

| Valor | Significado |
|-------|-------------|
| `NONE` | Mostrar/ocultar al instante (sin transición). |
| `FADE` | Fundido con `modulate.a`. |
| `FADE_UP` | Fundido + desplazamiento vertical hacia arriba al entrar (inverso al salir). |
| `FADE_DOWN` | Fundido + desplazamiento vertical hacia abajo al entrar (inverso al salir). |
| `FADE_LEFT` | Fundido + desplazamiento horizontal desde la izquierda (inverso al salir). |
| `FADE_RIGHT` | Fundido + desplazamiento horizontal desde la derecha (inverso al salir). |
| `SLIDE_UP` | El historial entra desde abajo; al cerrar sale hacia abajo. |
| `SLIDE_DOWN` | El historial entra desde arriba; al cerrar sale hacia arriba. |
| `SLIDE_LEFT` | Entra desde la izquierda; al cerrar sale a la izquierda. |
| `SLIDE_RIGHT` | Entra desde la derecha; al cerrar sale a la derecha. |
| `SCALE` | Escala vertical desde casi cero hasta 1, pivote en el borde inferior. Easing `BACK` al aparecer, `CUBIC` al ocultar. |

Las distancias de desplazamiento ahora son **configurables por subgrupo** en `Animations` con propiedades `*_slide_distance`.

### Grupo Appearance

#### Subgrupo History (panel de mensajes)

| Propiedad | Tipo | Por defecto | Uso |
|-----------|------|-------------|-----|
| `history_style` | `StyleBox` | `null` | StyleBox del panel de historial. Si es `null`, usa estilo predeterminado integrado. |

#### Subgrupo Autocomplete

| Propiedad | Tipo | Uso |
|-----------|------|-----|
| `autocomplete_style` | `StyleBox` | StyleBox del panel de sugerencias. |
| `autocomplete_item_style` | `StyleBox` | StyleBox para filas no seleccionadas. |
| `autocomplete_selected_style` | `StyleBox` | StyleBox para la fila seleccionada/resaltada. |
| `autocomplete_command_color` | `Color` | Color del texto del nombre `/comando`. |
| `autocomplete_desc_color` | `Color` | Color del texto de la descripción. |
| `autocomplete_font_size` | `int` | Tamaño de fuente en la lista de sugerencias. |
| `autocomplete_font` | `Font` | Fuente personalizada opcional para comando y descripción. |

#### Subgrupo Input (`LineEdit`)

| Propiedad | Tipo | Uso |
|-----------|------|-----|
| `input_style` | `StyleBox` | StyleBox del input en estado normal. |
| `input_focus_style` | `StyleBox` | StyleBox del input cuando tiene foco. |
| `input_font_size` | `int` | Tamaño del texto escrito. |
| `input_font` | `Font` | Fuente personalizada opcional para texto y placeholder. |
| `input_caret_color` | `Color` | Color del cursor de texto. |
| `input_placeholder_color` | `Color` | Color del texto placeholder. |
| `input_placeholder_text` | `String` | Texto placeholder; `{key}` se reemplaza por el nombre de visualización de `open_key`. |

#### Subgrupo Send Button

| Propiedad | Tipo | Uso |
|-----------|------|-----|
| `send_button_style` | `StyleBox` | StyleBox normal del botón enviar. |
| `send_button_hover_style` | `StyleBox` | StyleBox hover/pressed del botón enviar. |
| `send_button_text` | `String` | Etiqueta del botón (por defecto símbolo `↵`). |
| `send_button_text_color` | `Color` | Color del texto del botón. |
| `send_button_font_size` | `int` | Tamaño de fuente. |
| `send_button_font` | `Font` | Fuente personalizada opcional para la etiqueta del botón. |

#### Subgrupo Messages (historial)

| Propiedad | Tipo | Uso |
|-----------|------|-----|
| `message_font_size` | `int` | Tamaño para todos los mensajes del historial. |
| `message_font` | `Font` | Fuente personalizada opcional para mensajes del historial. |
| `message_format` | `String` | Plantilla de texto con los tokens `{sender}` y `{message}`. Por defecto: `"{sender}: {message}"`. |
| `local_message_color` | `Color` | Color de los mensajes enviados por el jugador local. |
| `remote_message_color` | `Color` | Color de los mensajes de otros jugadores o inyectados con `add_message()`. |
| `system_message_color` | `Color` | Color de los mensajes de sistema. |
| `system_message_prefix` | `String` | Prefijo ante cada mensaje de sistema (por defecto `▶ `). |

#### Subgrupo Notification

| Propiedad | Tipo | Uso |
|-----------|------|-----|
| `notification_style` | `StyleBox` | StyleBox de cada notificación apilada. |
| `notification_color` | `Color` | Color del texto de la notificación flotante. |
| `notification_font_size` | `int` | Tamaño del texto. |
| `notification_font` | `Font` | Fuente personalizada opcional para el texto de notificación. |

### Grupo Behavior

| Propiedad | Tipo | Por defecto | Descripción |
|-----------|------|-------------|-------------|
| `show_send_button` | `bool` | `true` | Muestra u oculta el botón de enviar. |
| `close_on_send` | `bool` | `false` | Cierra el chat después de enviar un mensaje **o** ejecutar un comando. El último mensaje puede aparecer brevemente como notificación. |
| `alpha_input_closed` | `float` | `0.35` | Opacidad de la fila de entrada con el chat cerrado si la animación es `FADE`, `FADE_*` o `NONE`. |
| `notification_alpha` | `float` | `0.75` | Opacidad máxima alcanzada durante el fade-in de una notificación. |
| `notification_duration` | `float` | `3.0` | Segundos que una notificación permanece completamente visible antes de hacer fade-out. |
| `max_messages` | `int` | `100` | Máximo de líneas en el historial; el mensaje más antiguo se elimina al superarse el límite. |
| `max_suggestions_visible` | `int` | `6` | Máximo de filas de autocompletado visibles a la vez (el resto hace scroll). |
| `max_notifications` | `int` | `3` | Máximo de notificaciones flotantes en pantalla a la vez; la más antigua se elimina al superarse. |

### Grupo Animations

#### Subgrupo History Panel

| Propiedad | Tipo | Por defecto |
|-----------|------|-------------|
| `history_anim_type` | `AnimType` | `FADE` |
| `history_anim_duration` | `float` | `0.18` s |
| `history_slide_distance` | `float` | `206.0` px |

#### Subgrupo Input Row

| Propiedad | Tipo | Por defecto |
|-----------|------|-------------|
| `input_anim_type` | `AnimType` | `FADE` |
| `input_anim_duration` | `float` | `0.18` s |
| `input_slide_distance` | `float` | `42.0` px |

Con tipos **FADE** y **FADE_***, la fila de entrada vuelve a `alpha_input_closed` al cerrar. Con **SLIDE** o **SCALE**, queda totalmente oculta.

#### Subgrupo History messages

| Propiedad | Tipo | Por defecto |
|-----------|------|-------------|
| `message_anim_type` | `AnimType` | `NONE` |
| `message_anim_duration` | `float` | `0.12` s |
| `message_slide_distance` | `float` | `28.0` px |

Controla la animación de aparición de cada nueva línea en el historial.

#### Subgrupo Notification

| Propiedad | Tipo | Por defecto |
|-----------|------|-------------|
| `notification_anim_type` | `AnimType` | `FADE` |
| `notification_anim_duration` | `float` | `0.15` s |
| `notification_slide_distance` | `float` | `28.0` px |

### Personalización avanzada con StyleBox (recomendado)

1. Crea un `StyleBoxFlat` o `StyleBoxTexture` desde el Inspector.
2. Ajusta fondo, borde, radios y márgenes internos.
3. Asigna ese recurso a la propiedad `*_style` correspondiente.
4. Reutiliza el mismo recurso en varios elementos o varios configs para mantener consistencia visual.
5. Si quieres volver al look nativo del addon, deja la propiedad en `null`.

Esta arquitectura permite pieles visuales muy complejas sin tocar `easychat_node.gd`.

### Grupo Layout

| Propiedad | Tipo | Por defecto | Descripción |
|-----------|------|-------------|-------------|
| `panel_width` | `float` | `415` px | Ancho de todo el bloque del chat. |
| `panel_height` | `float` | `206` px | Alto del área de historial de mensajes. |
| `input_height` | `float` | `42` px | Alto de la fila de entrada (también referencia de slide/scale para esa fila). |
| `send_button_width` | `float` | `52` px | Ancho mínimo del botón de enviar. |
| `panel_margin_left` | `float` | `10` px | Distancia al borde izquierdo del viewport. |
| `panel_margin_bottom` | `float` | `10` px | Distancia al borde inferior del viewport. |
| `suggestion_item_height` | `float` | `28` px | Alto de cada fila de sugerencia en el autocompletado. |

### Grupo Sounds

Todas las propiedades son `AudioStream` opcionales (`null` = silencio).

| Propiedad | Cuándo se reproduce |
|-----------|---------------------|
| `sound_message_received` | Llega un mensaje de otro jugador (no local). |
| `sound_system_message` | Se añade un mensaje de sistema. |
| `sound_message_sent` | El jugador local envía un mensaje de chat. |
| `sound_chat_opened` | Se abre el chat. |
| `sound_chat_closed` | Se cierra el chat. |

La reproducción usa un único `AudioStreamPlayer` hijo del nodo; un sonido nuevo interrumpe al anterior si todavía está sonando.

### Grupo Commands

| Propiedad | Tipo | Descripción |
|-----------|------|-------------|
| `commands` | `Array[ChatCommand]` | Lista de todos los comandos disponibles para entrada `/` y autocompletado. |

---

<!-- doc-shell:page slug="chatcommand-resource" -->

## Recurso `ChatCommand`

`class_name ChatCommand extends Resource`. Representa una entrada de comando individual.

| Miembro | Tipo | Descripción |
|---------|------|-------------|
| `executed` | `signal executed(args: Array)` | Emitida al ejecutar el comando. `args` es un array de strings (los tokens tras el nombre). |
| `command_name` | `String` | Nombre principal tras `/`. Coincidencia **sin distinguir mayúsculas** (`/Hello`, `/HELLO` y `/hello` coinciden con `"hello"`). |
| `aliases` | `PackedStringArray` | Nombres alternativos, también comparados en minúsculas. Añadir `"tp"` aquí hace que `/tp` también dispare este comando. |
| `description` | `String` | Texto corto mostrado en el panel de autocompletado junto al nombre. Mantenlo en una línea. |
| `usage` | `String` | Documentación de uso más detallada para tus propias pantallas de ayuda. **El addon no lo muestra** en la UI de sugerencias; solo se muestra `description`. |

### Parseo de argumentos

Cuando el usuario envía `/cmd arg1 arg2 arg3`, el nodo:

1. Elimina el `/` inicial.
2. Divide el texto por espacios: `["cmd", "arg1", "arg2", "arg3"]`.
3. Toma el primer token como nombre del comando.
4. Pasa los tokens restantes como `args: Array` al emitir `executed`.

```gdscript
# El usuario escribe: /kick jugador123 trampa confirmada
# args = ["jugador123", "trampa", "confirmada"]

func _on_kick_executed(args: Array) -> void:
    var objetivo: String = args[0] if args.size() >= 1 else ""
    var razon: String = " ".join(args.slice(1)) if args.size() >= 2 else "sin razon"
    print("Expulsado %s — Razón: %s" % [objetivo, razon])
```

Si no se proporcionan argumentos, `args` es un **array vacío** `[]`.

---

<!-- doc-shell:page slug="singleton" -->

## Singleton global `EasyChat`

Registrado por `plugin.gd` como autoload (ruta: `res://addons/easychat/easychat.gd`). Disponible desde cualquier script como `EasyChat.*` sin necesitar una referencia al nodo.

| Método | Comportamiento |
|--------|----------------|
| `enable()` | Habilita y muestra el nodo activo. |
| `disable()` | Fuerza el cierre, limpia el historial, deshabilita y oculta el nodo activo. |
| `is_open() -> bool` | `true` si hay un nodo registrado y está abierto. |
| `is_enabled() -> bool` | `true` si hay un nodo registrado y habilitado. |
| `clear_history()` | Elimina todos los mensajes del historial del nodo activo. |
| `add_message(sender: String, text: String)` | Inyecta un mensaje con estilo **remoto** (`remote_message_color`), sin pasar por el input local. También emite `message_received`. |
| `add_system_message(text: String)` | Inyecta un mensaje de sistema (prefijo + `system_message_color`). **No** emite `message_received`. |
| `set_player_name(name: String)` | Establece el nombre del jugador local usado como remitente. |

Si no hay ninguna instancia válida registrada, todas las llamadas son **no-ops** (excepto `is_open` / `is_enabled` que devuelven `false`).

### Ejemplos de uso

```gdscript
# Establecer el nombre al iniciar partida
func _on_game_ready() -> void:
    EasyChat.set_player_name("MagoAzul")
    EasyChat.enable()

# Inyectar un anuncio del servidor desde código (no escrito por el usuario)
func _on_server_event(texto: String) -> void:
    EasyChat.add_system_message(texto)

# Inyectar un mensaje que parece venir de otro jugador (o un NPC)
func _on_npc_habla(nombre_npc: String, texto: String) -> void:
    EasyChat.add_message(nombre_npc, texto)

# Pausar el juego mientras el chat está abierto
func _process(_delta: float) -> void:
    if EasyChat.is_open():
        get_tree().paused = true
    else:
        get_tree().paused = false
```

---

<!-- doc-shell:page slug="signals" -->

## Señales

### En el nodo `EasyChat` (y reexpuestas por el singleton)

| Señal | Parámetros | Cuándo |
|-------|------------|--------|
| `chat_opened` | — | Se dispara al inicio de la secuencia de apertura (animaciones, sonido y foco diferido). |
| `chat_closed` | — | Se dispara tras un cierre normal o forzado (sesión cerrada, `disable()`, etc.). |
| `message_received` | `sender: String`, `message: String` | Se dispara por **cada** mensaje añadido al historial vía `_add_message` — tanto los enviados localmente como los recibidos de la red. No se dispara para mensajes de sistema. |

### Conectar vía el singleton (recomendado)

```gdscript
extends Node

func _ready() -> void:
    EasyChat.chat_opened.connect(_on_chat_abierto)
    EasyChat.chat_closed.connect(_on_chat_cerrado)
    EasyChat.message_received.connect(_on_mensaje)

func _on_chat_abierto() -> void:
    # Ej: pausar el juego u ocultar otro UI
    get_tree().paused = true

func _on_chat_cerrado() -> void:
    get_tree().paused = false

func _on_mensaje(remitente: String, mensaje: String) -> void:
    # Registrar chat en un archivo, desbloquear logros, etc.
    print("[CHAT] %s: %s" % [remitente, mensaje])
```

### Conectar vía referencia directa al nodo

```gdscript
@onready var chat: Control = $CanvasLayer/EasyChat

func _ready() -> void:
    chat.message_received.connect(_on_mensaje)

func _on_mensaje(remitente: String, mensaje: String) -> void:
    pass
```

---

<!-- doc-shell:page slug="keyboard" -->

## Entrada de teclado y foco

| Acción | Tecla | Dónde se procesa |
|--------|-------|------------------|
| Abrir chat | `open_key` (por defecto `T`) | `_unhandled_key_input` — solo si el chat está **cerrado** y **habilitado**. |
| Cerrar chat / descartar autocompletado | `close_key` (por defecto `Escape`) | `_input` — primero cierra el panel de sugerencias si está visible, luego cierra el chat. Se consume antes que el resto. |
| Navegar sugerencias | `↑` / `↓` | `_input` mientras el chat está abierto y el panel de sugerencias es visible. |
| Aplicar sugerencia | `Tab` | `_input` mientras el chat está abierto; aplica la sugerencia seleccionada (o la primera si no hay ninguna). |

### Foco y modo de ratón

- **Al abrir:** se guarda `Input.mouse_mode` y se establece `MOUSE_MODE_VISIBLE`. Se llama `Input.action_release` para **cada** acción del `InputMap` para evitar teclas "pegadas" (p. ej. si el jugador mantenía pulsado un botón de movimiento al abrir el chat).
- **Al cerrar:** se restaura el modo de ratón anterior.
- El botón de enviar usa `focus_mode = FOCUS_NONE` para que el foco del teclado permanezca en el `LineEdit`.
- El nodo raíz usa `mouse_filter = IGNORE` para no absorber clics del juego.

---

<!-- doc-shell:page slug="messages" -->

## Mensajes, formato y colores

### Plantilla de formato

`message_format` en `EasyChatConfig` es una plantilla de texto aplicada a cada mensaje de jugador. Tokens soportados:

| Token | Sustituido por |
|-------|---------------|
| `{sender}` | Nombre del remitente (jugador local o remoto). |
| `{message}` | El cuerpo del mensaje. |

Valor por defecto: `"{sender}: {message}"` → produce `"CaballeroVerde: Hola!"`

Puedes personalizarlo libremente:

```plaintext
[{sender}] {message}       →  [CaballeroVerde] Hola!
<{sender}> {message}       →  <CaballeroVerde> Hola!
{sender} dice: {message}   →  CaballeroVerde dice: Hola!
```

### Tipos de mensajes y colores

| Tipo | Propiedad de color | Originado por |
|------|--------------------|---------------|
| Local | `local_message_color` | Mensajes que envías tú (verde por defecto). |
| Remoto | `remote_message_color` | Mensajes de otros jugadores o `EasyChat.add_message()` (blanco por defecto). |
| Sistema | `system_message_color` | `EasyChat.add_system_message()` o error de comando desconocido (amarillo por defecto). |

### Límite de historial

Cuando se alcanza `max_messages`, el `Label` más antiguo de la lista es eliminado con `queue_free` antes de añadir el nuevo.

### Comportamiento del scroll

Cuando se añade un mensaje con el chat **abierto**, el scroll container baja al final en el siguiente frame. Si el chat está **cerrado**, se muestra una notificación flotante en su lugar.

---

<!-- doc-shell:page slug="commands" -->

## Comandos (`/`) y autocompletado

Cualquier línea de entrada que **empiece por `/`** se trata como un comando y **nunca** se envía como mensaje de chat. Esta sección explica cada paso desde la creación de un recurso de comando hasta su manejo en la lógica del juego, con ejemplos de código completos.

### Cómo funciona la ejecución de comandos

Cuando el usuario pulsa Enter en `/cmd arg1 arg2`:

1. El nodo detecta el `/` inicial.
2. Divide el texto por espacios: `["cmd", "arg1", "arg2"]`.
3. Busca en `config.commands` un `ChatCommand` cuyo `command_name` o algún `alias` coincida con `"cmd"` (sin distinción de mayúsculas).
4. Si lo encuentra: emite `command.executed.emit(["arg1", "arg2"])`.
5. Si **no lo encuentra**: muestra `▶ Unknown command: /cmd` como mensaje de sistema.

---

### Paso 1 — Crear el archivo de recurso `ChatCommand`

En el panel **FileSystem** (parte inferior izquierda de Godot):

1. Navega a la carpeta donde quieras guardar los comandos. Se recomienda crear una carpeta dedicada, por ejemplo `res://chat/comandos/`.
2. Haz clic derecho dentro de esa carpeta y selecciona **New Resource**.
3. Aparece un diálogo de búsqueda. Escribe `ChatCommand` y pulsa **Enter** o haz doble clic en el resultado.
4. Se abre el diálogo de guardado. Dale al archivo un nombre descriptivo, por ejemplo `cmd_hola.tres`, y haz clic en **Save**.

El archivo aparece en el FileSystem. Haz clic en él una vez para seleccionarlo — el panel **Inspector** de la derecha mostrará todas sus propiedades editables.

---

### Paso 2 — Configurar las propiedades del comando en el Inspector

Con tu `cmd_hola.tres` seleccionado, el Inspector muestra cuatro campos. Aquí se explica qué hace cada uno y cómo rellenarlo:

#### `command_name` — La palabra clave disparadora

| | |
|---|---|
| **Qué es** | La palabra principal que el usuario escribe tras `/` para ejecutar este comando. |
| **Qué escribir** | Una única palabra en minúsculas **sin** el `/`. Ejemplo: `hola` |
| **Cómo coincide** | Sin distinción de mayúsculas — el usuario puede escribir `/hola`, `/Hola` o `/HOLA` y todas coinciden. |
| **¿Dejar vacío?** | El comando nunca coincidirá y no aparecerá en el autocompletado. Rellena siempre este campo. |

```plaintext
Campo del inspector → command_name
Valor               → hola
```

#### `aliases` — Palabras clave alternativas

| | |
|---|---|
| **Qué es** | Un array de palabras adicionales que también disparan este comando. |
| **Qué escribir** | Haz clic en el campo del array, pulsa **+** para añadir elementos y escribe cada nombre alternativo. |
| **Cómo coincide** | La misma regla sin distinción de mayúsculas que `command_name`. |
| **¿Dejar vacío?** | Perfectamente válido — la mayoría de comandos no necesitan alias. |
| **Ejemplo de uso** | Un comando `teletransportar` puede tener `["tp"]` para que `/tp` funcione como atajo. |

```plaintext
Campo del inspector → aliases
Valor               → ["hi", "hey"]
Efecto              → /hi y /hey también disparan este comando
```

#### `description` — Texto visible en el panel de autocompletado

| | |
|---|---|
| **Qué es** | Una etiqueta corta que aparece junto al nombre del comando en el desplegable de autocompletado cuando el usuario escribe `/`. |
| **Qué escribir** | Una frase corta. Ejemplo: `Saluda a todos en el chat` |
| **Buena práctica** | Mantenlo en una línea y menciona los argumentos si los tiene. Ejemplo: `Mueve al jugador — /teletransportar <x> <y>` |
| **¿Dejar vacío?** | El comando sigue funcionando pero la fila del autocompletado no mostrará ningún texto descriptivo. |

```plaintext
Campo del inspector → description
Valor               → Saluda a todos en el chat
```

Esto es lo que ve el jugador cuando escribe `/ho` en el campo de chat:

```plaintext
┌───────────────────────────────────────────────┐
│  /hola   Saluda a todos en el chat            │
└───────────────────────────────────────────────┘
```

#### `usage` — Documentación de sintaxis completa (para tus propias pantallas de ayuda)

| | |
|---|---|
| **Qué es** | Una cadena más larga que documenta la sintaxis completa del comando, pensada para tu propio comando `/ayuda` o tooltips. |
| **Qué escribir** | El comando completo con marcadores de posición. Ejemplo: `/hola` o `/teletransportar <x> <y>` |
| **Importante** | **Este campo NO se muestra en el panel de autocompletado.** Solo `description` aparece ahí. |
| **¿Dejar vacío?** | Perfectamente válido — no tiene ningún efecto en el autocompletado ni en la ejecución. |
| **Cómo usarlo** | Léelo en tu handler de `/ayuda`: `EasyChat.add_system_message(cmd.usage)` |

```plaintext
Campo del inspector → usage
Valor               → /hola
```

---

### Paso 3 — Añadir el comando a `EasyChatConfig`

El recurso del comando debe registrarse en el config para que el nodo del chat lo conozca.

1. En el **FileSystem**, haz clic en tu archivo `EasyChatConfig.tres` para seleccionarlo (o el config que hayas asignado al nodo EasyChat).
2. En el **Inspector**, desplázate hasta el grupo **Commands** en la parte inferior.
3. Haz clic en la fila del array `commands` para expandirla.
4. Haz clic en el botón **Añadir elemento** (`+`) que aparece.
5. Aparece un nuevo slot vacío. Haz clic en él y:
   - Arrastra tu `cmd_hola.tres` desde el FileSystem al slot, **o bien**
   - Haz clic en el icono de carpeta del slot para abrir el selector de recursos, localiza tu archivo y confirma.
6. El nombre y la descripción del comando aparecen ahora en el slot.

Repite desde el paso 4 para cada comando adicional. Los comandos se comprueban **en orden** — si dos comandos comparten el mismo `command_name`, gana el primero del array.

> **Consejo:** Puedes reordenar los comandos arrastrando las filas del array. El orden también determina el orden en la lista de sugerencias del autocompletado.

También puedes crear comandos por código sin archivos `.tres` (útil para comandos registrados de forma procedural en tiempo de ejecución):

```gdscript
var cmd = ChatCommand.new()
cmd.command_name = "hola"
cmd.aliases = PackedStringArray(["hi", "hey"])
cmd.description = "Saluda a todos"
cmd.usage = "/hola"
# Añadir al config en tiempo de ejecución:
chat_node.config.commands.append(cmd)
cmd.executed.connect(_on_hola_ejecutado)
```

---

### Paso 4 — Conectar la señal `executed`

El recurso `ChatCommand` tiene la señal `executed(args: Array)`. Conéctala desde **cualquier script** de tu proyecto que tenga una referencia al mismo archivo `.tres`. Como `ChatCommand` es un `Resource`, todos los scripts que hagan `preload` de la misma ruta comparten el **mismo objeto** y recibirán la señal cuando el comando se dispare.

#### Opción A — `preload` en tu script (recomendado)

```gdscript
# En cualquier script — no necesita estar en la misma escena que EasyChat
extends Node

var cmd_hola = preload("res://chat/comandos/cmd_hola.tres")

func _ready() -> void:
    cmd_hola.executed.connect(_on_hola_ejecutado)

func _on_hola_ejecutado(args: Array) -> void:
    EasyChat.add_system_message("¡Hola a todos!")
```

#### Opción B — Iterar por la lista de comandos del config

Útil cuando quieres manejar todos los comandos en un solo lugar sin tener referencias individuales:

```gdscript
@onready var chat: Control = $CanvasLayer/EasyChat

func _ready() -> void:
    for cmd in chat.config.commands:
        match cmd.command_name:
            "hola":
                cmd.executed.connect(_on_hola_ejecutado)
            "teletransportar":
                cmd.executed.connect(_on_teletransportar_ejecutado)
            "expulsar":
                cmd.executed.connect(_on_expulsar_ejecutado)
```

---

### Ejemplo A — Comando sin argumentos: `/ping`

Un simple `/ping` que muestra un mensaje de estado.

**Propiedades de `cmd_ping.tres`:**
- `command_name`: `ping`
- `description`: `Verifica el estado de conexión`

**Script:**

```gdscript
extends Node

var cmd_ping = preload("res://chat/comandos/cmd_ping.tres")

func _ready() -> void:
    cmd_ping.executed.connect(_on_ping)

func _on_ping(args: Array) -> void:
    # args es [] cuando el usuario escribe solo "/ping"
    # Los argumentos extra se ignoran en este ejemplo
    EasyChat.add_system_message("¡Pong! El servidor es accesible.")
```

**Uso en el juego:**
```plaintext
/ping           →  ▶ ¡Pong! El servidor es accesible.
/ping algo      →  ▶ ¡Pong! El servidor es accesible.  (args ignorados)
```

---

### Ejemplo B — Comando con argumentos requeridos: `/teletransportar x y`

Un comando que mueve al jugador local a una posición específica.

**Propiedades de `cmd_teleport.tres`:**
- `command_name`: `teletransportar`
- `aliases`: `["tp"]`
- `description`: `Mueve al jugador a una posición — /teletransportar <x> <y>`

**Script:**

```gdscript
extends Node

@export var jugador: CharacterBody2D

var cmd_tp = preload("res://chat/comandos/cmd_teleport.tres")

func _ready() -> void:
    cmd_tp.executed.connect(_on_teletransportar)

func _on_teletransportar(args: Array) -> void:
    if args.size() < 2:
        EasyChat.add_system_message("Uso: /teletransportar <x> <y>")
        return

    var x := float(args[0])
    var y := float(args[1])

    if is_instance_valid(jugador):
        jugador.global_position = Vector2(x, y)
        EasyChat.add_system_message("Teletransportado a (%.0f, %.0f)" % [x, y])
    else:
        EasyChat.add_system_message("Error: referencia al jugador no establecida.")
```

**Uso en el juego:**
```plaintext
/teletransportar 320 200   →  ▶ Teletransportado a (320, 200)
/tp 0 0                    →  ▶ Teletransportado a (0, 0)       (¡el alias funciona!)
/teletransportar           →  ▶ Uso: /teletransportar <x> <y>  (pocos argumentos)
/teletransportar abc 200   →  ▶ Teletransportado a (0, 200)    (float("abc") = 0.0)
```

---

### Ejemplo C — Comando con argumentos opcionales: `/gritar [texto]`

Un comando `/gritar` que emite un texto personalizado en mayúsculas o una frase por defecto.

**Propiedades de `cmd_gritar.tres`:**
- `command_name`: `gritar`
- `description`: `Grita un mensaje en mayúsculas. Uso: /gritar [texto]`

**Script:**

```gdscript
extends Node

var cmd_gritar = preload("res://chat/comandos/cmd_gritar.tres")

func _ready() -> void:
    cmd_gritar.executed.connect(_on_gritar)

func _on_gritar(args: Array) -> void:
    var texto: String
    if args.is_empty():
        texto = "¡AAAAAAAA!"
    else:
        texto = " ".join(args).to_upper() + "!"

    EasyChat.add_system_message(texto)
```

**Uso en el juego:**
```plaintext
/gritar                   →  ▶ ¡AAAAAAAA!
/gritar hola mundo        →  ▶ HOLA MUNDO!
/gritar el pastel es mio  →  ▶ EL PASTEL ES MIO!
```

---

### Ejemplo D — Comando con cantidad variable de argumentos: `/expulsar [jugador] [razon...]`

Un comando de moderación que acepta cualquier número de palabras como razón.

**Script:**

```gdscript
extends Node

var cmd_expulsar = preload("res://chat/comandos/cmd_expulsar.tres")

func _ready() -> void:
    cmd_expulsar.executed.connect(_on_expulsar)

func _on_expulsar(args: Array) -> void:
    if args.is_empty():
        EasyChat.add_system_message("Uso: /expulsar <jugador> [razon]")
        return

    var objetivo: String = args[0]
    var razon: String = "Sin razón especificada"

    if args.size() >= 2:
        razon = " ".join(args.slice(1))  # une todas las palabras restantes

    EasyChat.add_system_message("Expulsado %s — Razón: %s" % [objetivo, razon])
    # Aquí llamarías a tu lógica de juego para expulsar realmente al jugador
```

**Uso en el juego:**
```plaintext
/expulsar                        →  ▶ Uso: /expulsar <jugador> [razon]
/expulsar jugador123             →  ▶ Expulsado jugador123 — Razón: Sin razón especificada
/expulsar jugador123 hacia trampa →  ▶ Expulsado jugador123 — Razón: hacia trampa
```

---

### Escuchar un comando desde una escena diferente

Dado que `ChatCommand` es un `Resource`, **cualquier** escena que cargue el mismo `.tres` recibirá el evento `executed` cuando el comando se dispare, aunque esa escena no contenga el nodo EasyChat.

```gdscript
# res://game/jugador.gd  (el nodo EasyChat está en otra escena)
extends CharacterBody2D

var cmd_tp = preload("res://chat/comandos/cmd_teleport.tres")

func _ready() -> void:
    cmd_tp.executed.connect(_on_teletransportar)

func _on_teletransportar(args: Array) -> void:
    if args.size() < 2:
        return
    global_position = Vector2(float(args[0]), float(args[1]))
```

Esto funciona porque todos los scripts que hacen `preload` (o `load`) de la misma ruta obtienen **el mismo objeto** en memoria. La señal se emite sobre ese objeto compartido y todos los callables conectados la reciben.

---

### Prevenir conexiones duplicadas

Si tu escena puede instanciarse varias veces o `_ready` podría ejecutarse más de una vez, protege la conexión:

```gdscript
func _ready() -> void:
    if not cmd_hola.executed.is_connected(_on_hola_ejecutado):
        cmd_hola.executed.connect(_on_hola_ejecutado)
```

---

### Comportamiento del autocompletado

- Escribir `/` muestra todos los comandos disponibles.
- Escribir `/h` filtra a los comandos cuyo `command_name` o algún `alias` **empiece por** `h` (sin distinción de mayúsculas).
- Usa **↑** / **↓** para navegar por la lista; pulsa **Tab** para aplicar la sugerencia resaltada (rellena `/nombrecomando ` en el input y cierra el panel).
- Haz clic en una sugerencia para aplicarla inmediatamente.
- Pulsar **Escape** cierra primero el panel de sugerencias; pulsarlo de nuevo cierra el chat.

---

<!-- doc-shell:page slug="multiplayer" -->

## Multijugador con LinkUx

EasyChat no implementa red por sí mismo: delega en **LinkUx** cuando `multiplayer_enabled` es `true`.

### Contrato esperado con LinkUx (según el uso en código)

El nodo hace `get_node_or_null("/root/LinkUx")` y utiliza las siguientes APIs:

| API usada | Propósito |
|-----------|-----------|
| `session_started` (señal) | Registra RPCs y actualiza nombre del jugador local y visibilidad. |
| `session_closed` (señal) | Fuerza el cierre del chat y actualiza visibilidad. |
| `is_in_session() -> bool` | Determina si registrar RPCs y si al enviar hay que hacer broadcast. |
| `get_local_player_name() -> String` | Nombre del remitente local; sustituye `_local_player_name` si no está vacío. |
| `register_rpc(rpc_name: String, callable: Callable)` | Registra `"easychat_message"` y `"easychat_system"`. |
| `broadcast_rpc(rpc_name: String, args: Array, reliable: bool)` | Envía `[sender, text]` a todos los peers de forma fiable. |

### Flujo completo de envío

```plaintext
El usuario pulsa Enter en "¡Hola!"
        │
        ▼
¿Es un comando (/…)?  ──Sí──►  _execute_command()  ──►  cmd.executed.emit(args)
        │ No
        ▼
¿multiplayer_enabled y sesión activa?
        │ Sí                                    │ No
        ▼                                       ▼
broadcast_rpc("easychat_message",          _add_message(sender, text, true)
    [sender, text], true)                   (solo local)
        │
        ▼
_add_message(sender, text, true)  ← también se añade localmente
        │
        ▼
Peers remotos reciben RPC → _on_chat_rpc(_from_peer, sender, message)
        │
        ▼
_add_message(sender, message, false)  ← estilo remoto en cada peer
```

### Visibilidad del nodo con multijugador

`_update_visibility()` establece `visible = _is_enabled`. El nodo **no** se vuelve visible automáticamente al iniciarse la sesión; debes llamar a `EasyChat.enable()` tú mismo como parte de tu flujo de inicio de sesión:

```gdscript
func _on_session_started() -> void:
    EasyChat.set_player_name(mi_nombre_de_jugador)
    EasyChat.enable()
```

### Mensajes de sistema en multijugador

```gdscript
# Esto envía un mensaje de sistema a TODOS los peers conectados
EasyChat.add_system_message("¡La ronda ha comenzado!")

# add_system_message con broadcast=true (por defecto) usa el RPC easychat_system
# En los peers remotos, _on_system_rpc llama a _add_system_message(..., false) para evitar bucles
```

### Errores comunes

| Síntoma | Causa |
|---------|-------|
| El chat en red no hace nada | `multiplayer_enabled` es `true` pero no hay autoload LinkUx. Revisa la consola por el error explícito. |
| Los mensajes no llegan a todos los peers | La sesión no ha comenzado todavía (`LinkUx.is_in_session()` devuelve `false`). |

---

<!-- doc-shell:page slug="animations" -->

## Animaciones

- El panel de historial y la fila de entrada usan **tweens independientes** al abrir/cerrar.
- Si se reabre mientras la animación de cierre aún está en curso: el tween anterior recibe `kill()` y comienza uno nuevo.
- **Nuevos FADE direccionales (`FADE_UP/DOWN/LEFT/RIGHT`)**: combinan fundido + desplazamiento usando el `slide_distance` del subgrupo correspondiente.
- **FADE en la fila de entrada**: al abrir transiciona desde `alpha_input_closed` hasta opacidad completa; al cerrar vuelve a `alpha_input_closed` para `FADE` y `FADE_*`.
- **SCALE**: pivote vertical en el borde inferior del control (`pivot_offset.y` = `size.y` o `slide_dist`). Usa easing `TRANS_BACK` al aparecer y `TRANS_CUBIC` al ocultarse.
- **Tipos SLIDE**: usan propiedades `offset_*` (no `position`) para respetar el layout anclado.
- **Distancias por subgrupo**:
  - `history_slide_distance` para History Panel.
  - `input_slide_distance` para Input Row.
  - `message_slide_distance` para History messages.
  - `notification_slide_distance` para Notification.
- **Cierre forzado** (`_force_close`): mata ambos tweens inmediatamente, fija todos los valores en estado cerrado y oculta el panel de autocompletado. Se usa cuando una sesión termina o se llama a `disable()`.

---

<!-- doc-shell:page slug="notifications" -->

## Notificaciones flotantes

Las notificaciones aparecen en la parte inferior de la pantalla cuando el panel del chat está **cerrado** y llega un nuevo mensaje (de jugador o de sistema). También aparecen cuando `close_on_send` es `true` y el usuario acaba de enviar un mensaje.

- Hasta `max_notifications` entradas pueden apilarse en pantalla simultáneamente. La más antigua se elimina inmediatamente al superar el límite.
- Cada entrada usa `notification_anim_type` y `notification_anim_duration` para su animación de aparición.
- La salida siempre hace fade del alfa hasta `0` en `0.4 s` independientemente de `notification_anim_type`, luego el nodo es liberado.
- `notification_duration` controla cuántos segundos permanece la notificación a opacidad completa entre aparecer y hacer fade-out.

---

<!-- doc-shell:page slug="sounds" -->

## Sonidos

Asigna recursos `AudioStream` a las propiedades de sonido en `EasyChatConfig`. Las cinco son opcionales (`null` = silencio).

| Propiedad | Cuándo se reproduce |
|-----------|---------------------|
| `sound_message_received` | Llega un mensaje de un jugador no local. |
| `sound_system_message` | Se añade un mensaje de sistema. |
| `sound_message_sent` | El jugador local envía un mensaje. |
| `sound_chat_opened` | Se abre el chat. |
| `sound_chat_closed` | Se cierra el chat. |

Todos los sonidos comparten un único nodo `AudioStreamPlayer` hijo. Si se dispara un sonido nuevo antes de que el anterior termine, el anterior es **interrumpido**.

---

<!-- doc-shell:page slug="editor-preview" -->

## Vista previa en el editor

El script del nodo lleva `@tool`, lo que permite una vista previa en tiempo real en el editor con una sección **Preview** completa:

- Asignar o modificar el recurso **config** actualiza la vista previa inmediatamente vía la señal `config.changed`.
- `_rebuild()` libera todos los hijos de UI y los reconstruye desde cero, restaurando el estado base de previsualización.
- `_ready()` en el editor solo construye la vista previa; **no** registra el singleton, configura el multijugador ni conecta señales de juego.
- Cambiar propiedades del config (colores, layout, animaciones, etc.) se refleja en el viewport mientras editas.

### Botones de la sección Preview y para qué sirven

#### Rebuild Preview

- **`Rebuild Preview`**: reconstruye toda la UI y limpia estados residuales de animaciones de prueba.

#### Visibility

- **`preview_history`**: muestra/oculta el panel de historial.
- **`preview_input`**: muestra/oculta la fila de entrada.
- **`preview_autocomplete`**: muestra/oculta el panel de autocompletado.
- **`preview_notification`**: muestra/oculta el contenedor de notificaciones.

#### Show-Hide Animations

- **`History Panel — Show`**: reproduce la animación de apertura del historial con los valores actuales de `Animations`.
- **`History Panel — Hide`**: reproduce la animación de cierre del historial.
- **`Input Row — Show`**: reproduce la animación de apertura de la fila de entrada.
- **`Input Row — Hide`**: reproduce la animación de cierre de la fila de entrada.

#### Messages

- **`Local Message`**: agrega un mensaje de ejemplo local al historial.
- **`Remote Message`**: agrega un mensaje de ejemplo remoto al historial.
- **`System Message`**: agrega un mensaje de sistema de ejemplo.
- **`Clear History`**: limpia todas las líneas del historial.

#### Notifications

- **`Message Notification`**: crea una notificación de ejemplo tipo mensaje.
- **`System Notification`**: crea una notificación de ejemplo tipo sistema.

#### Commands

- **`Show Commands`**: rellena el autocompletado con todos los comandos de `config.commands` y muestra el panel para inspección visual.

---

<!-- doc-shell:page slug="limitations" -->

## Limitaciones y convenciones

1. **Una instancia activa por escena** para el singleton: un segundo nodo EasyChat genera **warning** y el singleton continúa delegando en el primero. Ambos nodos siguen renderizando de forma independiente.
2. **Nombres de RPC fijos en código**: `"easychat_message"` y `"easychat_system"` (no deben colisionar con otros sistemas en LinkUx).
3. **`usage` en `ChatCommand`** no se muestra en la UI de autocompletado del addon. Muéstralo tú mismo en un handler de `/ayuda`.
4. **Los comandos no se sincronizan por red**: solo se hace broadcast de mensajes de texto plano. Cada cliente ejecuta `/cmd` localmente — solo el cliente que escribió el comando dispara `executed`.
5. **`EasyChat.is_enabled()`** lee directamente el campo interno `_is_enabled` del nodo activo. Mantenlo coherente si subclasificas el nodo.
6. **Sin BBCode ni rich text** en los mensajes; el historial usa nodos `Label` simples. Para habilitar texto enriquecido, cambia `_add_message` y `_add_system_message` para usar `RichTextLabel`.
7. El nodo raíz **no** añade una capa de bloqueo de input; el diseño asume que abrir el chat es una acción explícita y visible (cursor visible, inputs liberados).

---

<!-- doc-shell:page slug="scaling" -->

## Escalar el chat en producción

### Rendimiento y memoria

- Cada mensaje es un `Label` hijo; valores muy altos de `max_messages` aumentan el trabajo de layout en el `VBoxContainer`. Mantenlo razonable para la plataforma objetivo (p. ej. 50–100 para móvil).
- Para **tráfico muy alto** (p. ej. MMO), considera **virtualizar** la lista de mensajes (reutilizar un conjunto fijo de controles de fila) — esto requiere hacer un fork o extender `easychat_node.gd`.
- El autocompletado construye filas de UI en cada pulsación de tecla mientras el usuario escribe un prefijo de comando; cientos de comandos funcionan bien, pero si tienes muchos comandos con prefijos cortos podrías querer hacer debounce o cachear resultados.

### Multijugador y moderación

- El addon **no** incluye rate limiting, anti-spam ni filtrado de contenido. Implementa estas capas en LinkUx, en un servidor autoritativo o mediante la señal `message_received`.
- Para **historial persistente** o **salas de chat**, centraliza la lógica fuera del nodo y mueve la UI a través de `EasyChat.add_message` / `add_system_message`.

### Contenido y localización

- `message_format`, `system_message_prefix` y textos de comando viven en el recurso: duplica archivos `.tres` por idioma o asígnalos en tiempo de carga para soportar localización.
- **BBCode** no está habilitado en los labels actuales; reemplázalos con `RichTextLabel` en una subclase para soportar negrita, colores, enlaces, etc.

### Múltiples contextos de chat

El singleton asume **un** nodo activo. Para HUDs diferentes (lobby vs. partida), desregistra el anterior al cambiar de escena, o evita el singleton global y usa referencias directas al nodo.

---

<!-- doc-shell:page slug="modifying" -->

## Modificar el addon internamente

### Puntos de extensión recomendados

- **Subclase del nodo**: extiende `easychat_node.gd` y sobreescribe `_add_message`, `_execute_command`, `_show_notification`, etc. sin tocar los archivos originales.
- **Añadir propiedades al config**: extiende `EasyChatConfig` con nuevos `@export` y léelos en tu subclase. El nodo base no fallará — simplemente no conocerá las nuevas propiedades.
- **Cambiar el nombre del autoload LinkUx**: si tu autoload no es `"LinkUx"`, edita `get_node_or_null("/root/LinkUx")` en `_setup_multiplayer` y actualiza los nombres de señales esperados.

### Constantes y nombres de RPC

```gdscript
# En easychat_node.gd
const _RPC_NAME   := "easychat_message"
const _RPC_SYSTEM := "easychat_system"
```

Cámbialos si colisionan con otros sistemas. Mantén las llamadas a `register_rpc` y `broadcast_rpc` sincronizadas.

### Layout de notificación

`_apply_layout()` calcula los offsets de notificación relativos a `input_top` con pequeñas constantes fijas. Ajústalas para subir las notificaciones, anclarlas al panel de historial o colocarlas en otro lado de la pantalla.

### Comandos duplicados en el autocompletado

`_update_autocomplete` puede añadir el mismo `ChatCommand` dos veces si tanto su `command_name` como algún `alias` coinciden con el prefijo escrito. Sobreescribe `_update_autocomplete` en una subclase para deduplicar.

### Plugin del editor

Si cambias las rutas de `preload` en `plugin.gd` (p. ej. tras mover la carpeta del addon), actualiza todas las referencias `res://addons/easychat/…` correspondientes.

---

<!-- doc-shell:page slug="troubleshooting" -->

## Solución de problemas

| Síntoma | Causa probable y solución |
|---------|--------------------------|
| Las llamadas a `EasyChat.*` no hacen nada | No hay nodo **EasyChat** en la escena actual, o `_register` nunca se ejecutó (orden de carga, nodo deshabilitado antes de `_ready`). Comprueba que el nodo esté en el árbol y el plugin activado. |
| Advertencia de dos instancias en la consola | Dos nodos EasyChat en la misma escena. Deja solo uno, o accede a cada uno independientemente sin usar el singleton. |
| El chat en red no envía | LinkUx no instalado o no está en `/root/LinkUx`; sesión no iniciada aún; `multiplayer_enabled` es `false`. Revisa la consola por el mensaje de error explícito. |
| La tecla de abrir (`T`) no hace nada | Otro control de UI está consumiendo el evento primero (`_unhandled_key_input` se procesa al final). También verifica que `_is_enabled` sea `true` — llama a `EasyChat.enable()` desde código. |
| Comando no encontrado / "Unknown command" | Typo en `command_name`, o el comando no está en `config.commands` del recurso **realmente asignado** al nodo (puede estar usando el config por defecto, no tu `.tres`). |
| La señal `executed` no se dispara | El recurso de comando conectado en código puede no ser el mismo objeto que el del config. Asegúrate de hacer `preload` de exactamente la misma ruta `.tres`, o itera por `chat.config.commands` para obtener la referencia en vivo. |
| Sin sonido | El stream es `null` en el recurso, o el formato de audio no es compatible con `AudioStreamPlayer`. |
| El autocompletado no aparece | El comando está en el config pero el prefijo escrito no coincide con `command_name` ni con ningún `alias`. Recuerda que la coincidencia usa `begins_with`, no contiene. |
| El chat está invisible tras `enable()` | `visible` del nodo se establece a `_is_enabled`. Si algún padre está oculto, el nodo también lo estará. Comprueba la cadena de visibilidad de los nodos padre. |

---

<!-- doc-shell:page slug="credits" -->

## Créditos

- **EasyChat** — IUX Games, Isaackiux (versión **2.0.0**).

---

*Documentación creada a detalle con cariño para los desarrolladores.♥️*
