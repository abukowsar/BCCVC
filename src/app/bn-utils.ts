const bnDigits = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
export const toBn = (value: string | number) => String(value).replace(/[0-9]/g, (digit) => bnDigits[Number(digit)]);
export const fromBn = (value: string) => Number(value.replace(/[০-৯]/g, (digit) => String(bnDigits.indexOf(digit))));
