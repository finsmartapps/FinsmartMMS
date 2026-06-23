export const GEO_COUNTRIES = [
  { value: 'USA', label: 'United States' },
  { value: 'UK', label: 'United Kingdom' },
] as const

export type GeoCountry = (typeof GEO_COUNTRIES)[number]['value']

export const US_STATES = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado',
  'Connecticut', 'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho',
  'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana',
  'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota',
  'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada',
  'New Hampshire', 'New Jersey', 'New Mexico', 'New York',
  'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon',
  'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota',
  'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington',
  'West Virginia', 'Wisconsin', 'Wyoming',
]

export const UK_REGIONS = [
  'Greater London', 'South East England', 'South West England',
  'East of England', 'East Midlands', 'West Midlands',
  'Yorkshire and the Humber', 'North West England', 'North East England',
  'Scotland', 'Wales', 'Northern Ireland',
]

export function getStatesForCountry(country: string): string[] {
  if (country === 'USA') return US_STATES
  if (country === 'UK') return UK_REGIONS
  return []
}
