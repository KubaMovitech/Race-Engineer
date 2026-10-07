#!/bin/sh
cd "$(dirname "$0")"
{
echo '<title>Data Engineer</title>'
echo '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
echo '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Titillium+Web:wght@400;600;700&family=JetBrains+Mono:wght@400;600;700&family=Barlow+Condensed:wght@600;700&display=swap">'
echo '<style>'; cat style.css; echo '</style>'
cat body.html
echo '<script>'; cat core.js charts.js ui1.js ui6.js ui3.js ui4.js ui5.js ui7.js ui8.js ui9.js ui10.js ui12.js ui13.js ui14.js ui15.js ui16.js i18n_dict.js ui11.js ui17.js ui18.js ui19.js ui20.js ui21.js ui2.js; echo '</script>'
} > pitwall.html
{ echo '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>'; cat pitwall.html; echo '</body></html>'; } > test.html
