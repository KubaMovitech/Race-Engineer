#!/bin/sh
cd "$(dirname "$0")"
{
echo '<title>Data Engineer</title>'
echo '<style>'; cat fonts.css style.css theme.css skin.css pro.css; echo '</style>'
cat body.html
echo '<script>'; cat core.js charts.js ui1.js ui6.js ui3.js ui4.js ui5.js ui7.js ui8.js ui9.js ui10.js ui12.js ui13.js ui14.js ui15.js ui16.js i18n_dict.js ui11.js ui17.js ui18.js ui19.js ui20.js ui21.js ui22.js ui23.js ui24.js ui25.js ui26.js ui27.js ui28.js ui29.js ui30.js ui31.js ui32.js ui33.js bop_data.js ui34.js ui35.js ui36.js ui37.js ui38.js ui39.js ui40.js ui41.js ui42.js ui43.js ui44.js ui2.js; echo '</script>'
} > pitwall.html
{ echo '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>'; cat pitwall.html; echo '</body></html>'; } > test.html
