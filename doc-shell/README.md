# doc-shell (EasyChat)

La documentación vive en **dos archivos Markdown**, uno por idioma:

- `content/es/docs.md`
- `content/en/docs.md`

## Formato de divisiones (páginas virtuales)

Cada bloque que debe mostrarse como **página** del sitio empieza con una línea de comentario HTML **en su propia línea**, inmediatamente antes del contenido Markdown de esa página:

```html
<!-- doc-shell:page slug="installation" -->
```

Reglas:

1. **`slug`** debe coincidir con un id usado en `nav.json` (misma cadena que en la URL hash, p. ej. `#installation`).
2. Puede haber **varios** marcadores en el mismo archivo; el contenido de cada página va desde un marcador hasta el siguiente (o hasta el final del archivo).
3. La primera página suele usar `slug="overview"`.
4. Los comentarios no se ven al renderizar Markdown en el sitio (el motor los ignora en la salida visible).

Ejemplo mínimo:

```markdown
<!-- doc-shell:page slug="overview" -->

# Mi proyecto

Introducción breve.

<!-- doc-shell:page slug="installation" -->

## Instalación

Pasos...
```

## Navegación lateral

El archivo `nav.json` define **grupos** y la lista ordenada de `slug` por grupo. Debe ser coherente con los `slug` presentes en `docs.md`.

## Herramienta opcional `build_docs.py`

Si recuperas copias monolíticas `content/README.es.md` y `content/README.en.md` (misma estructura que antes: secciones `##`, sin tabla de contenidos en el cuerpo o con ella), puedes regenerar los `docs.md` con marcadores:

```bash
cd webSite
python doc-shell/tools/build_docs.py
```

Tras generar, revisa y edita **`docs.md`** como fuente única; puedes borrar los README auxiliares si ya no los necesitas.

## Sitio estático

El `index.html` carga `content/{lang}/docs.md` una vez por idioma, parte el texto por los marcadores anteriores y muestra la sección activa según el hash (`#slug` o `#slug/heading-id`).
