// Set de fotos oficial FTF ("Photo Set for Inspection"): 18 fotos en orden fijo.
// Generales = una vez por empaque; por variedad = obligatorias para cada variedad.
// El tag va a inspection_photos.header_tag (VARCHAR(30)).
export const PHOTO_SET = [
  { n: 1,  tag: 'pallet_condition',     es: 'Condición del pallet',        en: 'Pallet Condition',       group: 'general' },
  { n: 2,  tag: 'box_label',            es: 'Etiqueta de caja',            en: 'Box Label',              group: 'general' },
  { n: 3,  tag: 'tag_id',               es: 'Tag ID (etiqueta origen)',    en: 'Tag ID (Origin Label)',  group: 'general' },
  { n: 4,  tag: 'box_label_pti',        es: 'Etiqueta de caja (PTI)',      en: 'Box Label (PTI)',        group: 'general' },
  { n: 5,  tag: 'clamshell_label',      es: 'Etiqueta del clamshell',      en: 'Clamshell Label',        group: 'general' },
  { n: 6,  tag: 'upc',                  es: 'UPC',                         en: 'UPC',                    group: 'general' },
  { n: 7,  tag: 'tape',                 es: 'Cinta (tape)',                en: 'Tape',                   group: 'general' },
  { n: 8,  tag: 'clamshell_appearance', es: 'Apariencia del clamshell',    en: 'Clamshell Appearance',   group: 'variety' },
  { n: 9,  tag: 'tray_appearance',      es: 'Apariencia en bandeja',       en: 'Tray Appearance',        group: 'variety' },
  { n: 10, tag: 'clamshell_weight',     es: 'Peso del clamshell',          en: 'Clamshell Weight',       group: 'variety' },
  { n: 11, tag: 'temperature',          es: 'Temperatura',                 en: 'Temperature',            group: 'variety' },
  { n: 12, tag: 'size_min_max',         es: 'Tamaño (mín y máx)',          en: 'Size (Min & Max)',       group: 'variety' },
  { n: 13, tag: 'low_size_weight',      es: 'Peso bajo calibre (harnero)', en: 'Low-Size Weight (Sieve)', group: 'variety' },
  { n: 14, tag: 'baxlo',                es: 'Baxlo (mín, máx y moda)',     en: 'Baxlo (Min, Max, Mode)', group: 'variety' },
  { n: 15, tag: 'quality_defects',      es: 'Defectos de calidad',         en: 'Quality Defects',        group: 'variety' },
  { n: 16, tag: 'condition_defects',    es: 'Defectos de condición',       en: 'Condition Defects',      group: 'variety' },
  { n: 17, tag: 'brix',                 es: 'Brix',                        en: 'Brix',                   group: 'variety' },
  { n: 18, tag: 'pulp_condition',       es: 'Condición de pulpa',          en: 'Pulp Condition',         group: 'variety' },
]

export const photoSetKey = (tag) => `header.${tag}`
