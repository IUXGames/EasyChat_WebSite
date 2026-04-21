<!-- doc-shell:page slug="overview" -->

# EasyChat

[![Godot 4](https://img.shields.io/badge/Godot-4.x-478cbf?logo=godotengine&logoColor=white)](https://godotengine.org/)
[![Version](https://img.shields.io/badge/version-1.1.0-5aafff)](./plugin.cfg)

**EasyChat** is a **Godot 4** addon that adds a reusable UI node for **in-game chat** and a **command console** with autocomplete. It works in **offline mode** (single player or no network session) and in **real-time multiplayer** when combined with the **LinkUx** addon, which abstracts LAN or online backends and keeps the same logical flow regardless of the active backend.


This document describes **every** piece of the addon, its exported properties, the singleton API, runtime behaviour, and guidance for **scaling** the system or **modifying** it internally.

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
- **`EasyChat` singleton** registered automatically when the plugin is enabled; global API to open/close, post messages, and set the player name.
- **`EasyChatConfig` resource**: appearance (panels, borders, radii, colours, fonts), behaviour (close on send, history limits, notifications), animations, layout, sounds, and command list.
- **`ChatCommand` resource**: name, aliases, description, documented usage, and `executed(args)` signal.
- **History** with a configurable limit; oldest messages are removed when the limit is exceeded.
- **Closed chat** without blocking gameplay: the root node uses `mouse_filter = IGNORE`, and only when the chat opens is the cursor forced visible and `InputMap` actions released.
- **Autocomplete** for commands when typing `/`, with keyboard navigation and mouse clicks.
- **Brief notification** when a message arrives while the panel is closed (or when sending with `close_on_send`), with configurable stack size and entry animation.
- **Optional multiplayer** via **LinkUx**: RPC registration, broadcast on send, local name from `LinkUx.get_local_player_name()`, visibility tied to session, and forced close when the session ends.

---

<!-- doc-shell:page slug="requirements" -->

## Requirements and dependencies

| Component | Required | Notes |
|-----------|----------|-------|
| **Godot 4.x** | Yes | The code uses Godot 4 syntax and APIs (e.g. `@export`, typed signals, `Tween`, etc.). |
| **LinkUx** | No | Only needed if `multiplayer_enabled` is enabled on the node and you want real-time network chat. The autoload **`/root/LinkUx`** must exist. |

Expected addon path in the project: `res://addons/easychat/` (consistent with `plugin.gd` and `preload` paths).

---

<!-- doc-shell:page slug="installation" -->

## Installation

1. Copy the addon folder into `res://addons/easychat/`.
2. Open the project in Godot 4.
3. Go to **Project → Project Settings → Plugins** and enable **EasyChat**.
4. When the plugin is enabled:
   - The **`EasyChat`** autoload is added pointing to `res://addons/easychat/easychat.gd`.
   - The **EasyChat** custom node type is registered in the add-node dialog.
5. (Optional for multiplayer) Install and configure **LinkUx** as an autoload with the name that addon exposes (EasyChat looks up `/root/LinkUx`).
6. Add an **EasyChat** node to the scene where you want chat (typically a `CanvasLayer` or full-screen UI root).

---

<!-- doc-shell:page slug="architecture" -->

## Addon architecture

| File | Role |
|------|------|
| `plugin.cfg` | Plugin metadata (name, version, plugin script). |
| `plugin.gd` | `EditorPlugin`: on enable/disable manages the autoload; on editor tree enter/exit registers the **EasyChat** type. |
| `easychat.gd` | **EasyChat** singleton: delegates to the active node instance. |
| `easychat_node.gd` | **EasyChat** node: UI, input, commands, animations, LinkUx integration. |
| `easychat_config.gd` | `class_name EasyChatConfig` — configuration resource. |
| `chat_command.gd` | `class_name ChatCommand` — per-command resource. |
| `icon.svg` | Node and script icon in the editor. |

**Registration flow:** in the node’s `_ready()` (in-game only, not in the editor), the node calls `EasyChat._register(self)` if `/root/EasyChat` exists. On tree exit it calls `_unregister`. Only **one** “active” instance per scene delegates to the singleton; a second instance logs a **warning** and is ignored.

**Group:** the node is added to group `"easychat"` (useful for queries or tools).

---

<!-- doc-shell:page slug="first-use" -->

## First-time use step by step

### Offline only / without LinkUx

1. Enable the **EasyChat** plugin (see [Installation](#installation)).
2. In your game scene (e.g. `main.tscn`), add an **EasyChat** node as a child of a `CanvasLayer` or full-screen container.
3. Leave **`multiplayer_enabled`** as `false` (default).
4. Run the scene: press **Open chat** (default `T`); **Escape** closes (or closes the suggestion list if open).
5. Type text and press **Enter** or the send button (if visible) to send a chat message.
6. For commands, type `/commandname` followed by space-separated arguments.

### Local player name (offline)

- From code, once the node is in the tree: `EasyChat.set_player_name("YourNick")`.
- That name replaces `{sender}` in messages you send in non-multiplayer mode (or when LinkUx does not update the name).

### Multiplayer (LinkUx)

1. Install and register **LinkUx** as an autoload (`/root/LinkUx` must resolve).
2. On the **EasyChat** node, enable **`multiplayer_enabled`**.
3. Start a session with LinkUx per that addon’s docs; EasyChat registers the RPC when the session is active and uses `get_local_player_name()` for the sender.
4. Plain text messages (not commands) are **broadcast** over the network; the local sender also sees their line in history.

### Shared configuration resource

1. In the FileSystem dock, create an **EasyChatConfig** (`.tres`) or duplicate an existing one.
2. Adjust appearance, sounds, commands, etc.
3. Assign it to the **`config`** field on the **EasyChat** node in the inspector.
4. Reuse the same `.tres` across scenes for a consistent look.

### Defining commands

1. Create one or more **ChatCommand** (`.tres`) resources.
2. Fill **`command_name`**, optionally **`aliases`**, **`description`** (shown in autocomplete), and **`usage`** (for your own help screens; the autocomplete UI shows **description**, not **usage**).
3. Add those resources to the **`commands`** array inside your **EasyChatConfig** (or the default config if you do not use an external `.tres`).
4. In game logic, `command.executed.connect(_on_my_command)` for each resource (or connect from a script that loads the same `.tres` reference).

---

<!-- doc-shell:page slug="node-easychat" -->

## `EasyChat` node (Control)

The node is a full-screen `Control` (`PRESET_FULL_RECT`): it anchors the chat layout to the bottom of the view. In-game `_ready()` builds the entire UI in code (history, scroll, message list, autocomplete panel, notification, input row, audio player).

### Exported properties (inspector)

#### `config` — `EasyChatConfig` (optional)

- Resource holding **all** visual and behavioural customisation.
- If empty at runtime, the node creates `EasyChatConfig.new()` with defaults.
- In the **editor**, assigning or changing the resource reconnects the resource’s `changed` signal to refresh the preview.

#### **Multiplayer** group

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `multiplayer_enabled` | `bool` | `false` | If `true`, chat uses **LinkUx** for RPCs and player name. If LinkUx is missing, an **error** is logged and network behaviour is inactive. |

#### **Controls** group

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `open_key` | `Key` | `KEY_T` | Key to **open** chat (handled in `_unhandled_key_input` while closed). Replaces `{key}` in the input placeholder. |
| `close_key` | `Key` | `KEY_ESCAPE` | While **open**: closes the suggestion panel if visible; otherwise **closes** chat. Handled in `_input` so the event can be consumed early. |

### Public node API (runtime)

For scripts that hold a direct reference to the node:

| Method | Behaviour |
|--------|-----------|
| `is_open() -> bool` | `true` if the player has the chat open (history panel / active animation). |
| `enable()` | Marks chat enabled and updates visibility (`visible = true` per internal rules). |
| `disable()` | If open, forces close; clears history; disables and hides the node. |
| `clear_history()` | Removes all children from the message list. |
| `set_player_name(name: String)` | Sets the local player name used as sender when applicable. |

**Note:** Most games will use the **`EasyChat` singleton** API, which delegates to this instance when registered.

---

<!-- doc-shell:page slug="config-resource" -->

## `EasyChatConfig` resource

`class_name EasyChatConfig` extends `Resource`. It groups inspector options in `@export_group` / `@export_subgroup` blocks.

### `AnimType` enum

Used to animate the **history panel** and **input row**.

| Value | Meaning |
|-------|---------|
| `NONE` | Instant show/hide (no transition). |
| `FADE` | Fade using opacity (`modulate.a`). For the input row when closed, a residual opacity may remain (`alpha_input_closed`). |
| `SLIDE_UP` | Enters from below (positive Y offset); exits downward when closing. |
| `SLIDE_DOWN` | Enters from above; exits upward when closing. |
| `SLIDE_LEFT` | Enters from the left; exits left when closing. |
| `SLIDE_RIGHT` | Enters from the right; exits right when closing. |
| `SCALE` | Vertical scale from near zero to 1 with pivot at the bottom edge; `BACK` easing when showing, `CUBIC` when hiding. |

Slide and scale distances use `panel_height` for history and `input_height` for the input row.

### **Appearance** group

#### **History** subgroup (message panel)

| Property | Type | Default (summary) | Use |
|----------|------|-------------------|-----|
| `history_bg_color` | `Color` | Dark semi-transparent | Panel background. |
| `history_corner_tl`, `history_corner_tr`, `history_corner_bl`, `history_corner_br` | `int` | 6, 6, 0, 0 | Corner radii in pixels. |
| `history_border_*` | `int` | 0 | Border width per side; 0 disables. |
| `history_border_color` | `Color` | Grey semi-transparent | Border colour if any width > 0. |

#### **Autocomplete** subgroup

| Property | Type | Use |
|----------|------|-----|
| `autocomplete_bg_color` | `Color` | Suggestion panel background. |
| `autocomplete_selected_color` | `Color` | Highlighted row (keyboard or hover). |
| `autocomplete_command_color` | `Color` | `/command` name text. |
| `autocomplete_desc_color` | `Color` | Description text. |
| `autocomplete_font_size` | `int` | Font size in the list. |
| `autocomplete_font` | `Font` | Optional custom font for command and description labels. |
| `autocomplete_corner_*` | `int` | Panel corner radii. |
| `autocomplete_border_*` | `int` | Borders per side. |
| `autocomplete_border_color` | `Color` | Border colour. |

#### **Input** (`LineEdit`) subgroup

| Property | Type | Use |
|----------|------|-----|
| `input_bg_color`, `input_focus_color` | `Color` | Normal and focused background. |
| `input_border_color`, `input_focus_border_color` | `Color` | Normal and focused border. |
| `input_corner_*` | `int` | Radii (defaults rounded at bottom). |
| `input_border_*` | `int` | Width per side. |
| `input_font_size` | `int` | Typed text size. |
| `input_font` | `Font` | Optional custom font for typed text and placeholder. |
| `input_caret_color` | `Color` | Caret colour. |
| `input_placeholder_color` | `Color` | Placeholder colour. |
| `input_placeholder_text` | `String` | Placeholder; `{key}` replaced with `open_key` display name. |

#### **Send Button** subgroup

| Property | Type | Use |
|----------|------|-----|
| `send_button_text` | `String` | Label (default return symbol). |
| `send_button_bg_color`, `send_button_hover_color` | `Color` | Normal and hover/pressed. |
| `send_button_text_color` | `Color` | Text colour. |
| `send_button_font_size` | `int` | Font size. |
| `send_button_font` | `Font` | Optional custom font for the send button label. |
| `send_corner_*` | `int` | Button radii. |
| `send_border_*` | `int` | Borders. |
| `send_border_color`, `send_border_hover_color` | `Color` | Normal and hover/pressed border. |

#### **Messages** subgroup (history)

| Property | Type | Use |
|----------|------|-----|
| `message_font_size` | `int` | Size for player and system messages. |
| `message_font` | `Font` | Optional custom font for history message labels. |
| `message_format` | `String` | Template with `{sender}` and `{message}`. |
| `local_message_color` | `Color` | Local player messages (`is_local == true`). |
| `remote_message_color` | `Color` | Other players or lines received over the network. |
| `system_message_color` | `Color` | System messages. |
| `system_message_prefix` | `String` | Prefix before text (default `▶ `). |

#### **Notification** subgroup

| Property | Type | Use |
|----------|------|-----|
| `notification_color` | `Color` | Floating text colour. |
| `notification_bg_color` | `Color` | Panel background (alpha 0 hides background). |
| `notification_corner_*` | `int` | Radii. |
| `notification_border_*` | `int` | Borders. |
| `notification_border_color` | `Color` | Border colour. |
| `notification_font_size` | `int` | Text size. |
| `notification_font` | `Font` | Optional custom font for notification text. |

### **Behavior** group

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `show_send_button` | `bool` | `true` | Show or hide the send button. |
| `close_on_send` | `bool` | `false` | After sending a message **or** running a command, closes chat; last sent message may show in the notification. |
| `alpha_input_closed` | `float` | `0.35` | Input row opacity when chat is closed if animation is `FADE` or `NONE`. |
| `notification_alpha` | `float` | `0.75` | Maximum notification panel opacity during fade in. |
| `notification_duration` | `float` | `3.0` | Seconds visible before fade out. |
| `max_messages` | `int` | `100` | Max lines in history; oldest removed when exceeded. |
| `max_suggestions_visible` | `int` | `6` | Max autocomplete rows before scrolling inside the panel. |
| `max_notifications` | `int` | `3` | Max floating notifications visible at once; oldest is removed when exceeded. |

### **Animations** group

#### **History Panel** subgroup

| Property | Type | Default |
|----------|------|---------|
| `history_anim_type` | `AnimType` | `FADE` |
| `history_anim_duration` | `float` | `0.18` s |

#### **Input Row** subgroup

| Property | Type | Default |
|----------|------|---------|
| `input_anim_type` | `AnimType` | `FADE` |
| `input_anim_duration` | `float` | `0.18` s |

For **SLIDE** and **SCALE**, when chat is closed the input row is **fully hidden** (not merely dimmed).

#### **Notification** subgroup

| Property | Type | Default |
|----------|------|---------|
| `notification_anim_type` | `AnimType` | `FADE` |
| `notification_anim_duration` | `float` | `0.15` s |

### **Layout** group

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `panel_width` | `float` | `415` | Width of the chat block (history + input aligned). |
| `panel_height` | `float` | `206` | History area height. |
| `input_height` | `float` | `42` | Input row height (and slide/scale reference for that row). |
| `send_button_width` | `float` | `52` | Minimum send button width. |
| `panel_margin_left` | `float` | `10` | Left margin from the viewport. |
| `panel_margin_bottom` | `float` | `10` | Bottom margin. |
| `suggestion_item_height` | `float` | `28` | Height of each autocomplete row. |

**Notification** panel offsets are partly hard-coded in `_apply_layout()` (spacing relative to the input row); for more control see [Modifying the addon internally](#modifying-the-addon-internally).

### Sounds group

All are optional `AudioStream` (`null` = silent).

| Property | When it plays |
|----------|----------------|
| `sound_message_received` | Message from another player (non-local). |
| `sound_system_message` | System message added to history. |
| `sound_message_sent` | Local player sends a chat message. |
| `sound_chat_opened` | Chat opens. |
| `sound_chat_closed` | Chat closes. |

Playback uses a single child `AudioStreamPlayer` (a new sound may interrupt the previous one).

### **Commands** group

| Property | Type | Description |
|----------|------|-------------|
| `commands` | `Array[ChatCommand]` | Commands available for `/` and autocomplete. |

---

<!-- doc-shell:page slug="chatcommand-resource" -->

## `ChatCommand` resource

`class_name ChatCommand` extends `Resource`.

| Member | Type | Description |
|--------|------|-------------|
| `executed` | `signal executed(args: Array)` | Emitted when the command runs with argument tokens after the name. |
| `command_name` | `String` | Primary name after `/` (**case-insensitive** match). |
| `aliases` | `PackedStringArray` | Alternate names, also matched case-insensitively. |
| `description` | `String` | Text in the autocomplete panel next to the command name. |
| `usage` | `String` | Exported for your own help UI; **the addon does not show** this in suggestions (only `description`). |

**Parsing:** `/cmd arg1 arg2` splits on spaces; the first token (without `/`) is the command name; the rest are passed as `args` when emitting `executed`.

---

<!-- doc-shell:page slug="singleton" -->

## Global `EasyChat` singleton

Registered by `plugin.gd` as an autoload. Facade when you do not have a direct node reference.

| Method | Behaviour |
|--------|-----------|
| `enable()` | Same as node: enable and show per internal rules. |
| `disable()` | Close, clear history, disable and hide. |
| `is_open() -> bool` | Whether a node is registered and open. |
| `is_enabled() -> bool` | Whether a node is registered and `_is_enabled` is true (singleton reads the active node). |
| `clear_history()` | Clears the active node’s history. |
| `add_message(sender, text)` | Adds a **remote**-styled message (`remote_message_color`), not from local input. |
| `add_system_message(text)` | Adds a system message with prefix and system colour. |
| `set_player_name(name)` | Delegates to the node (offline / base local name). |

If no valid instance is registered, calls are no-ops except `is_open` / `is_enabled`, which return `false`.

---

<!-- doc-shell:page slug="signals" -->

## Signals

### On the `EasyChat` node and re-emitted on the singleton

| Signal | Parameters | When |
|--------|------------|------|
| `chat_opened` | — | After opening starts (animations, sound, deferred focus). |
| `chat_closed` | — | After normal close or forced close (session ended, `disable`, etc.). |
| `message_received` | `sender: String`, `message: String` | For **each** message added via `_add_message` (local or remote), **after** UI and sound updates. **Not** emitted for system-only messages (`_add_system_message` does not hook this signal). |

Connect from any script:

```gdscript
EasyChat.message_received.connect(_on_chat_message)

func _on_chat_message(sender: String, message: String) -> void:
    pass
```

---

<!-- doc-shell:page slug="keyboard" -->

## Keyboard input and focus

- **Open:** `open_key` in `_unhandled_key_input` only if chat is closed and enabled.
- **Close / suggestions:** `close_key` in `_input` while open (closes autocomplete first if visible).
- **Suggestions visible:** **Up/Down** navigate; **Tab** applies the selected suggestion (or the first if none selected).
- **On open:** stores `Input.mouse_mode`, forces `MOUSE_MODE_VISIBLE`, calls `Input.action_release` for **all** `InputMap` actions (avoids “stuck” keys).
- **On close:** restores previous mouse mode.
- Send button uses `focus_mode = FOCUS_NONE` to keep focus on `LineEdit`.
- Root node uses `mouse_filter = IGNORE` so it does not steal game clicks when the overlay should not capture them; children set their own filters as needed.

---

<!-- doc-shell:page slug="messages" -->

## Messages, formatting and colours

- **Format:** `message_format` with `{sender}` and `{message}`.
- **Local vs remote:** messages you send use `local_message_color`; network lines or injections via `add_message` are **remote** for colouring (singleton `add_message` calls `_add_message(..., false)`).
- **Limit:** at `max_messages`, the oldest list child is `queue_free`d.
- **Scroll:** when adding a message with chat open, scrolls to bottom on the next frame.
- **Chat closed:** incoming player or system messages also show a **notification** in addition to history.

---

<!-- doc-shell:page slug="commands" -->

## Commands (`/`) and autocomplete

- Any line **starting with** `/` is treated as a command; it is **not** sent as player chat.
- If no `ChatCommand` matches, a system message appears: `Unknown command: /name`.
- If `close_on_send` is `true`, the chat **closes** after a command (same as after a normal message).
- **Autocomplete:** typing `/` and text with no space in the first token filters commands whose `command_name` or any `alias` **starts with** the lowercase prefix.
- The same command may appear **more than once** in the filtered list if both name and alias match (current loop behaviour).
- Suggestion panel height uses `mini(matches, max_suggestions_visible) * suggestion_item_height + 6`.
- Row click or **Tab** fills `/commandname ` in the field and closes the panel.

---

<!-- doc-shell:page slug="multiplayer" -->

## Multiplayer with LinkUx

EasyChat does not implement networking itself: it delegates to **LinkUx** when `multiplayer_enabled` is `true`.

### Expected LinkUx contract (from code usage)

The node does `get_node_or_null("/root/LinkUx")` and uses:

| API used | Purpose |
|----------|---------|
| `session_started` (signal) | Register RPC, refresh local name and visibility. |
| `session_closed` (signal) | Force-close chat and update visibility. |
| `is_in_session() -> bool` | Whether to register RPC and broadcast on send. |
| `get_local_player_name() -> String` | Local sender name; if non-empty, replaces `_local_player_name`. |
| `register_rpc(rpc_name: String, callable: Callable)` | Registers chat handler (internal name `easychat_message`). |
| `broadcast_rpc(rpc_name: String, args: Array, reliable: bool)` | Sends `[sender, text]` to peers; code passes `true` for reliable delivery. |

### Send flow

- Message **without** `/`: if in session with valid LinkUx, `broadcast_rpc("easychat_message", [sender, text], true)` plus `_add_message(sender, text, true)` locally.
- **Remote** message: registered callable hits `_on_chat_rpc(_from_peer, sender, message)` and adds a non-local line.

### Node visibility with multiplayer

- `_update_visibility()` sets `visible = _is_enabled` (it does not force visible merely because a session exists; call `enable()` or keep the node enabled per your flow).
- If the session ends while chat is open, `_force_close()` runs (no long animations: resets panels and emits `chat_closed`).

### Common errors

- `multiplayer_enabled` without LinkUx autoload: **error** in the output and no message sync.

---

<!-- doc-shell:page slug="animations" -->

## Animations

- History and input row use **independent tweens** on open/close; reopening `kill()`s the previous tween if present.
- **FADE** on input: opens from `alpha_input_closed` (or 0 when not applicable); closes back to `alpha_input_closed` for FADE, or 0 for other types.
- **SCALE** on history/input: vertical pivot at the bottom (`pivot_offset` from `size.y` or `slide_dist`).
- **Forced close** (`_force_close`): kills tweens, resets position/scale/opacity and autocomplete state.

---

<!-- doc-shell:page slug="notifications" -->

## Floating notifications

- `_show_notification` can keep multiple entries on screen, up to `max_notifications`.
- Each new entry uses `notification_anim_type` and `notification_anim_duration` for its appear transition (`FADE`, `SLIDE_*`, or `SCALE`), then stays visible for `notification_duration`.
- Exit is still handled by fading the entry alpha back to 0 before freeing it.
- Used when chat is **closed** and a player/system message arrives, and when `close_on_send` shows the last sent line while closing.

---

<!-- doc-shell:page slug="sounds" -->

## Sounds

See [**Sounds** group](#config-resource/sounds-group) under `EasyChatConfig`. Long streams still share one player.

---

<!-- doc-shell:page slug="editor-preview" -->

## Editor preview

The node script is `@tool`. In the editor:

- If `config` exists, `config.changed` refreshes layout/theme/properties.
- `_rebuild()` frees children, rebuilds UI, and leaves chat **open** for inspection.
- Editor `_ready()` does not register the singleton or multiplayer; it only builds preview.

---

<!-- doc-shell:page slug="limitations" -->

## Limitations and conventions

1. **One active instance per scene** for the singleton: a second instance **warns** and does not replace the first.
2. **RPC name** is hard-coded: `"easychat_message"` (must not collide in LinkUx).
3. **`usage` on `ChatCommand`** does not appear in addon autocomplete.
4. **Commands** are not synced over the network in current code: only plain text via `broadcast_rpc`. Command logic runs **locally** on the client that typed `/`.
5. **Singleton `is_enabled()`** reads the node’s `_is_enabled` (internal convention; keep consistent if you extend the node).
6. The root node does **not** add an extra global input-blocking layer; UX assumes opening chat shows the cursor and releases actions.

---

<!-- doc-shell:page slug="scaling" -->

## Scaling chat in production

### Performance and memory

- Raise `max_messages` only as needed: each message is a child `Label`; very high values cost layout work in the `VBoxContainer`.
- For **very high traffic**, consider:
  - **Virtualisation** (replace `Label` list with a reusable-row control) — requires a fork or extension.
  - A tighter **sliding window** (limit already exists; lower `max_messages` on consoles/mobile).
- **Autocomplete:** `max_suggestions_visible` and `suggestion_item_height` affect how many rows are built per keystroke; many commands are fine until filters return dozens of visible rows.

### Multiplayer and moderation

- The addon has **no** rate limiting, anti-spam, or content validation: add layers in LinkUx, an authoritative server, or via `message_received` / your own rules.
- For **persistent history** or **rooms**, centralise logic outside the node and drive UI with `EasyChat.add_message` / `add_system_message`.
- With **many players**, cost is usually in the backend and broadcast policy, not only this widget.

### Content and localisation

- `message_format`, prefixes, and command strings live in the resource: duplicate `.tres` per language or assign at load time.
- **BBCode** is not enabled on current `Label`s; rich text requires changing node types in `_add_message` / `_add_system_message`.

### Multiple chats or contexts

- The singleton assumes **one** active node per scene: for different HUDs (lobby vs match), **unregister** the old one when changing scenes or avoid the global singleton.

---

<!-- doc-shell:page slug="modifying" -->

## Modifying the addon internally

### Recommended extension points

- **Subclass the node:** extend `easychat_node.gd` (or copy into your project) and change `custom_type` in a fork, or add the node by script. Override `_add_message`, `_execute_command`, etc., without editing the original.
- **`EasyChatConfig` resource:** add new `@export`s and read them in your subclass if you duplicate the node; the base resource will not apply unknown fields in `_apply_theme` / `_apply_layout`.
- **LinkUx:** if the autoload is not `LinkUx`, change `get_node_or_null("/root/LinkUx")` and expected signals in `_setup_multiplayer`.

### Constants and RPC

- `_RPC_NAME := "easychat_message"` in `easychat_node.gd`: change if it collides; keep `register_rpc` / `broadcast_rpc` in sync.

### Notification layout

- `_apply_layout()` notification offsets use `input_top` and constants (`-3`, `-46`): tweak for higher bubbles or anchoring to history.

### Duplicate commands in autocomplete

- `_update_autocomplete` may append the same `ChatCommand` twice when name and alias both match; dedupe in a subclass by overriding `_update_autocomplete`.

### Editor

- If you change `preload` paths in `plugin.gd`, keep `res://addons/easychat/...` or update the plugin.

---

<!-- doc-shell:page slug="troubleshooting" -->

## Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| `EasyChat.*` does nothing | No **EasyChat** node in the current scene or `_register` never ran (load order, node disabled before `_ready`). |
| Two-instance warning | Two EasyChat nodes in one scene; keep one or do not drive both via the singleton. |
| Network chat does not send | LinkUx missing or autoload not `/root/LinkUx`; session not started (`is_in_session` false); check console for explicit error. |
| Open key does nothing | Another UI consumes the event first; `open_key` uses `_unhandled_key_input`. Ensure `_is_enabled` is true. |
| Command not found | Wrong name, typo, or command not in `config.commands` on the **actually assigned** resource. |
| No sound | Null stream in resource or unsupported format for `AudioStreamPlayer`. |

---

<!-- doc-shell:page slug="credits" -->

## Credits

- **EasyChat** — IUX Games, Isaackiux (version **1.1.0**).

---

*Detailed documentation created with love for developers.♥️*
