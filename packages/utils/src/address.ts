interface AddressResult {
  prefecture: string;
  city: string;
  town: string;
}

export async function getAddressFromPostalCode(postalCode: string): Promise<AddressResult | null> {
  const cleaned = postalCode.replace("-", "");
  if (cleaned.length !== 7) return null;

  try {
    const res = await fetch(`https://zipcloud.ibsnet.co.jp/api/search?zipcode=${cleaned}`);
    const data = await res.json();

    if (!data.results || data.results.length === 0) return null;

    const result = data.results[0];
    return {
      prefecture: result.address1,
      city: result.address2,
      town: result.address3,
    };
  } catch {
    return null;
  }
}

export function formatPostalCode(code: string): string {
  const cleaned = code.replace(/\D/g, "");
  if (cleaned.length >= 7) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 7)}`;
  }
  return cleaned;
}
