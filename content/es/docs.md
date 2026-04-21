<!-- doc-shell:page slug="overview" -->

# EasyChat

[![Godot 4](https://img.shields.io/badge/Godot-4.x-478cbf?logo=godotengine&logoColor=white)](https://godotengine.org/)
[![Version](https://img.shields.io/badge/version-1.1.0-5aafff)](./plugin.cfg)

**EasyChat** es un addon para **Godot 4** que añade un nodo de interfaz reutilizable para **chat en juego** y **consola de comandos** con autocompletado. Funciona en **modo offline** (un solo jugador o sin sesión de red) y en **multijugador en tiempo real** cuando se combina con el addon **LinkUx**, que abstrae backends LAN u online y mantiene el mismo flujo lógico independientemente del backend activo.


Este documento describe **todas** las piezas del addon, sus propiedades exportadas, la API del singleton, el comportamiento en runtime y orientación para **escalar** el sistema o **modificarlo** por dentro.

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
- **Singleton `EasyChat`** registrado automáticamente al activar el plugin; API global para abrir/cerrar, mensajes y nombre de jugador.
- **Recurso `EasyChatConfig`**: apariencia (paneles, bordes, radios, colores, fuentes), comportamiento (cierre al enviar, límites de historial, notificaciones), animaciones, layout, sonidos y lista de comandos.
- **Recurso `ChatCommand`**: nombre, alias, descripción, uso documental y señal `executed(args)`.
- **Historial** con límite configurable; los mensajes más antiguos se eliminan al superar el máximo.
- **Chat cerrado** sin bloquear el juego: el nodo raíz usa `mouse_filter = IGNORE` y solo al abrir el chat se fuerza el cursor visible y se liberan acciones de `InputMap`.
- **Autocompletado** de comandos al escribir `/`, con navegación por teclado y clic.
- **Notificación** breve cuando llega un mensaje con el panel cerrado (o al enviar con `close_on_send`), con cantidad simultánea y animación de entrada configurables.
- **Multijugador opcional** vía **LinkUx**: registro de RPC, broadcast al enviar, nombre local desde `LinkUx.get_local_player_name()`, visibilidad ligada a sesión y cierre forzado al cerrar sesión.

---

<!-- doc-shell:page slug="requirements" -->

## Requisitos y dependencias

| Componente | Obligatorio | Notas |
|------------|-------------|--------|
| **Godot 4.x** | Sí | El código usa sintaxis y APIs de Godot 4 (por ejemplo `@export`, señales tipadas, `Tween`, etc.). |
| **LinkUx** | No | Solo necesario si `multiplayer_enabled` está activo en el nodo y se desea chat en red en tiempo real. Debe existir el autoload **`/root/LinkUx`**. |

Ruta esperada del addon en el proyecto: `res://addons/easychat/` (coherente con `plugin.gd` y rutas `preload`).

---

<!-- doc-shell:page slug="installation" -->

## Instalación

1. Copia la carpeta del addon dentro de `res://addons/easychat/`.
2. Abre el proyecto en Godot 4.
3. Ve a **Project → Project Settings → Plugins** y activa **EasyChat**.
4. Al activar el plugin:
   - Se añade el autoload **`EasyChat`** apuntando a `res://addons/easychat/easychat.gd`.
   - Se registra el tipo de nodo personalizado **EasyChat** en el diálogo de crear nodos.
5. (Opcional para multijugador) Instala y configura **LinkUx** como autoload con el nombre que exponga ese addon (el código de EasyChat busca `/root/LinkUx`).
6. Añade un nodo **EasyChat** a la escena donde quieras el chat (típicamente un `CanvasLayer` o la raíz UI de la partida).

---

<!-- doc-shell:page slug="architecture" -->

## Arquitectura del addon

| Archivo | Rol |
|---------|-----|
| `plugin.cfg` | Metadatos del plugin (nombre, versión, script del plugin). |
| `plugin.gd` | `EditorPlugin`: al habilitar/deshabilitar gestiona el autoload; al entrar/salir del árbol del editor registra el tipo **EasyChat**. |
| `easychat.gd` | Singleton **EasyChat**: delega en la instancia activa del nodo. |
| `easychat_node.gd` | Nodo **EasyChat**: UI, input, comandos, animaciones, integración LinkUx. |
| `easychat_config.gd` | `class_name EasyChatConfig` — recurso de configuración. |
| `chat_command.gd` | `class_name ChatCommand` — recurso por comando. |
| `icon.svg` | Icono del nodo y del script en el editor. |

**Flujo de registro:** en `_ready()` del nodo (solo en juego, no en el editor), el nodo llama a `EasyChat._register(self)` si existe `/root/EasyChat`. Al salir del árbol, llama a `_unregister`. Solo puede haber **una** instancia “activa” por escena a la que el singleton delega; una segunda emite advertencia y se ignora.

**Grupo:** el nodo se añade al grupo `"easychat"` (útil para búsquedas o herramientas).

---

<!-- doc-shell:page slug="first-use" -->

## Primer uso paso a paso

### Solo offline / sin LinkUx

1. Activa el plugin **EasyChat** (ver [Instalación](#instalación)).
2. En tu escena de juego (por ejemplo `main.tscn`), añade un nodo **EasyChat** como hijo de un `CanvasLayer` o contenedor a pantalla completa.
3. Deja **`multiplayer_enabled`** en `false` (valor por defecto).
4. Ejecuta la escena: pulsa la tecla **Abrir chat** (por defecto `T`) para abrir; **Escape** para cerrar (o cerrar la lista de sugerencias si está abierta).
5. Escribe texto y pulsa **Enter** o el botón de enviar (si está visible) para enviar un mensaje de chat.
6. Para comandos, escribe `/nombrecomando` seguido de argumentos separados por espacio.

### Con nombre de jugador local (offline)

- En código, tras tener el nodo en escena: `EasyChat.set_player_name("TuNick")`.
- Ese nombre es el que sustituye `{sender}` en los mensajes que envías en modo no multijugador (o cuando LinkUx no actualiza el nombre).

### Con multijugador (LinkUx)

1. Instala y registra **LinkUx** como autoload (`/root/LinkUx` debe resolverse).
2. En el nodo **EasyChat**, activa **`multiplayer_enabled`**.
3. Asegúrate de iniciar sesión con LinkUx según la documentación de ese addon; EasyChat registrará el RPC cuando la sesión esté activa y usará `get_local_player_name()` para el remitente.
4. Los mensajes de texto (no comandos) se **difunden** por red; el remitente local también ve su mensaje en el historial.

### Recurso de configuración compartida

1. En el FileSystem, crea un recurso **EasyChatConfig** (`.tres`) o duplica uno existente.
2. Ajusta apariencia, sonidos, comandos, etc.
3. Asigna ese recurso al campo **`config`** del nodo **EasyChat** en el inspector.
4. Reutiliza el mismo `.tres` en otras escenas para un estilo coherente.

### Definir comandos

1. Crea uno o más recursos **ChatCommand** (`.tres`).
2. Rellena **`command_name`**, opcionalmente **`aliases`**, **`description`** (visible en autocompletado) y **`usage`** (referencia para documentación; la UI del autocompletado muestra la descripción, no el uso).
3. Añade esos recursos al array **`commands`** dentro de tu **EasyChatConfig** (o del config por defecto si no usas `.tres` externo).
4. En tu lógica de juego, conecta `command.executed.connect(_on_my_command)` para cada recurso (o conecta en un script que cargue la misma referencia al `.tres`).

---

<!-- doc-shell:page slug="node-easychat" -->

## Nodo `EasyChat` (Control)

El nodo es un `Control` a **pantalla completa** (`PRESET_FULL_RECT`): ancla el layout del chat en la parte inferior de la vista. En `_ready()` del juego crea toda la UI por código (historial, scroll, lista de mensajes, panel de autocompletado, notificación, fila de entrada, reproductor de audio).

### Propiedades exportadas (inspector)

#### `config` — `EasyChatConfig` (opcional)

- Recurso con **toda** la personalización visual y de comportamiento.
- Si está vacío en runtime, el nodo crea `EasyChatConfig.new()` con valores por defecto.
- En **editor**, al asignar o cambiar el recurso, se reconecta la señal `changed` del recurso para refrescar la vista previa.

#### Grupo **Multiplayer**

| Propiedad | Tipo | Por defecto | Descripción |
|-----------|------|-------------|-------------|
| `multiplayer_enabled` | `bool` | `false` | Si es `true`, el chat usa **LinkUx** para RPC y nombre de jugador. Si LinkUx no está disponible, se registra un **error** en consola y el comportamiento de red no está activo. |

#### Grupo **Controls**

| Propiedad | Tipo | Por defecto | Descripción |
|-----------|------|-------------|-------------|
| `open_key` | `Key` | `KEY_T` | Tecla para **abrir** el chat (procesada en `_unhandled_key_input` cuando el chat está cerrado). Sustituye el token `{key}` en el placeholder del campo de texto. |
| `close_key` | `Key` | `KEY_ESCAPE` | Con el chat **abierto**: cierra el panel de sugerencias si está visible; si no, **cierra** el chat. Procesada en `_input` para poder consumir el evento antes que el resto. |

### API pública del nodo (runtime)

Métodos pensados para uso directo en scripts que tengan referencia al nodo:

| Método | Comportamiento |
|--------|----------------|
| `is_open() -> bool` | `true` si el jugador tiene el chat abierto (panel de historial/animación activa). |
| `enable()` | Marca el chat como habilitado y actualiza visibilidad (`visible = true` según estado interno). |
| `disable()` | Si estaba abierto, fuerza cierre; limpia historial; deshabilita y oculta el nodo. |
| `clear_history()` | Elimina todos los hijos de la lista de mensajes. |
| `set_player_name(name: String)` | Asigna el nombre del jugador local usado como remitente cuando corresponde. |

**Nota:** La mayor parte del juego consumirá la API del **singleton** `EasyChat`, que delega en esta instancia si está registrada.

---

<!-- doc-shell:page slug="config-resource" -->

## Recurso `EasyChatConfig`

`class_name EasyChatConfig` extiende `Resource`. Agrupa todas las opciones del inspector en bloques `@export_group` / `@export_subgroup`.

### Enumeración `AnimType`

Usada para animar el **panel de historial** y la **fila de entrada**.

| Valor | Significado |
|-------|-------------|
| `NONE` | Mostrar/ocultar al instante (sin transición). |
| `FADE` | Fundido con opacidad (`modulate.a`). Para la fila de entrada cerrada, puede quedar una opacidad residual (`alpha_input_closed`). |
| `SLIDE_UP` | Entra desde abajo (offset Y positivo); al cerrar sale hacia abajo. |
| `SLIDE_DOWN` | Entra desde arriba; al cerrar sale hacia arriba. |
| `SLIDE_LEFT` | Entra desde la izquierda; al cerrar sale a la izquierda. |
| `SLIDE_RIGHT` | Entra desde la derecha; al cerrar sale a la derecha. |
| `SCALE` | Escala vertical desde casi cero hasta 1 con pivote en el borde inferior del control; easing `BACK` al mostrar, `CUBIC` al ocultar. |

Distancias de slide y escala usan `panel_height` para el historial e `input_height` para la fila de entrada.

### Grupo **Appearance**

#### Subgrupo **History** (panel de mensajes)

| Propiedad | Tipo | Por defecto (resumen) | Uso |
|-----------|------|------------------------|-----|
| `history_bg_color` | `Color` | Oscuro semitransparente | Fondo del panel. |
| `history_corner_tl`, `history_corner_tr`, `history_corner_bl`, `history_corner_br` | `int` | 6, 6, 0, 0 | Radio de esquinas en píxeles. |
| `history_border_*` | `int` | 0 | Grosor de borde por lado; 0 lo desactiva. |
| `history_border_color` | `Color` | Gris semitransparente | Color del borde si algún grosor > 0. |

#### Subgrupo **Autocomplete**

| Propiedad | Tipo | Uso |
|-----------|------|-----|
| `autocomplete_bg_color` | `Color` | Fondo del panel de sugerencias. |
| `autocomplete_selected_color` | `Color` | Fondo de la fila resaltada (teclado o hover). |
| `autocomplete_command_color` | `Color` | Texto del nombre `/comando`. |
| `autocomplete_desc_color` | `Color` | Texto de la descripción. |
| `autocomplete_font_size` | `int` | Tamaño de fuente en la lista. |
| `autocomplete_font` | `Font` | Fuente personalizada opcional para comando y descripción. |
| `autocomplete_corner_*` | `int` | Radios de esquina del panel. |
| `autocomplete_border_*` | `int` | Bordes por lado. |
| `autocomplete_border_color` | `Color` | Color del borde. |

#### Subgrupo **Input** (`LineEdit`)

| Propiedad | Tipo | Uso |
|-----------|------|-----|
| `input_bg_color`, `input_focus_color` | `Color` | Fondo normal y con foco. |
| `input_border_color`, `input_focus_border_color` | `Color` | Borde normal y con foco. |
| `input_corner_*` | `int` | Radios (por defecto inferiores redondeados). |
| `input_border_*` | `int` | Grosor por lado. |
| `input_font_size` | `int` | Tamaño del texto escrito. |
| `input_font` | `Font` | Fuente personalizada opcional para texto y placeholder. |
| `input_caret_color` | `Color` | Color del cursor. |
| `input_placeholder_color` | `Color` | Placeholder. |
| `input_placeholder_text` | `String` | Texto con token `{key}` reemplazado por el nombre de tecla de `open_key`. |

#### Subgrupo **Send Button**

| Propiedad | Tipo | Uso |
|-----------|------|-----|
| `send_button_text` | `String` | Etiqueta (por defecto símbolo de retorno). |
| `send_button_bg_color`, `send_button_hover_color` | `Color` | Estados normal y hover/pulsado. |
| `send_button_text_color` | `Color` | Color del texto. |
| `send_button_font_size` | `int` | Tamaño de fuente. |
| `send_button_font` | `Font` | Fuente personalizada opcional para la etiqueta del botón. |
| `send_corner_*` | `int` | Radios del botón. |
| `send_border_*` | `int` | Bordes. |
| `send_border_color`, `send_border_hover_color` | `Color` | Borde normal y hover/pulsado. |

#### Subgrupo **Messages** (historial)

| Propiedad | Tipo | Uso |
|-----------|------|-----|
| `message_font_size` | `int` | Tamaño para mensajes de jugador y sistema. |
| `message_font` | `Font` | Fuente personalizada opcional para mensajes del historial. |
| `message_format` | `String` | Plantilla con `{sender}` y `{message}`. |
| `local_message_color` | `Color` | Mensajes del jugador local (`is_local == true`). |
| `remote_message_color` | `Color` | Mensajes de otros o línea recibida por red. |
| `system_message_color` | `Color` | Mensajes de sistema. |
| `system_message_prefix` | `String` | Prefijo ante el texto (por defecto `▶ `). |

#### Subgrupo **Notification**

| Propiedad | Tipo | Uso |
|-----------|------|-----|
| `notification_color` | `Color` | Color del texto flotante. |
| `notification_bg_color` | `Color` | Fondo del panel (alfa 0 lo hace invisible). |
| `notification_corner_*` | `int` | Radios. |
| `notification_border_*` | `int` | Bordes. |
| `notification_border_color` | `Color` | Color del borde. |
| `notification_font_size` | `int` | Tamaño del texto. |
| `notification_font` | `Font` | Fuente personalizada opcional para el texto flotante. |

### Grupo **Behavior**

| Propiedad | Tipo | Por defecto | Descripción |
|-----------|------|-------------|-------------|
| `show_send_button` | `bool` | `true` | Muestra u oculta el botón de enviar. |
| `close_on_send` | `bool` | `false` | Tras enviar mensaje **o** ejecutar comando, cierra el chat; el último mensaje enviado puede mostrarse en la notificación. |
| `alpha_input_closed` | `float` | `0.35` | Opacidad de la fila de entrada con chat cerrado si la animación es `FADE` o `NONE`. |
| `notification_alpha` | `float` | `0.75` | Opacidad máxima del panel de notificación durante el fade in. |
| `notification_duration` | `float` | `3.0` | Segundos visibles antes del fade out. |
| `max_messages` | `int` | `100` | Máximo de líneas en historial; al superarse se elimina el mensaje más antiguo. |
| `max_suggestions_visible` | `int` | `6` | Máximo de filas de autocompletado visibles (el resto hace scroll en el panel). |
| `max_notifications` | `int` | `3` | Máximo de notificaciones flotantes simultáneas; al superarse se elimina primero la más antigua. |

### Grupo **Animations**

#### Subgrupo **History Panel**

| Propiedad | Tipo | Por defecto |
|-----------|------|-------------|
| `history_anim_type` | `AnimType` | `FADE` |
| `history_anim_duration` | `float` | `0.18` s |

#### Subgrupo **Input Row**

| Propiedad | Tipo | Por defecto |
|-----------|------|-------------|
| `input_anim_type` | `AnimType` | `FADE` |
| `input_anim_duration` | `float` | `0.18` s |

Para tipos **SLIDE** y **SCALE**, con el chat cerrado la fila de entrada queda **totalmente oculta** (no solo atenuada).

#### Subgrupo **Notification**

| Propiedad | Tipo | Por defecto |
|-----------|------|-------------|
| `notification_anim_type` | `AnimType` | `FADE` |
| `notification_anim_duration` | `float` | `0.15` s |

### Grupo **Layout**

| Propiedad | Tipo | Por defecto | Descripción |
|-----------|------|-------------|-------------|
| `panel_width` | `float` | `415` | Ancho del bloque de chat (historial + entrada alineados). |
| `panel_height` | `float` | `206` | Alto del área de historial. |
| `input_height` | `float` | `42` | Alto de la fila de entrada (y referencia de slide/scale para esa fila). |
| `send_button_width` | `float` | `52` | Ancho mínimo del botón enviar. |
| `panel_margin_left` | `float` | `10` | Margen izquierdo respecto al viewport. |
| `panel_margin_bottom` | `float` | `10` | Margen inferior. |
| `suggestion_item_height` | `float` | `28` | Alto de cada fila en autocompletado. |

Los offsets del panel de **notificación** en código están fijados en parte con constantes (por ejemplo separación respecto a la fila de entrada); si necesitas más control, ver [Modificar el addon internamente](#modificar-el-addon-internamente).

### Grupo **Sounds**

Todos son `AudioStream` opcionales (`null` = silencio).

| Propiedad | Cuándo se reproduce |
|-----------|---------------------|
| `sound_message_received` | Llega un mensaje de otro jugador (no local). |
| `sound_system_message` | Se añade un mensaje de sistema. |
| `sound_message_sent` | El jugador local envía un mensaje de chat. |
| `sound_chat_opened` | Se abre el chat. |
| `sound_chat_closed` | Se cierra el chat. |

La reproducción usa un único `AudioStreamPlayer` hijo del nodo (un sonido puede interrumpir al anterior).

### Grupo **Commands**

| Propiedad | Tipo | Descripción |
|-----------|------|-------------|
| `commands` | `Array[ChatCommand]` | Lista de comandos disponibles para `/` y autocompletado. |

---

<!-- doc-shell:page slug="chatcommand-resource" -->

## Recurso `ChatCommand`

`class_name ChatCommand` extiende `Resource`.

| Miembro | Tipo | Descripción |
|---------|------|-------------|
| `executed` | `signal executed(args: Array)` | Emitida al ejecutar el comando con la lista de argumentos (tokens tras el nombre). |
| `command_name` | `String` | Nombre principal tras `/` (comparación **sin distinguir mayúsculas**). |
| `aliases` | `PackedStringArray` | Nombres alternativos igualmente comparados en minúsculas. |
| `description` | `String` | Texto en el panel de autocompletado junto al nombre del comando. |
| `usage` | `String` | Campo exportado para documentar uso en tus propias pantallas de ayuda; **el addon no lo muestra** en la UI de sugerencias (solo `description`). |

**Parsing:** el texto `/cmd arg1 arg2` se trocea por espacios; el primer token (sin `/`) es el nombre del comando; el resto se pasa como `args` al emitir `executed`.

---

<!-- doc-shell:page slug="singleton" -->

## Singleton global `EasyChat`

Registrado por `plugin.gd` como autoload. Sirve de fachada cuando no tienes referencia directa al nodo.

| Método | Comportamiento |
|--------|----------------|
| `enable()` | Igual que el nodo: habilita y muestra según lógica interna. |
| `disable()` | Cierra, limpia historial, deshabilita y oculta. |
| `is_open() -> bool` | Indica si hay nodo registrado y está abierto. |
| `is_enabled() -> bool` | Indica si hay nodo y `_is_enabled` es verdadero (el código del singleton accede al nodo activo). |
| `clear_history()` | Vacía el historial del nodo activo. |
| `add_message(sender, text)` | Añade mensaje como **remoto** (color `remote_message_color`), sin pasar por input local. |
| `add_system_message(text)` | Añade mensaje de sistema con prefijo y color de sistema. |
| `set_player_name(name)` | Delegado al nodo (nombre local offline / base). |

Si no hay instancia válida registrada, las llamadas no hacen nada (salvo `is_open` / `is_enabled` que devuelven `false`).

---

<!-- doc-shell:page slug="signals" -->

## Señales

### En el nodo `EasyChat` y reexpuestas en el singleton

| Señal | Parámetros | Cuándo |
|-------|------------|--------|
| `chat_opened` | — | Tras iniciar apertura (animaciones, sonido, foco diferido). |
| `chat_closed` | — | Tras cerrar normalmente o cierre forzado (sesión cerrada, `disable`, etc.). |
| `message_received` | `sender: String`, `message: String` | Por **cada** mensaje añadido al historial vía `_add_message` (local o remoto), **después** de actualizar UI y sonido. No se emite para mensajes solo de sistema (`_add_system_message` no conecta a esta señal). |

Conecta desde cualquier script:

```gdscript
EasyChat.message_received.connect(_on_chat_message)

func _on_chat_message(sender: String, message: String) -> void:
    pass
```

---

<!-- doc-shell:page slug="keyboard" -->

## Entrada de teclado y foco

- **Abrir:** `open_key` en `_unhandled_key_input` solo si el chat está cerrado y habilitado.
- **Cerrar / sugerencias:** `close_key` en `_input` cuando está abierto (primero cierra autocompletado si aplica).
- **Con sugerencias visibles:** **Flecha arriba/abajo** navega, **Tab** aplica la sugerencia seleccionada (o la primera si no había selección).
- Al **abrir** el chat: se guarda `Input.mouse_mode`, se fuerza `MOUSE_MODE_VISIBLE`, se llama `Input.action_release` para **todas** las acciones del `InputMap` (evita teclas “pegadas”).
- Al **cerrar**: se restaura el modo de ratón anterior.
- El botón enviar tiene `focus_mode = FOCUS_NONE` para mantener el foco en el `LineEdit`.
- La raíz del nodo tiene `mouse_filter = IGNORE` para no interceptar clics del juego cuando el overlay no debe capturarlos; los controles hijos gestionan su propio filtro donde aplica.

---

<!-- doc-shell:page slug="messages" -->

## Mensajes, formato y colores

- **Formato:** `message_format` con `{sender}` y `{message}`.
- **Local vs remoto:** los mensajes que envías tú se pintan con `local_message_color`; los que llegan de red o los inyectados con `add_message` desde código se tratan como **remotos** en cuanto a color (el singleton `add_message` llama a `_add_message(..., false)`).
- **Límite:** al alcanzar `max_messages`, se hace `queue_free` del hijo más antiguo de la lista.
- **Scroll:** al añadir mensaje con el chat abierto, se desplaza al final en el frame siguiente.
- **Chat cerrado:** si llega un mensaje (o sistema), se muestra **notificación** además de añadir al historial.

---

<!-- doc-shell:page slug="commands" -->

## Comandos (`/`) y autocompletado

- Cualquier línea que **empiece por** `/` se interpreta como comando; no se envía como mensaje de chat de jugador.
- Si no coincide ningún `ChatCommand`, se muestra un mensaje de sistema: `Unknown command: /nombre`.
- Si `close_on_send` es `true`, tras un comando se **cierra** el chat (igual que tras un mensaje normal).
- **Autocompletado:** al escribir `/` y texto sin espacio en el primer token, se filtran comandos cuyo `command_name` o algún `alias` **empieza por** el prefijo en minúsculas.
- Un mismo comando puede aparecer **más de una vez** en la lista filtrada si coincide por nombre y por alias (comportamiento actual del bucle).
- Panel de sugerencias: altura basada en `mini(coincidencias, max_suggestions_visible) * suggestion_item_height + 6`.
- Clic en fila o **Tab** completa `/nombrecomando ` en el campo y cierra el panel.

---

<!-- doc-shell:page slug="multiplayer" -->

## Multijugador con LinkUx

EasyChat no implementa red por sí mismo: delega en **LinkUx** cuando `multiplayer_enabled` es `true`.

### Contrato esperado con LinkUx (según el uso en código)

El nodo obtiene `get_node_or_null("/root/LinkUx")` y utiliza:

| API usada | Propósito |
|-----------|-----------|
| `session_started` (señal) | Registrar RPC y actualizar nombre local y visibilidad. |
| `session_closed` (señal) | Cerrar chat de golpe y actualizar visibilidad. |
| `is_in_session() -> bool` | Saber si debe registrarse el RPC y si al enviar hay que hacer broadcast. |
| `get_local_player_name() -> String` | Nombre del remitente local; si la cadena no está vacía, sustituye `_local_player_name`. |
| `register_rpc(rpc_name: String, callable: Callable)` | Registra el manejador del chat (nombre interno `easychat_message`). |
| `broadcast_rpc(rpc_name: String, args: Array, reliable: bool)` | Envía `[sender, text]` a los peers; en código se pasa `true` como tercer argumento (emisión fiable). |

### Flujo de envío

- Mensaje **sin** `/`: si hay sesión y LinkUx válido, `broadcast_rpc("easychat_message", [sender, text], true)` y además `_add_message(sender, text, true)` localmente.
- Mensaje **remoto:** el callable registrado recibe `_on_chat_rpc(_from_peer, sender, message)` y añade el mensaje como no local.

### Visibilidad del nodo con multijugador

- `_update_visibility()` asigna `visible = _is_enabled` (no fuerza visible solo por estar en sesión; tú debes llamar `enable()` o tener el nodo habilitado según tu flujo).
- Si la sesión se cierra mientras el chat está abierto, se llama `_force_close()` (sin animaciones largas: resetea paneles y emite `chat_closed`).

### Errores comunes

- `multiplayer_enabled` sin autoload LinkUx: **error** en consola y sin sincronización de mensajes.

---

<!-- doc-shell:page slug="animations" -->

## Animaciones

- Historial y fila de entrada tienen **tweens independientes** al abrir/cerrar; al reabrir se hace `kill()` del tween anterior si existe.
- **FADE** en la entrada: al abrir parte de `alpha_input_closed` (o 0 si no aplica); al cerrar vuelve a `alpha_input_closed` si el tipo es FADE, o a 0 si otro tipo.
- **SCALE** en historial/entrada: pivote vertical en el borde inferior del control (`pivot_offset` calculado con `size.y` o `slide_dist`).
- Cierre **forzado** (`_force_close`): mata tweens, resetea posición/escala/opacidad y estados de autocompletado.

---

<!-- doc-shell:page slug="notifications" -->

## Notificaciones flotantes

- `_show_notification` permite acumular varias entradas en pantalla hasta `max_notifications`.
- Cada nueva entrada usa `notification_anim_type` y `notification_anim_duration` para su aparición (`FADE`, `SLIDE_*` o `SCALE`), y permanece visible durante `notification_duration`.
- La salida sigue realizándose con fundido de opacidad hasta 0 antes de liberar el nodo.
- Se usa cuando el chat está **cerrado** y llega un mensaje/sistema, y cuando `close_on_send` muestra el último mensaje enviado al cerrar.

---

<!-- doc-shell:page slug="sounds" -->

## Sonidos

Ver [Grupo **Sounds**](#config-resource/grupo-sounds) en `EasyChatConfig`. Si asignas recursos largos, ten en cuenta que hay un solo reproductor.

---

<!-- doc-shell:page slug="editor-preview" -->

## Vista previa en el editor

El script del nodo lleva `@tool`. En el editor:

- Si hay `config`, se conecta `config.changed` para refrescar layout/tema/propiedades.
- `_rebuild()` libera hijos, recrea la UI y deja el chat en estado **abierto** para inspeccionar paneles.
- `_ready()` en editor no registra el singleton ni multiplayer; solo construye la vista previa.

---

<!-- doc-shell:page slug="limitations" -->

## Limitaciones y convenciones

1. **Una instancia activa por escena** ligada al singleton: una segunda instancia genera **warning** y no reemplaza la primera.
2. **Nombre del RPC** fijo en código: `"easychat_message"` (debe estar registrado en LinkUx sin colisionar con otros usos).
3. **`usage` en `ChatCommand`** no aparece en el autocompletado del addon.
4. **Comandos** no se sincronizan por red en el código actual: solo el texto plano tras `broadcast_rpc`. La lógica de comando es **local** al cliente que escribe `/`.
5. **`is_enabled()` del singleton** inspecciona `_is_enabled` del nodo (convención interna; si amplías el nodo, mantén coherencia).
6. El nodo raíz **no** bloquea input global por capa adicional; el diseño asume que abrir el chat es una decisión de UX (ratón visible, acciones liberadas).

---

<!-- doc-shell:page slug="scaling" -->

## Escalar el chat en producción

### Rendimiento y memoria

- Aumenta `max_messages` solo en la medida necesaria: cada mensaje es un `Label` hijo; valores muy altos implican más nodos y más coste de layout en el `VBoxContainer`.
- Para **tráfico muy alto**, valora:
  - **Virtualización** (sustituir la lista de `Label` por un control que reutilice filas) — requiere fork o extensión del addon.
  - **Ventana deslizante** más agresiva (ya existe límite; puedes bajar `max_messages` en consolas o móviles).
- **Autocompletado:** `max_suggestions_visible` y `suggestion_item_height` controlan cuántas filas se construyen en UI por pulsación de tecla; muchos comandos no son problema hasta que el filtro devuelve decenas de entradas visibles.

### Multijugador y moderación

- El addon **no** incluye rate limiting, anti-spam ni validación de contenido: implementa capas en LinkUx, en un servidor autoritativo o conectando `message_received` / reglas en tu juego.
- Si necesitas **historial persistente** o **salas**, centraliza la lógica fuera del nodo y usa `EasyChat.add_message` / `add_system_message` para reflejar el estado.
- Para **muchos jugadores**, el coste suele estar en el backend y en la política de broadcast, no solo en el widget UI.

### Contenido y localización

- `message_format`, prefijos y textos de comando son cadenas en el recurso: duplica `.tres` por idioma o asigna desde código en tiempo de carga.
- **BBCode** no está habilitado en los `Label` actuales; si necesitas rich text, habría que cambiar el tipo de nodo en `_add_message` / `_add_system_message`.

### Varios chats o contextos

- El singleton asume **un** nodo activo por escena: para HUD distintos (lobby vs partida), **desregistra** el anterior al cambiar de escena o usa solo el nodo sin depender del singleton global.

---

<!-- doc-shell:page slug="modifying" -->

## Modificar el addon internamente

### Puntos de extensión recomendados

- **Subclase del nodo:** crea un script que extienda `easychat_node.gd` (o duplica el archivo en tu proyecto) y cambia el `custom_type` en un fork del plugin, o añade el nodo por script. Así puedes sobreescribir `_add_message`, `_execute_command`, etc., sin tocar el original.
- **Recurso `EasyChatConfig`:** puedes añadir nuevas `@export` y leerlas en tu subclase si duplicas el nodo; el recurso base no aplicará propiedades que no conozca `_apply_theme` / `_apply_layout`.
- **LinkUx:** si el nombre del autoload no es `LinkUx`, ajusta `get_node_or_null("/root/LinkUx")` y las señales esperadas en `_setup_multiplayer`.

### Constantes y RPC

- `_RPC_NAME := "easychat_message"` en `easychat_node.gd`: cámbialo si colisiona con otro sistema; mantén coherencia con `register_rpc` / `broadcast_rpc`.

### Layout de notificación

- En `_apply_layout()`, los offsets de `_notif_panel` usan valores derivados de `input_top` y constantes (`-3`, `-46`): ajústalos si quieres la burbuja más arriba o anclada al historial.

### Duplicar comandos en autocompletado

- El bucle en `_update_autocomplete` puede añadir el mismo `ChatCommand` dos veces si nombre y alias coinciden con el prefijo; si te molesta, deduplica en una subclase sobrescribiendo `_update_autocomplete`.

### Editor

- Si cambias rutas de `preload` en `plugin.gd`, mantén `res://addons/easychat/...` o actualiza el plugin.

---

<!-- doc-shell:page slug="troubleshooting" -->

## Solución de problemas

| Síntoma | Posible causa |
|---------|----------------|
| `EasyChat.*` no hace nada | No hay nodo **EasyChat** en la escena actual o no llegó a `_register` (orden de carga, nodo deshabilitado antes de `_ready`). |
| Advertencia de dos instancias | Dos nodos EasyChat en la misma escena; deja solo uno o no uses el singleton para ambos. |
| Chat en red no envía | LinkUx no instalado o autoload distinto de `/root/LinkUx`; sesión no iniciada (`is_in_session` falso); revisa consola por el error explícito. |
| No abre con la tecla | Otra UI consume el evento antes; `open_key` usa `_unhandled_key_input`. Comprueba que `_is_enabled` sea true. |
| Comando no encontrado | Nombre distinto, typo, o comando no está en `config.commands` del recurso **realmente asignado** al nodo. |
| Sin sonido | Stream nulo en el recurso o formato no soportado por `AudioStreamPlayer`. |

---

<!-- doc-shell:page slug="credits" -->

## Créditos

- **EasyChat** — IUX Games, Isaackiux (versión **1.1.0** según `plugin.cfg`).

---

*Documentación creada a detalle con cariño para los desarrolladores.♥️*
