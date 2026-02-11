export const berriesTemplates = {
  BLUEBERRY: {
    name: 'Standard Blueberries',
    version: 1,
    fields: [
      // Quality defects
      { key: 'quality.dust', label: 'Dust (%)', field_type: 'number' },
      { key: 'quality.contamination', label: 'Contamination (%)', field_type: 'number' },
      { key: 'quality.size_note', label: 'Size (nota 1-3)', field_type: 'select', options: ['1', '2', '3'] },
      { key: 'quality.size_consistency_note', label: 'Size Consistency (nota 1-2)', field_type: 'select', options: ['1', '2'] },
      { key: 'quality.bloom_pct', label: 'Bloom (%)', field_type: 'number' },
      { key: 'quality.russet_scars', label: 'Russet/Scars (%)', field_type: 'number' },
      { key: 'quality.no_bloom', label: 'No/Low Bloom (%)', field_type: 'number' },
      { key: 'quality.attached_stems', label: 'Attached Stems (%)', field_type: 'number' },
      { key: 'quality.flower_remains', label: 'Flower Remains (%)', field_type: 'number' },
      { key: 'quality.undersize', label: 'Undersize (%)', field_type: 'number' },
      { key: 'quality.lack_of_color', label: 'Lack of Color (%)', field_type: 'number' },

      // Condition / defects
      { key: 'condition.decay', label: 'Decay (%)', field_type: 'number' },
      { key: 'condition.decay_incidence', label: 'Decay Incidence (0-10)', field_type: 'number' },
      { key: 'condition.mold', label: 'Mold (%)', field_type: 'number' },
      { key: 'condition.mold_incidence', label: 'Mold Incidence (0-10)', field_type: 'number' },
      { key: 'condition.mold_type', label: 'Mold Type', field_type: 'select', options: ['Spot', 'Nest', 'Other'] },

      { key: 'condition.soft', label: 'Soft (%)', field_type: 'number' },
      { key: 'condition.sensitive', label: 'Sensitive (%)', field_type: 'number' },
      { key: 'condition.shriveling', label: 'Shriveling (%)', field_type: 'number' },
      { key: 'condition.broken_skin', label: 'Broken Skin (%)', field_type: 'number' },
      { key: 'condition.wounds', label: 'Wounds (%)', field_type: 'number' },
      { key: 'condition.crushed', label: 'Crushed (%)', field_type: 'number' }
    ]
  },

  BLACKBERRY: {
    name: 'Standard Blackberries',
    version: 1,
    fields: [
      { key: 'quality.immature', label: 'Immature (%)', field_type: 'number' },
      { key: 'quality.dust', label: 'Dust (%)', field_type: 'number' },
      { key: 'quality.white_cells', label: 'White Cells (%)', field_type: 'number' },
      { key: 'quality.green_tip', label: 'Green Tip (%)', field_type: 'number' },
      { key: 'quality.undersize', label: 'Undersize (%)', field_type: 'number' },

      { key: 'condition.soft', label: 'Soft (%)', field_type: 'number' },
      { key: 'condition.sensitive', label: 'Sensitive (%)', field_type: 'number' },
      { key: 'condition.shriveling', label: 'Shriveling (%)', field_type: 'number' },
      { key: 'condition.red_cells', label: 'Red Cells (%)', field_type: 'number' },
      { key: 'condition.dry_cells', label: 'Dry Cells (%)', field_type: 'number' },
      { key: 'condition.leaking', label: 'Leaking (%)', field_type: 'number' },
      { key: 'condition.decay', label: 'Decay (%)', field_type: 'number' },
      { key: 'condition.mold', label: 'Mold (%)', field_type: 'number' },
      { key: 'condition.crushed', label: 'Crushed (%)', field_type: 'number' },
      { key: 'condition.overripe', label: 'Overripe (%)', field_type: 'number' },
      { key: 'condition.freezing_damage', label: 'Freezing Damage (%)', field_type: 'number' },
      { key: 'condition.mechanical_damage', label: 'Mechanical Damage (%)', field_type: 'number' }
    ]
  },

  RASPBERRY: {
    name: 'Standard Raspberries',
    version: 1,
    fields: [
      { key: 'quality.inmature', label: 'Inmature (%)', field_type: 'number' },
      { key: 'quality.shriveling', label: 'Shriveling (%)', field_type: 'number' },
      { key: 'quality.white_cells', label: 'White Cells (%)', field_type: 'number' },
      { key: 'quality.broken_cells', label: 'Broken Cells (%)', field_type: 'number' },

      { key: 'condition.water_cells', label: 'Water Cells (%)', field_type: 'number' },
      { key: 'condition.sun_burn', label: 'Sun Burn (%)', field_type: 'number' },
      { key: 'condition.crushed', label: 'Crushed (%)', field_type: 'number' },
      { key: 'condition.leaking', label: 'Leaking (%)', field_type: 'number' },
      { key: 'condition.decay', label: 'Decay (%)', field_type: 'number' },
      { key: 'condition.mold', label: 'Mold (%)', field_type: 'number' },
      { key: 'condition.overripe_too_dark', label: 'Overripe / Too Dark (%)', field_type: 'number' },
      { key: 'condition.freezing_damage', label: 'Freezing Damage (%)', field_type: 'number' },
      { key: 'condition.mechanical_damage', label: 'Mechanical Damage (%)', field_type: 'number' }
    ]
  },

  REDCURRANT: {
    name: 'Standard Red Currants',
    version: 1,
    fields: [
      { key: 'quality.immature', label: 'Immature (%)', field_type: 'number' },
      { key: 'quality.dust', label: 'Dust (%)', field_type: 'number' },
      { key: 'quality.scars', label: 'Scars (%)', field_type: 'number' },
      { key: 'quality.russet', label: 'Russet (%)', field_type: 'number' },
      { key: 'quality.undersize', label: 'Undersize (%)', field_type: 'number' },

      { key: 'condition.soft', label: 'Soft (%)', field_type: 'number' },
      { key: 'condition.shriveling', label: 'Shriveling (%)', field_type: 'number' },
      { key: 'condition.crushed', label: 'Crushed (%)', field_type: 'number' },
      { key: 'condition.bird_peck', label: 'Bird Peck (%)', field_type: 'number' },
      { key: 'condition.decay', label: 'Decay (%)', field_type: 'number' },
      { key: 'condition.mold', label: 'Mold (%)', field_type: 'number' },
      { key: 'condition.bruises', label: 'Bruises (%)', field_type: 'number' },
      { key: 'condition.overripe', label: 'Overripe (%)', field_type: 'number' },
      { key: 'condition.splits', label: 'Splits (%)', field_type: 'number' },
      { key: 'condition.freezing_damage', label: 'Freezing Damage (%)', field_type: 'number' },
      { key: 'condition.mechanical_damage', label: 'Mechanical Damage (%)', field_type: 'number' }
    ]
  },

  STRAWBERRY: {
    name: 'Standard Strawberries',
    version: 1,
    fields: [
      { key: 'pack.underweight', label: 'Underweight (%)', field_type: 'number' },
      { key: 'quality.size', label: 'Size', field_type: 'select', options: ['S', 'M', 'L', 'XL'] },
      { key: 'quality.poorly_colored', label: 'Poorly Colored (%)', field_type: 'number' },
      { key: 'quality.poorly_cleanliness', label: 'Poorly Cleanliness (%)', field_type: 'number' },
      { key: 'quality.no_calyx', label: 'No Calyx (%)', field_type: 'number' },
      { key: 'quality.dry_calyx', label: 'Dry Calyx (%)', field_type: 'number' },
      { key: 'quality.undersize', label: 'Undersize (%)', field_type: 'number' },

      { key: 'condition.crushed', label: 'Crushed (%)', field_type: 'number' },
      { key: 'condition.misshapen', label: 'Misshapen (%)', field_type: 'number' },
      { key: 'condition.soft_overripe', label: 'Soft / Overripe (%)', field_type: 'number' },
      { key: 'condition.cuts', label: 'Cuts (%)', field_type: 'number' },
      { key: 'condition.shriveling', label: 'Shriveling (%)', field_type: 'number' },
      { key: 'condition.decay', label: 'Decay (%)', field_type: 'number' },
      { key: 'condition.mold', label: 'Mold (%)', field_type: 'number' },
      { key: 'condition.bruises', label: 'Bruises (%)', field_type: 'number' }
    ]
  }
}
