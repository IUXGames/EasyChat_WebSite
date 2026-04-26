<!-- doc-shell:page slug="overview" -->

# EasyChat

[![Godot 4](https://img.shields.io/badge/Godot-4.x-478cbf?logo=godotengine&logoColor=white)](https://godotengine.org/)
[![Version](https://img.shields.io/badge/version-2.1.1-5aafff)](./plugin.cfg)

**EasyChat** is a **Godot 4** addon that adds a reusable UI node for **in-game chat** and a **command console** with autocomplete. It works in **offline mode** (single player or no network session) and in **real-time multiplayer** when combined with the **LinkUx** addon, which abstracts LAN or online backends and keeps the same logical flow regardless of the active backend.

This document describes **every** piece of the addon: exported properties, the singleton API, the command system with step-by-step guides and code examples, runtime behaviour, and guidance for **scaling** the system or **modifying** it internally.

---

## Table of contents

1. [Features](#features)
2. [Requirements and dependencies](#requirements)
3. [Installation](#installation)
4. [Addon architecture](#architecture)
5. [First-time use step by step](#first-use)
6. [`EasyChat` node (Control)](#node-easychat)
7. [`EasyChatConfig` resource](#config-resource)
8. [`ChatCommand` resource](#chatcommand-resource)
9. [Global `EasyChat` singleton](#singleton)
10. [Signals](#signals)
11. [Keyboard input and focus](#keyboard)
12. [Messages, formatting and colours](#messages)
13. [Commands (`/`) and autocomplete](#commands)
14. [Multiplayer with LinkUx](#multiplayer)
15. [Animations](#animations)
16. [Floating notifications](#notifications)
17. [Sounds](#sounds)
18. [Editor preview](#editor-preview)
19. [Limitations and conventions](#limitations)
20. [Scaling chat in production](#scaling)
21. [Modifying the addon internally](#modifying)
22. [Troubleshooting](#troubleshooting)
23. [Credits](#credits)

---

<!-- doc-shell:page slug="features" -->

## Features

- **Custom node** registered in the editor as type **EasyChat** (extends `Control`), with its own icon.
- **`EasyChat` singleton** registered automatically when the plugin is enabled; global API to open/close, post messages, and set the player name from any script.
- **Simplified but stronger customization system**: `EasyChatConfig` centralizes appearance, behavior, layout, sounds, commands, and animations in a single reusable `.tres`.
- **StyleBox per element**: history, autocomplete, suggestion rows, input, send button, and notifications now accept `StyleBox` resources with built-in default fallbacks.
- **Expanded animations**: all animatable chat blocks support `NONE`, `FADE`, `FADE_UP`, `FADE_DOWN`, `FADE_LEFT`, `FADE_RIGHT`, `SLIDE_*`, and `SCALE`.
- **Per-subgroup Slide Distance**: `History Panel`, `Input Row`, `History messages`, and `Notification` each have their own slide distance property.
- **`ChatCommand` resource**: name, aliases, description, documented usage, and `executed(args)` signal. Connect the signal from any script anywhere in your project.
- **History** with a configurable limit; oldest messages are removed automatically when the limit is exceeded.
- **Non-blocking overlay**: the root node uses `mouse_filter = IGNORE` so it never steals game clicks; only when the chat opens does the cursor become visible and `InputMap` actions are released.
- **Autocomplete** for commands when typing `/`, with keyboard navigation (↑↓ Tab) and mouse clicks.
- **Floating notifications** when a message arrives while the panel is closed (or when sending with `close_on_send`), with configurable stack size, duration, and entry animation.
- **Advanced editor preview**: new **Preview** section with interactive buttons to rebuild, toggle visibility, and test animations/messages/notifications directly in the editor.
- **Optional multiplayer** via **LinkUx**: RPC registration, broadcast on send, local name from `LinkUx.get_local_player_name()`, visibility tied to session state, and forced close when the session ends.

---

<!-- doc-shell:page slug="requirements" -->

## Requirements and dependencies

| Component | Required | Notes |
|-----------|----------|-------|
| **Godot 4.x** | Yes | The code uses Godot 4 syntax and APIs (`@export`, typed signals, `Tween`, etc.). |
| **LinkUx** | No | Only needed if `multiplayer_enabled` is `true` on the node and you want real-time network chat. The autoload **`/root/LinkUx`** must exist. |

Expected addon path: `res://addons/easychat/` (consistent with `plugin.gd` and internal `preload` paths).

---

<!-- doc-shell:page slug="installation" -->

## Installation

### Step 1 — Copy the addon

Copy the `easychat` folder into `res://addons/easychat/`. The final path must be:

```plaintext
res://addons/easychat/plugin.cfg
res://addons/easychat/plugin.gd
res://addons/easychat/easychat.gd
res://addons/easychat/easychat_node.gd
res://addons/easychat/easychat_config.gd
res://addons/easychat/chat_command.gd
```

### Step 2 — Enable the plugin

Open your project in Godot 4, go to **Project → Project Settings → Plugins**, find **EasyChat** in the list and click **Enable**.

When the plugin is enabled it:
- Registers the **`EasyChat`** autoload (singleton) pointing to `res://addons/easychat/easychat.gd`.
- Registers the **EasyChat** custom node type in the add-node dialog (under `Control`).

### Step 3 — Add the node to a scene

1. Open the scene where you want chat (e.g. `main.tscn` or a dedicated HUD scene).
2. Add a **`CanvasLayer`** node as a child of your root (recommended so the chat always renders on top).
3. Inside the `CanvasLayer`, add an **EasyChat** node. You will find it in the node picker under **Control → EasyChat**.

### Step 4 — (Optional) Install LinkUx for multiplayer

If you want network chat, install and enable **LinkUx** as well. EasyChat expects it at `/root/LinkUx`. Once installed:

1. On the **EasyChat** node, set `multiplayer_enabled` to `true`.
2. Start a session through LinkUx; EasyChat automatically registers the RPC and begins broadcasting messages.

---

<!-- doc-shell:page slug="architecture" -->

## Addon architecture

| File | Role |
|------|------|
| `plugin.cfg` | Plugin metadata (name, version, plugin script). |
| `plugin.gd` | `EditorPlugin`: on enable/disable manages the autoload; on editor tree enter/exit registers the **EasyChat** type. |
| `easychat.gd` | **EasyChat** singleton: facade that delegates every call to the active node instance. |
| `easychat_node.gd` | **EasyChat** node: builds the full UI in code, handles input, commands, animations, notifications, sounds, and LinkUx integration. |
| `easychat_config.gd` | `class_name EasyChatConfig` — configuration resource with all visual and behavioural settings. |
| `chat_command.gd` | `class_name ChatCommand` — per-command resource with `executed(args)` signal. |
| `icon.svg` | Node and script icon shown in the editor. |

### Registration flow

```plaintext
_ready() [in-game only]
  └─ EasyChat._register(self)       ← node registers with singleton
        └─ singleton stores node ref, connects its signals

_exit_tree()
  └─ EasyChat._unregister(self)     ← node deregisters
```

Only **one** active EasyChat instance per scene is delegated to by the singleton. A second instance logs a **warning** and is ignored by the singleton (both nodes still work independently, but only the first one registered drives `EasyChat.*` API calls).

The node is also added to group `"easychat"`, useful for queries or tools: `get_tree().get_nodes_in_group("easychat")`.

---

<!-- doc-shell:page slug="first-use" -->

## First-time use step by step

### Offline / without LinkUx

1. Enable the **EasyChat** plugin (see [Installation](#installation)).
2. Add a `CanvasLayer` to your game scene, then add an **EasyChat** node inside it.
3. Leave `multiplayer_enabled` as `false` (default).
4. Run the scene. Press **T** (default `open_key`) to open the chat; press **Escape** to close it.
5. Type any text and press **Enter** or the send button to post a message.
6. For commands, type `/` followed by the command name and optional arguments.

### Setting the local player name

Before or after the node enters the tree, call:

```gdscript
func _ready() -> void:
    EasyChat.set_player_name("GreenKnight")
```

This name replaces `{sender}` in the message format when you send a chat line. In multiplayer mode the name is overridden by `LinkUx.get_local_player_name()` when available.

### Using a shared configuration resource

1. In the **FileSystem** panel: right-click → **New Resource** → search for `EasyChatConfig` → save as e.g. `res://ui/chat_config.tres`.
2. Adjust colours, fonts, animations, sounds, and commands in the inspector.
3. In the **EasyChat** node inspector, drag your `.tres` file into the **Config** field.
4. Reuse the same `.tres` in other scenes (lobby, match, etc.) for a consistent look.

If no config is assigned at runtime the node automatically creates `EasyChatConfig.new()` with sensible defaults.

### Multiplayer (LinkUx)

1. Install **LinkUx** and verify it is registered as an autoload at `/root/LinkUx`.
2. On the **EasyChat** node set `multiplayer_enabled = true`.
3. Start a session via LinkUx (see that addon's docs). EasyChat will:
   - Register two RPCs when the session starts: `easychat_message` (player chat) and `easychat_system` (system messages).
   - Use `LinkUx.get_local_player_name()` for the sender display name.
   - Broadcast every non-command message to all peers.
   - Force-close the chat and clean up when the session ends.

---

<!-- doc-shell:page slug="node-easychat" -->

## `EasyChat` node (Control)

This is the **main node** you add to your scene. It builds the entire chat UI programmatically inside a full-screen `Control` anchored to `PRESET_FULL_RECT`. The chat layout is positioned at the bottom-left of the viewport using offsets from `EasyChatConfig`.

### Exported properties (inspector)

#### `config` — `EasyChatConfig`

Resource holding all visual and behavioural customisation. If left empty at runtime, the node creates `EasyChatConfig.new()` with defaults. In the editor, assigning or changing the resource reconnects `config.changed` to refresh the live preview.

#### Multiplayer group

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `multiplayer_enabled` | `bool` | `false` | Enables LinkUx integration. If LinkUx is missing an **error** is logged and network behaviour is inactive. |

#### Controls group

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `open_key` | `Key` | `KEY_T` | Key to **open** the chat (via `_unhandled_key_input` while chat is closed and enabled). Also replaces `{key}` in the input placeholder text. |
| `close_key` | `Key` | `KEY_ESCAPE` | While **open**: closes the suggestion panel if visible, then closes chat. Handled in `_input` so the event is consumed early. |

### Public node API

These methods are available when you hold a direct reference to the EasyChat node. Most of the time you will use the **singleton** instead.

| Method | Behaviour |
|--------|-----------|
| `is_open() -> bool` | `true` if the history panel is currently open or being animated open. |
| `enable()` | Marks the chat as enabled and shows it according to internal visibility rules. |
| `disable()` | Force-closes if open, clears history, then disables and hides the node completely. |
| `clear_history()` | Removes all message labels from the history list immediately. |
| `set_player_name(name: String)` | Sets the local player name used as the sender for outgoing chat lines. |

```gdscript
# Example: enable/disable chat based on game state
func _on_game_started() -> void:
    EasyChat.enable()

func _on_game_paused() -> void:
    EasyChat.disable()
```

---

<!-- doc-shell:page slug="config-resource" -->

## `EasyChatConfig` resource

`class_name EasyChatConfig extends Resource`. Groups all inspector options in `@export_group` / `@export_subgroup` blocks.

### `AnimType` enum

Controls how the **history panel**, **input row**, **history messages**, and **notifications** animate.

| Value | Meaning |
|-------|---------|
| `NONE` | Instant show/hide (no transition). |
| `FADE` | Fade using `modulate.a`. |
| `FADE_UP` | Fade + upward offset motion on enter (inverse on hide). |
| `FADE_DOWN` | Fade + downward offset motion on enter (inverse on hide). |
| `FADE_LEFT` | Fade + horizontal offset from left on enter (inverse on hide). |
| `FADE_RIGHT` | Fade + horizontal offset from right on enter (inverse on hide). |
| `SLIDE_UP` | History enters from below; exits downward on close. |
| `SLIDE_DOWN` | History enters from above; exits upward on close. |
| `SLIDE_LEFT` | Enters from the left; exits left. |
| `SLIDE_RIGHT` | Enters from the right; exits right. |
| `SCALE` | Vertical scale from near-zero to 1, pivot at the bottom edge. `BACK` easing when showing, `CUBIC` when hiding. |

Slide distances are now **configured per animation subgroup** through dedicated `*_slide_distance` properties.

### Appearance group

#### History subgroup (message panel)

| Property | Type | Default | Use |
|----------|------|---------|-----|
| `history_style` | `StyleBox` | `null` | StyleBox used by the history panel. `null` uses the built-in default style. |

#### Autocomplete subgroup

| Property | Type | Use |
|----------|------|-----|
| `autocomplete_style` | `StyleBox` | Suggestion panel StyleBox. |
| `autocomplete_item_style` | `StyleBox` | StyleBox for non-selected suggestion rows. |
| `autocomplete_selected_style` | `StyleBox` | StyleBox for the selected/highlighted row. |
| `autocomplete_command_color` | `Color` | `/command` name text colour. |
| `autocomplete_desc_color` | `Color` | Description text colour. |
| `autocomplete_font_size` | `int` | Font size in the suggestion list. |
| `autocomplete_font` | `Font` | Optional custom font for command and description labels. |

#### Input subgroup (`LineEdit`)

| Property | Type | Use |
|----------|------|-----|
| `input_style` | `StyleBox` | Input StyleBox in normal state. |
| `input_focus_style` | `StyleBox` | Input StyleBox when focused. |
| `input_font_size` | `int` | Typed text size. |
| `input_font` | `Font` | Optional custom font for typed text and placeholder. |
| `input_caret_color` | `Color` | Text cursor colour. |
| `input_placeholder_color` | `Color` | Placeholder text colour. |
| `input_placeholder_text` | `String` | Placeholder; `{key}` is replaced by the display name of `open_key`. |

#### Send Button subgroup

| Property | Type | Use |
|----------|------|-----|
| `send_button_style` | `StyleBox` | Send button StyleBox in normal state. |
| `send_button_hover_style` | `StyleBox` | Send button StyleBox in hover/pressed state. |
| `send_button_text` | `String` | Button label (default: return symbol `↵`). |
| `send_button_text_color` | `Color` | Button text colour. |
| `send_button_font_size` | `int` | Font size. |
| `send_button_font` | `Font` | Optional custom font for the button label. |

#### Messages subgroup (history)

| Property | Type | Use |
|----------|------|-----|
| `message_font_size` | `int` | Font size for all history messages. |
| `message_font` | `Font` | Optional custom font for history message labels. |
| `message_format` | `String` | Template string. Supports `{sender}` and `{message}` tokens. Default: `"{sender}: {message}"`. |
| `local_message_color` | `Color` | Colour for messages sent by the local player. |
| `remote_message_color` | `Color` | Colour for messages received from other players or injected via `add_message()`. |
| `system_message_color` | `Color` | Colour for system messages. |
| `system_message_prefix` | `String` | Prepended to every system message (default: `▶ `). |

#### Notification subgroup

| Property | Type | Use |
|----------|------|-----|
| `notification_style` | `StyleBox` | StyleBox for each stacked notification entry. |
| `notification_color` | `Color` | Floating notification text colour. |
| `notification_font_size` | `int` | Text size. |
| `notification_font` | `Font` | Optional custom font for notification text. |

### Behavior group

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `show_send_button` | `bool` | `true` | Show or hide the send button. |
| `close_on_send` | `bool` | `false` | Close chat after sending a message **or** executing a command. The last sent line may appear briefly as a notification. |
| `alpha_input_closed` | `float` | `0.35` | Input row opacity when chat is closed with `FADE`, `FADE_*`, or `NONE`. |
| `notification_alpha` | `float` | `0.75` | Maximum opacity reached during a notification's fade-in. |
| `notification_duration` | `float` | `3.0` | Seconds a notification stays fully visible before fading out. |
| `max_messages` | `int` | `100` | Maximum lines in history; the oldest message is removed when this limit is exceeded. |
| `max_suggestions_visible` | `int` | `6` | Maximum autocomplete rows visible at once (the rest scroll). |
| `max_notifications` | `int` | `3` | Maximum floating notifications on screen at once; the oldest is removed when exceeded. |

### Animations group

#### History Panel subgroup

| Property | Type | Default |
|----------|------|---------|
| `history_anim_type` | `AnimType` | `FADE` |
| `history_anim_duration` | `float` | `0.18` s |
| `history_slide_distance` | `float` | `206.0` px |

#### Input Row subgroup

| Property | Type | Default |
|----------|------|---------|
| `input_anim_type` | `AnimType` | `FADE` |
| `input_anim_duration` | `float` | `0.18` s |
| `input_slide_distance` | `float` | `42.0` px |

With **FADE** and **FADE_*** types, the input row returns to `alpha_input_closed` on close. With **SLIDE** or **SCALE**, it becomes fully hidden.

#### History messages subgroup

| Property | Type | Default |
|----------|------|---------|
| `message_anim_type` | `AnimType` | `NONE` |
| `message_anim_duration` | `float` | `0.12` s |
| `message_slide_distance` | `float` | `28.0` px |

Controls the appearance animation of each newly appended history message.

#### Notification subgroup

| Property | Type | Default |
|----------|------|---------|
| `notification_anim_type` | `AnimType` | `FADE` |
| `notification_anim_duration` | `float` | `0.15` s |
| `notification_slide_distance` | `float` | `28.0` px |

### Advanced StyleBox customization workflow (recommended)

1. Create a `StyleBoxFlat` or `StyleBoxTexture` in the Inspector.
2. Tune background, border, corner radius, and content margins.
3. Assign it to the matching `*_style` property.
4. Reuse the same resource across multiple elements/configs for consistent skins.
5. Set the style property to `null` to fall back to EasyChat built-in defaults.

This enables deep visual customization without editing `easychat_node.gd`.

### Layout group

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `panel_width` | `float` | `415` px | Width of the entire chat block. |
| `panel_height` | `float` | `206` px | Height of the message history area. |
| `input_height` | `float` | `42` px | Height of the input row (also used as the slide/scale reference for that row). |
| `send_button_width` | `float` | `52` px | Minimum send button width. |
| `panel_margin_left` | `float` | `10` px | Distance from the left edge of the viewport. |
| `panel_margin_bottom` | `float` | `10` px | Distance from the bottom edge of the viewport. |
| `suggestion_item_height` | `float` | `28` px | Height of each autocomplete suggestion row. |

### Sounds group

All properties are `AudioStream` — set to `null` for silence.

| Property | When it plays |
|----------|--------------|
| `sound_message_received` | A message from another player arrives (non-local). |
| `sound_system_message` | A system message is added to history. |
| `sound_message_sent` | The local player sends a chat message. |
| `sound_chat_opened` | Chat opens. |
| `sound_chat_closed` | Chat closes. |

Playback uses a single child `AudioStreamPlayer`; a new sound interrupts the previous one if it is still playing.

### Commands group

| Property | Type | Description |
|----------|------|-------------|
| `commands` | `Array[ChatCommand]` | List of all commands available for `/` input and autocomplete. |

---

<!-- doc-shell:page slug="chatcommand-resource" -->

## `ChatCommand` resource

`class_name ChatCommand extends Resource`. Represents a single command entry.

| Member | Type | Description |
|--------|------|-------------|
| `executed` | `signal executed(args: Array)` | Emitted when the command is executed. `args` is an array of strings (the tokens after the command name). |
| `command_name` | `String` | Primary trigger after `/`. Matched **case-insensitively** (so `/Hello`, `/HELLO`, and `/hello` all match `"hello"`). |
| `aliases` | `PackedStringArray` | Alternate names, also matched case-insensitively. Adding `"tp"` here means `/tp` also triggers this command. |
| `description` | `String` | Short text shown in the autocomplete panel next to the command name. Keep it brief (one line). |
| `usage` | `String` | Longer usage documentation for your own help screens. **The addon does not show this** in the autocomplete UI — only `description` is shown there. |

### Argument parsing

When the user submits `/cmd arg1 arg2 arg3`, the chat node:

1. Strips the leading `/`.
2. Splits the string on spaces.
3. Takes the first token as the command name.
4. Passes the remaining tokens as `args: Array` when emitting `executed`.

```gdscript
# User types: /kick player123 cheating
# args = ["player123", "cheating"]

func _on_kick_executed(args: Array) -> void:
    var target = args[0] if args.size() >= 1 else ""
    var reason = " ".join(args.slice(1)) if args.size() >= 2 else "no reason"
    print("Kick %s — reason: %s" % [target, reason])
```

If no arguments are provided `args` is an **empty array** `[]`.

---

<!-- doc-shell:page slug="singleton" -->

## Global `EasyChat` singleton

Registered by `plugin.gd` as an autoload (path: `res://addons/easychat/easychat.gd`). Available from any script as `EasyChat.*` without needing a node reference.

| Method | Behaviour |
|--------|-----------|
| `enable()` | Enables and shows the active node. |
| `disable()` | Force-closes, clears history, disables and hides the active node. |
| `is_open() -> bool` | `true` if a node is registered and currently open. |
| `is_enabled() -> bool` | `true` if a node is registered and enabled. |
| `clear_history()` | Removes all messages from the active node's history. |
| `add_message(sender: String, text: String)` | Injects a message styled as **remote** (`remote_message_color`), bypassing local input. Also emits `message_received`. |
| `add_system_message(text: String)` | Injects a system-styled message (prefix + `system_message_color`). Does **not** emit `message_received`. |
| `set_player_name(name: String)` | Sets the local player name used as the sender. |

If no valid node instance is registered, all calls are **no-ops** (except `is_open` / `is_enabled` which return `false`).

### Usage examples

```gdscript
# Set player name on game start
func _on_game_ready() -> void:
    EasyChat.set_player_name("BlueWizard")
    EasyChat.enable()

# Inject a server announcement from code (not from the user typing)
func _on_server_event(text: String) -> void:
    EasyChat.add_system_message(text)

# Inject a message that looks like it came from another player
func _on_npc_speaks(npc_name: String, text: String) -> void:
    EasyChat.add_message(npc_name, text)

# Check if the player has the chat open before doing something
func _process(_delta: float) -> void:
    if EasyChat.is_open():
        # pause game logic while chat is open
        pass
```

---

<!-- doc-shell:page slug="signals" -->

## Signals

### On the `EasyChat` node (and re-emitted by the singleton)

| Signal | Parameters | When |
|--------|------------|------|
| `chat_opened` | — | Fires at the start of the open sequence (animations, sound, and deferred focus are triggered). |
| `chat_closed` | — | Fires after a normal close or a forced close (session ended, `disable()`, etc.). |
| `message_received` | `sender: String`, `message: String` | Fires for **every** message added to history via `_add_message` — both local sends and remote receives. Does **not** fire for system-only messages. |

### Connecting via the singleton (recommended)

```gdscript
extends Node

func _ready() -> void:
    EasyChat.chat_opened.connect(_on_chat_opened)
    EasyChat.chat_closed.connect(_on_chat_closed)
    EasyChat.message_received.connect(_on_message)

func _on_chat_opened() -> void:
    # e.g. pause the game or hide other UI
    get_tree().paused = true

func _on_chat_closed() -> void:
    get_tree().paused = false

func _on_message(sender: String, message: String) -> void:
    # Log all chat to a file, trigger achievements, etc.
    print("[CHAT] %s: %s" % [sender, message])
```

### Connecting via a direct node reference

```gdscript
@onready var chat: Control = $CanvasLayer/EasyChat

func _ready() -> void:
    chat.message_received.connect(_on_message)

func _on_message(sender: String, message: String) -> void:
    pass
```

---

<!-- doc-shell:page slug="keyboard" -->

## Keyboard input and focus

| Action | Key | Where handled |
|--------|-----|---------------|
| Open chat | `open_key` (default `T`) | `_unhandled_key_input` — fires only if chat is **closed** and **enabled**. |
| Close chat / dismiss autocomplete | `close_key` (default `Escape`) | `_input` — first closes the autocomplete panel if visible, then closes chat. Consumed early. |
| Navigate suggestions | `↑` / `↓` | `_input` while chat is open and the suggestion panel is visible. |
| Apply suggestion | `Tab` | `_input` while chat is open; applies the selected suggestion, or the first one if none is selected. |

### Focus and mouse mode

- **On open:** `Input.mouse_mode` is stored and set to `MOUSE_MODE_VISIBLE`. `Input.action_release` is called for **every** action in `InputMap` to prevent "stuck" keys (e.g. if the player was holding a movement key when they opened chat).
- **On close:** previous mouse mode is restored.
- The send button uses `focus_mode = FOCUS_NONE` so keyboard focus stays on the `LineEdit`.
- The root node uses `mouse_filter = IGNORE` so it does not absorb game clicks.

---

<!-- doc-shell:page slug="messages" -->

## Messages, formatting and colours

### Format template

`message_format` in `EasyChatConfig` is a string template applied to every player message. Supported tokens:

| Token | Replaced with |
|-------|--------------|
| `{sender}` | The sender's name (local player name or remote player's name). |
| `{message}` | The message body. |

Default value: `"{sender}: {message}"` → produces `"GreenKnight: Hello!"`

You can customise it freely:

```plaintext
[{sender}] {message}      →  [GreenKnight] Hello!
<{sender}> {message}      →  <GreenKnight> Hello!
{sender} says: {message}  →  GreenKnight says: Hello!
```

### Message types and colours

| Type | Colour property | Triggered by |
|------|----------------|-------------|
| Local | `local_message_color` | Messages you send (green by default). |
| Remote | `remote_message_color` | Messages from other players or `EasyChat.add_message()` (white by default). |
| System | `system_message_color` | `EasyChat.add_system_message()` or unknown command error (yellow by default). |

### History limit

When `max_messages` is reached, the oldest `Label` in the history list is removed via `queue_free` before adding the new one.

### Scroll behaviour

Whenever a new message is added while the chat is **open**, the scroll container scrolls to the bottom on the next frame. If the chat is **closed**, a floating notification is shown instead.

---

<!-- doc-shell:page slug="commands" -->

## Commands (`/`) and autocomplete

Any input line that **starts with `/`** is treated as a command and is **never** sent as player chat. This section explains every step from creating a command resource to handling it in your game logic, including complete code examples.

### How command execution works

When the user presses Enter on `/cmd arg1 arg2`:

1. The chat node detects the leading `/`.
2. It splits the text on spaces: `["cmd", "arg1", "arg2"]`.
3. It searches `config.commands` for a `ChatCommand` whose `command_name` or any `alias` matches `"cmd"` (case-insensitive).
4. If found: emits `command.executed.emit(["arg1", "arg2"])`.
5. If **not** found: shows `▶ Unknown command: /cmd` as a system message.

---

### Step 1 — Create a `ChatCommand` resource file

In the **FileSystem** panel (bottom-left in Godot):

1. Navigate to the folder where you want to store commands. It is recommended to create a dedicated folder, for example `res://chat/commands/`.
2. Right-click inside that folder and select **New Resource**.
3. A search dialog appears. Type `ChatCommand` and press **Enter** or double-click the result.
4. A save dialog opens. Give the file a descriptive name such as `cmd_hello.tres` and click **Save**.

The file appears in the FileSystem. Click it once to select it — the **Inspector** panel on the right will show all of its editable properties.

---

### Step 2 — Configure the command properties in the Inspector

With your `cmd_hello.tres` selected, the Inspector shows four fields. Here is what each one does and how to fill it in:

#### `command_name` — The trigger word

| | |
|---|---|
| **What it is** | The primary keyword that the user types after `/` to run this command. |
| **What to type** | A single lowercase word **without** the `/`. Example: `hello` |
| **How it matches** | Case-insensitive — the user can type `/hello`, `/Hello`, or `/HELLO` and all will match. |
| **Leave it empty?** | The command will never match and will never appear in autocomplete. Always fill this in. |

```plaintext
Inspector field → command_name
Value           → hello
```

#### `aliases` — Alternate trigger words

| | |
|---|---|
| **What it is** | An array of additional keywords that also trigger this command. |
| **What to type** | Click the array field, press **+** to add items, and type each alternate name. |
| **How it matches** | Same case-insensitive rule as `command_name`. |
| **Leave it empty?** | Fine — most commands do not need aliases. |
| **Example use** | A `teleport` command could have `["tp"]` so `/tp` is a valid shortcut. |

```plaintext
Inspector field → aliases
Value           → ["hi", "hey"]
Effect          → /hi and /hey now also trigger this command
```

#### `description` — Text shown in the autocomplete panel

| | |
|---|---|
| **What it is** | A short label shown next to the command name in the autocomplete dropdown that appears when the user types `/`. |
| **What to type** | A single short sentence. Example: `Greets everyone in the chat` |
| **Best practice** | Keep it to one line and mention the arguments if any. Example: `Move player — /teleport <x> <y>` |
| **Leave it empty?** | The command still works but the autocomplete row shows no description text. |

```plaintext
Inspector field → description
Value           → Greets everyone in the chat
```

This is what the player sees when they type `/he` in the chat field:

```plaintext
┌─────────────────────────────────────────┐
│  /hello   Greets everyone in the chat   │
└─────────────────────────────────────────┘
```

#### `usage` — Full syntax documentation (for your own help screens)

| | |
|---|---|
| **What it is** | A longer string documenting the full command syntax, intended for your own `/help` command or tooltips. |
| **What to type** | The full command with placeholders. Example: `/hello` or `/teleport <x> <y>` |
| **Important** | **This field is NOT shown in the autocomplete panel.** Only `description` appears there. |
| **Leave it empty?** | Fine — it has no effect on autocomplete or execution. |
| **How to use it** | Read it in your `/help` command handler: `EasyChat.add_system_message(cmd.usage)` |

```plaintext
Inspector field → usage
Value           → /hello
```

---

### Step 3 — Add the command to `EasyChatConfig`

The command resource needs to be registered in the config so the chat node knows about it.

1. In the **FileSystem**, click your `EasyChatConfig.tres` file to select it (or the config you assigned to the EasyChat node).
2. In the **Inspector**, scroll to the **Commands** group at the bottom.
3. Click the `commands` array row to expand it.
4. Click the **Add Element** button (`+`) that appears.
5. A new empty slot appears. Click the empty slot and either:
   - Drag your `cmd_hello.tres` from the FileSystem into the slot, **or**
   - Click the slot's folder icon to open the resource picker, find your file, and confirm.
6. The command name and description now appear in the slot.

Repeat from step 4 for every additional command. Commands are matched **in order** — if two commands share the same `command_name`, the first one in the array wins.

> **Tip:** You can reorder commands by dragging the rows in the array. The order also determines the order in the autocomplete suggestion list.

You can also create commands in code without `.tres` files (useful for procedurally registered commands at runtime):

```gdscript
var cmd = ChatCommand.new()
cmd.command_name = "hello"
cmd.aliases = PackedStringArray(["hi", "hey"])
cmd.description = "Greets everyone"
cmd.usage = "/hello"
# Add to config at runtime:
chat_node.config.commands.append(cmd)
cmd.executed.connect(_on_hello_executed)
```

---

### Step 4 — Connect the `executed` signal

The `ChatCommand` resource has an `executed(args: Array)` signal. You connect to it from **any script** in your project that holds a reference to the same `.tres` file. Because `ChatCommand` is a `Resource`, all scripts that `preload` the same path share the **same object** and will all receive the signal when the command fires.

#### Option A — `preload` in your script (recommended)

```gdscript
# In any script — does not need to be in the same scene as EasyChat
extends Node

var cmd_hello = preload("res://chat/commands/cmd_hello.tres")

func _ready() -> void:
    cmd_hello.executed.connect(_on_hello_executed)

func _on_hello_executed(args: Array) -> void:
    EasyChat.add_system_message("Hello, world!")
```

#### Option B — Iterate through the config's command list

Useful when you want to handle all commands in one place without holding individual references:

```gdscript
@onready var chat: Control = $CanvasLayer/EasyChat

func _ready() -> void:
    for cmd in chat.config.commands:
        match cmd.command_name:
            "hello":
                cmd.executed.connect(_on_hello_executed)
            "teleport":
                cmd.executed.connect(_on_teleport_executed)
            "kick":
                cmd.executed.connect(_on_kick_executed)
```

---

### Example A — Command without arguments: `/ping`

A simple `/ping` command that shows a status message.

**`cmd_ping.tres`** properties:
- `command_name`: `ping`
- `description`: `Check connection status`

**Script:**

```gdscript
extends Node

var cmd_ping = preload("res://chat/commands/cmd_ping.tres")

func _ready() -> void:
    cmd_ping.executed.connect(_on_ping)

func _on_ping(args: Array) -> void:
    # args is [] when the user types just "/ping"
    # Any extra words are silently ignored in this example
    EasyChat.add_system_message("Pong! Server is reachable.")
```

**In-game usage:**
```plaintext
/ping           →  ▶ Pong! Server is reachable.
/ping anything  →  ▶ Pong! Server is reachable.  (extra args ignored)
```

---

### Example B — Command with required arguments: `/teleport x y`

A `/teleport` command that moves the local player to a position.

**`cmd_teleport.tres`** properties:
- `command_name`: `teleport`
- `aliases`: `["tp"]`
- `description`: `Move player to position — /teleport <x> <y>`

**Script:**

```gdscript
extends Node

@export var player: CharacterBody2D

var cmd_teleport = preload("res://chat/commands/cmd_teleport.tres")

func _ready() -> void:
    cmd_teleport.executed.connect(_on_teleport)

func _on_teleport(args: Array) -> void:
    if args.size() < 2:
        EasyChat.add_system_message("Usage: /teleport <x> <y>")
        return

    var x := float(args[0])
    var y := float(args[1])

    if is_instance_valid(player):
        player.global_position = Vector2(x, y)
        EasyChat.add_system_message("Teleported to (%.0f, %.0f)" % [x, y])
    else:
        EasyChat.add_system_message("Error: player reference is not set.")
```

**In-game usage:**
```plaintext
/teleport 320 200    →  ▶ Teleported to (320, 200)
/tp 0 0              →  ▶ Teleported to (0, 0)        (alias works!)
/teleport            →  ▶ Usage: /teleport <x> <y>    (too few args)
/teleport abc 200    →  ▶ Teleported to (0, 200)      (float("abc") = 0.0)
```

---

### Example C — Command with optional arguments: `/shout [text]`

A `/shout` command that shouts either custom text or a default phrase.

**`cmd_shout.tres`** properties:
- `command_name`: `shout`
- `description`: `Shout a message in uppercase. Usage: /shout [text]`

**Script:**

```gdscript
extends Node

var cmd_shout = preload("res://chat/commands/cmd_shout.tres")

func _ready() -> void:
    cmd_shout.executed.connect(_on_shout)

func _on_shout(args: Array) -> void:
    var text: String
    if args.is_empty():
        text = "AAAAAA!"
    else:
        text = " ".join(args).to_upper() + "!"

    # Broadcast as a regular message attributed to the local player
    EasyChat.add_message(EasyChat._node._local_player_name if EasyChat._node else "Player", text)
    # Or use add_system_message for a system-style line:
    # EasyChat.add_system_message(text)
```

**In-game usage:**
```plaintext
/shout                  →  AAAAAA!
/shout hello world      →  HELLO WORLD!
/shout the cake is lie  →  THE CAKE IS LIE!
```

---

### Example D — Command with variable argument count: `/kick [player] [reason...]`

A moderation command that reads any number of words as the reason.

**Script:**

```gdscript
extends Node

var cmd_kick = preload("res://chat/commands/cmd_kick.tres")

func _ready() -> void:
    cmd_kick.executed.connect(_on_kick)

func _on_kick(args: Array) -> void:
    if args.is_empty():
        EasyChat.add_system_message("Usage: /kick <player> [reason]")
        return

    var target: String = args[0]
    var reason: String = "No reason given"

    if args.size() >= 2:
        reason = " ".join(args.slice(1))  # join all remaining words

    EasyChat.add_system_message("Kicked %s — Reason: %s" % [target, reason])
    # Here you would also call your game logic to actually kick the player
```

**In-game usage:**
```plaintext
/kick                        →  ▶ Usage: /kick <player> [reason]
/kick player123              →  ▶ Kicked player123 — Reason: No reason given
/kick player123 was cheating →  ▶ Kicked player123 — Reason: was cheating
```

---

### Listening to a command from a different scene

Because `ChatCommand` is a `Resource`, **any** scene that loads the same `.tres` file will receive `executed` when the command fires — even if that scene doesn't contain the EasyChat node at all.

```gdscript
# res://game/player.gd  (the EasyChat node is in a different scene)
extends CharacterBody2D

var cmd_teleport = preload("res://chat/commands/cmd_teleport.tres")

func _ready() -> void:
    cmd_teleport.executed.connect(_on_teleport)

func _on_teleport(args: Array) -> void:
    if args.size() < 2:
        return
    global_position = Vector2(float(args[0]), float(args[1]))
```

This works because all scripts that `preload` (or `load`) the same resource path get **the same object** in memory. The signal is emitted on that shared object and all connected callables receive it.

---

### Preventing duplicate connections

If your scene is instantiated multiple times or `_ready` could run more than once, guard the connection:

```gdscript
func _ready() -> void:
    if not cmd_hello.executed.is_connected(_on_hello_executed):
        cmd_hello.executed.connect(_on_hello_executed)
```

---

### Autocomplete behaviour

- Typing `/` shows all commands.
- Typing `/h` filters to commands whose `command_name` or any `alias` **starts with** `h` (case-insensitive).
- Use **↑** / **↓** to navigate the suggestion list; press **Tab** to apply the highlighted suggestion (fills `/commandname ` in the input and closes the panel).
- Click a suggestion row to apply it immediately.
- Pressing **Escape** closes the suggestion panel first; pressing it again closes the chat.

---

<!-- doc-shell:page slug="multiplayer" -->

## Multiplayer with LinkUx

EasyChat does not implement networking itself: it delegates to **LinkUx** when `multiplayer_enabled` is `true`.

### Expected LinkUx contract (from code usage)

The node does `get_node_or_null("/root/LinkUx")` and uses the following APIs:

| API used | Purpose |
|----------|---------|
| `session_started` (signal) | Registers RPCs, refreshes local player name and node visibility. |
| `session_closed` (signal) | Force-closes the chat and updates visibility. |
| `is_in_session() -> bool` | Determines whether to register RPCs and whether sending broadcasts to peers. |
| `get_local_player_name() -> String` | Local sender name; replaces `_local_player_name` when non-empty. |
| `register_rpc(rpc_name: String, callable: Callable)` | Registers `"easychat_message"` and `"easychat_system"` handlers. |
| `broadcast_rpc(rpc_name: String, args: Array, reliable: bool)` | Sends `[sender, text]` to all peers reliably. |

### Full send flow

```plaintext
User presses Enter on "Hello!"
        │
        ▼
Is it a command (/…)?  ──Yes──►  _execute_command()  ──►  cmd.executed.emit(args)
        │ No
        ▼
Is multiplayer_enabled and session active?
        │ Yes                                  │ No
        ▼                                      ▼
broadcast_rpc("easychat_message",         _add_message(sender, text, true)
    [sender, text], true)                  (local only)
        │
        ▼
_add_message(sender, text, true)  ← also add locally
        │
        ▼
Remote peers receive RPC → _on_chat_rpc(_from_peer, sender, message)
        │
        ▼
_add_message(sender, message, false)  ← remote-styled on each peer
```

### Node visibility with multiplayer

`_update_visibility()` sets `visible = _is_enabled`. The node does **not** automatically become visible when a session starts — you must call `EasyChat.enable()` yourself as part of your session start flow.

```gdscript
func _on_session_started() -> void:
    EasyChat.set_player_name(my_player_name)
    EasyChat.enable()
```

### System messages in multiplayer

```gdscript
# This sends a system message to ALL connected peers
EasyChat.add_system_message("The round has started!")

# add_system_message with broadcast=true (default) uses easychat_system RPC
# On remote peers, _on_system_rpc calls _add_system_message(..., false) to avoid loops
```

### Common errors

| Symptom | Cause |
|---------|-------|
| Network chat does nothing | `multiplayer_enabled` is `true` but no LinkUx autoload. Check the output for an explicit error. |
| Messages not reaching all peers | Session not started (`LinkUx.is_in_session()` returns `false`). |

---

<!-- doc-shell:page slug="animations" -->

## Animations

- The history panel and input row use **independent tweens** on open/close.
- Reopening while the close animation is still running: the previous tween is `kill()`ed and a new one starts.
- **New directional fades (`FADE_UP/DOWN/LEFT/RIGHT`)** combine opacity and offset movement using the subgroup slide distance.
- **FADE on input row**: on open it transitions from `alpha_input_closed` to full opacity; on close it returns to `alpha_input_closed` for `FADE` and `FADE_*`.
- **SCALE**: vertical pivot at the bottom edge of the control (`pivot_offset.y` = `size.y` or `slide_dist`). Uses `TRANS_BACK` easing when appearing and `TRANS_CUBIC` when hiding.
- **SLIDE** types: use `offset_*` properties (not `position`) so the animation respects anchored layouts.
- **Per-subgroup distances**:
  - `history_slide_distance` for History Panel.
  - `input_slide_distance` for Input Row.
  - `message_slide_distance` for History messages.
  - `notification_slide_distance` for Notification.
- **Forced close** (`_force_close`): kills both tweens immediately, snaps all properties to their closed state, and hides the autocomplete panel. Used when a session ends or `disable()` is called.

---

<!-- doc-shell:page slug="notifications" -->

## Floating notifications

Notifications appear in the bottom area of the screen when the chat panel is **closed** and a new message arrives (player or system). They also appear when `close_on_send` is `true` and the user has just sent a message.

- Up to `max_notifications` entries can be stacked on screen simultaneously. The oldest is removed immediately when the limit is exceeded.
- Each entry uses `notification_anim_type` and `notification_anim_duration` for its appearance animation.
- The exit always fades alpha to `0` over `0.4 s` regardless of `notification_anim_type`, then the node is freed.
- `notification_duration` controls how many seconds the notification stays at full opacity between appearing and fading out.

---

<!-- doc-shell:page slug="sounds" -->

## Sounds

Assign `AudioStream` resources to the sound properties in `EasyChatConfig`. All five are optional (`null` = silent).

| Property | When it plays |
|----------|--------------|
| `sound_message_received` | A non-local player message arrives. |
| `sound_system_message` | A system message is added. |
| `sound_message_sent` | The local player sends a message. |
| `sound_chat_opened` | The chat opens. |
| `sound_chat_closed` | The chat closes. |

All sounds share a single `AudioStreamPlayer` child node. If a new sound triggers before the previous one finishes, the previous sound is **interrupted**.

---

<!-- doc-shell:page slug="editor-preview" -->

## Editor preview

The node script runs `@tool`, enabling a full live preview workflow directly in the editor through the **Preview** section:

- Assigning or modifying the **config** resource updates the preview immediately via the `config.changed` signal.
- `_rebuild()` frees all UI children and rebuilds them from scratch, restoring the baseline preview state.
- `_ready()` in the editor only builds the preview; it does **not** register the singleton, set up multiplayer, or connect game signals.
- Changing `config` properties (colours, layout, animations, etc.) reflects in the viewport while editing.

### Preview section buttons and what each one does

#### Rebuild Preview

- **`Rebuild Preview`**: rebuilds the full UI and clears residual states from preview animations.

#### Visibility

- **`preview_history`**: show/hide the history panel.
- **`preview_input`**: show/hide the input row.
- **`preview_autocomplete`**: show/hide the autocomplete panel.
- **`preview_notification`**: show/hide the notification container.

#### Show-Hide Animations

- **`History Panel — Show`**: plays the same open animation used in-game for the history panel.
- **`History Panel — Hide`**: plays the same close animation used in-game for the history panel.
- **`Input Row — Show`**: plays the same open animation used in-game for the input row.
- **`Input Row — Hide`**: plays the same close animation used in-game for the input row.

#### Messages

- **`Local Message`**: appends a sample local message to history.
- **`Remote Message`**: appends a sample remote message to history.
- **`System Message`**: appends a sample system message.
- **`Clear History`**: clears all history lines.

#### Notifications

- **`Message Notification`**: spawns a sample regular notification.
- **`System Notification`**: spawns a sample system notification.

#### Commands

- **`Show Commands`**: populates autocomplete with all commands from `config.commands` and makes the panel visible for styling checks.

---

<!-- doc-shell:page slug="limitations" -->

## Limitations and conventions

1. **One active instance per scene** for the singleton: a second EasyChat node logs a **warning** and the singleton continues to delegate to the first one. Both nodes still render independently.
2. **RPC names are hard-coded**: `"easychat_message"` and `"easychat_system"` (must not collide with other systems in LinkUx).
3. **`usage` on `ChatCommand`** is not shown in the addon's autocomplete UI. Show it yourself in a `/help` command handler.
4. **Commands do not sync over the network**: only plain text messages are broadcast. Each client executes `/cmd` locally — only the client that typed the command fires `executed`.
5. **`EasyChat.is_enabled()`** reads the internal `_is_enabled` field of the active node directly. Keep this consistent if you subclass the node.
6. **No BBCode or rich text** in messages; history uses plain `Label` nodes. To enable rich text, change `_add_message` and `_add_system_message` to use `RichTextLabel` instead.
7. The root node does **not** add an input-blocking overlay layer; UX assumes that opening the chat is an explicit, visible action (cursor visible, inputs released).

---

<!-- doc-shell:page slug="scaling" -->

## Scaling chat in production

### Performance and memory

- Each message is a child `Label`; very high `max_messages` values increase layout work in the `VBoxContainer`. Keep it reasonable for the target platform (e.g. 50–100 for mobile).
- For **very high traffic** (e.g. MMO), consider **virtualising** the message list (reuse a fixed set of row controls) — this requires forking or extending `easychat_node.gd`.
- Autocomplete builds UI rows on every keystroke while the user is typing a command prefix; hundreds of commands are fine, but if you have many commands with short prefixes you may want to debounce or cache results.

### Multiplayer and moderation

- The addon has **no** rate limiting, anti-spam, or content filtering. Implement these layers in LinkUx, an authoritative server, or via the `message_received` signal.
- For **persistent history** or **chat rooms**, centralise the logic outside the node and drive the UI through `EasyChat.add_message` / `add_system_message`.

### Content and localisation

- `message_format`, `system_message_prefix`, and command strings live in the resource: duplicate `.tres` files per language or assign them at load time to support localisation.
- **BBCode** is not enabled on current labels; replace them with `RichTextLabel` in a subclass to support bold, colours, links, etc.

### Multiple chat contexts

The singleton assumes **one** active node. For different HUDs (lobby vs. match), unregister the old one when transitioning scenes, or avoid the global singleton and hold direct node references.

---

<!-- doc-shell:page slug="modifying" -->

## Modifying the addon internally

### Recommended extension points

- **Subclass the node**: extend `easychat_node.gd` and override `_add_message`, `_execute_command`, `_show_notification`, etc. without touching the original files.
- **Add config properties**: extend `EasyChatConfig` with new `@export`s and read them in your subclass. The base node will not break — it simply won't know about the new properties.
- **Change the LinkUx autoload name**: if your autoload is not `"LinkUx"`, edit `get_node_or_null("/root/LinkUx")` in `_setup_multiplayer` and update the expected signal names.

### Constants and RPC names

```gdscript
# In easychat_node.gd
const _RPC_NAME   := "easychat_message"
const _RPC_SYSTEM := "easychat_system"
```

Change these if they collide with other systems. Keep `register_rpc` and `broadcast_rpc` calls in sync.

### Notification layout

`_apply_layout()` calculates notification offsets relative to `input_top` with small hardcoded constants. Adjust these to move notifications higher, anchor them to the history panel, or use a different side of the screen.

### Duplicate commands in autocomplete

`_update_autocomplete` may add the same `ChatCommand` twice if both its `command_name` and an `alias` match the typed prefix. Override `_update_autocomplete` in a subclass to deduplicate.

### Editor plugin

If you change `preload` paths in `plugin.gd` (e.g. after moving the addon folder), update all `res://addons/easychat/…` references accordingly.

---

<!-- doc-shell:page slug="troubleshooting" -->

## Troubleshooting

| Symptom | Likely cause and fix |
|---------|---------------------|
| `EasyChat.*` calls do nothing | No **EasyChat** node in the scene, or `_register` never ran (load order, node disabled before `_ready`). Check that the node is in the tree and the plugin is enabled. |
| Two-instance warning in output | Two EasyChat nodes in one scene. Keep only one, or access each independently without the singleton. |
| Network chat does not send | LinkUx missing or not at `/root/LinkUx`; session not yet started; `multiplayer_enabled` is `false`. Check the output for an explicit error message. |
| Open key (`T`) does nothing | Another UI control is consuming the event first (`_unhandled_key_input` fires last). Also verify `_is_enabled` is `true` — call `EasyChat.enable()` from code. |
| Command not found / "Unknown command" | Typo in `command_name`, or the command is not in `config.commands` on the **actually assigned** resource (the node may be using the default config, not your `.tres`). |
| `executed` signal not firing | The command resource connected in code may not be the same object instance as the one in the config. Ensure you `preload` the exact same `.tres` path, or iterate through `chat.config.commands` to get the live reference. |
| No sound | Stream is `null` in the resource, or the audio format is not supported by `AudioStreamPlayer`. |
| Autocomplete not showing | The command is in the config but the typed prefix does not match `command_name` or any `alias`. Remember the match uses `begins_with`, not contains. |
| Chat invisible after `enable()` | The node's `visible` is set to `_is_enabled`. If you have a parent that is hidden, the node will also be hidden. Check the parent chain visibility. |

---

<!-- doc-shell:page slug="credits" -->

## Credits

- **EasyChat** — IUX Games, Isaackiux (version **2.1.1**).

---

*Detailed documentation created with love for developers.♥️*
