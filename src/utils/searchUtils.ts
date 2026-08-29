import { InventoryItem, CustomFieldDefinition } from '../types';

/**
 * Normalizes a part number / SKU / code by stripping punctuation, hyphens, and whitespace.
 * e.g. "12345-23456" -> "1234523456", "AB-992/01" -> "AB99201"
 */
export function normalizePartNumber(str: string): string {
  if (!str) return '';
  return str.toLowerCase().replace(/[\s\-_./\\:,]/g, '');
}

/**
 * Splits a search query into meaningful tokens (words and part code fragments).
 */
export function tokenizeQuery(query: string): string[] {
  if (!query) return [];
  return query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((token) => token.length > 0);
}

/**
 * Tolerant Industrial Item Search:
 * 1. Checks multi-word query tokens against all item text fields regardless of order.
 * 2. Compares normalized part numbers / codes (treating `12345-23456`, `12345 23456`, `1234523456` identically).
 * 3. Inspects custom configured fields marked as searchable.
 */
export function searchInventoryItems(
  items: InventoryItem[] = [],
  query: string,
  customFieldDefs: CustomFieldDefinition[] = []
): InventoryItem[] {
  const safeItems = Array.isArray(items) ? items : [];
  if (!query || !query.trim()) return safeItems;

  const rawQuery = query.trim().toLowerCase();
  const tokens = tokenizeQuery(query);
  const normalizedQueryCode = normalizePartNumber(query);

  // Searchable custom field IDs
  const searchableCustomKeys = (Array.isArray(customFieldDefs) ? customFieldDefs : [])
    .filter((f) => f && f.isSearchable)
    .map((f) => f.id);

  return safeItems.filter((item) => {
    if (!item) return false;
    // 1. Direct Part Number & SKU normalized code match
    const normalizedSku = normalizePartNumber(item.sku);
    const normalizedBarcode = normalizePartNumber(item.barcode);
    const normalizedPartNo = normalizePartNumber(item.partNumber || '');
    const normalizedOemNo = normalizePartNumber(item.oemNumber || '');

    if (
      normalizedQueryCode.length >= 3 &&
      (normalizedSku.includes(normalizedQueryCode) ||
        normalizedBarcode.includes(normalizedQueryCode) ||
        normalizedPartNo.includes(normalizedQueryCode) ||
        normalizedOemNo.includes(normalizedQueryCode))
    ) {
      return true;
    }

    // 2. Build comprehensive item text pool
    const textPoolParts: string[] = [
      item.sku,
      item.barcode,
      item.name || '',
      item.description,
      item.department,
      item.category,
      item.partNumber || '',
      item.oemNumber || '',
      item.preferredSupplier || '',
      item.location,
    ];

    // Add custom fields
    if (item.customFields) {
      for (const [key, val] of Object.entries(item.customFields)) {
        if (val !== undefined && val !== null) {
          // If custom field definitions are provided, prioritize searchable ones or include all string values
          if (searchableCustomKeys.length === 0 || searchableCustomKeys.includes(key)) {
            if (Array.isArray(val)) {
              textPoolParts.push(val.join(' '));
            } else {
              textPoolParts.push(String(val));
            }
          }
        }
      }
    }

    const fullItemText = textPoolParts.join(' ').toLowerCase();
    const normalizedFullItemText = normalizePartNumber(fullItemText);

    // 3. Multi-token match: EVERY token must be present in the item pool (in any order)
    const allTokensMatch = tokens.every((token) => {
      // Check normal substring
      if (fullItemText.includes(token)) return true;
      // Check normalized code token
      const normToken = normalizePartNumber(token);
      if (normToken.length >= 2 && normalizedFullItemText.includes(normToken)) {
        return true;
      }
      return false;
    });

    return allTokensMatch;
  });
}
